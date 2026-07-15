# Football Manager — Claude Code Build Instructions (Stage 10)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained for Stage 10 and
repeats everything you need.

**Stages 0–9 are already implemented** (storage core, integrity mutations,
cross-tab sync, seeding, router, all six CRUD views, backup/durability,
vendored export libs, date-range export, hardening) and pass their gates,
as does the PWA scaffolding. Do not redo that work — **read the existing
`js/data.js`, `js/router.js`, `js/views/roster.js`, `js/views/schedule.js`,
`js/util.js`, and `index.html` before editing them** so you extend rather
than duplicate or conflict with what's there.

Your job now: a **Team View dashboard**, **roster filtering/sorting**, a
**visual split between upcoming and past events on the schedule**, and
**data-hygiene prompts** that catch events/fundraisers whose date has passed
but whose status was never updated.

## Hard rules (carry over from the base spec — do not violate)

1. **UI code never touches `localStorage` directly.** Every read/write goes
   through functions exported by `js/data.js`. New derived read logic goes in
   `js/selectors.js` (added below), which itself only reads via `getData()`.
2. **No build step.** Vanilla ES modules, no bundler, no transpilation.
3. **No third-party scripts of any kind added in this stage.** Everything
   renders with plain DOM APIs / template strings.
4. **Every view reads via `getData()` (or the typed getters/selectors) on
   each render and registers a `subscribe()` callback — no view caches
   *records* in its own module-level variables.** View-local *UI state*
   (a filter string, a sort key) inside the `mount()` closure is fine and
   expected; it just must not be a stale copy of the records themselves.
5. **Money is integer cents in storage, always.** Reuse `centsToDollarsStr` /
   `dollarsToCents` from `js/util.js`; never store a float.
6. **Escape user-entered text before interpolating into `innerHTML`.** Use
   the shared `escapeHtml()` from `js/util.js` everywhere a record field is
   rendered into a template string.
7. **No schema migration is needed in this stage.** Everything added here is
   either derived/read-only (win-loss record, "next event," stale-item
   detection) or view-local UI state. `SCHEMA_VERSION` stays at **2**. Do
   **not** bump it or touch `migrate()`.
8. **Stop after Stage 10's acceptance gate passes.**

---

## New shared module: `js/selectors.js`

Stage 5 introduced `js/util.js` for helpers shared across views; this stage
introduces one more shared module for the same reason. The Team View and the
hygiene banner both need the same derived facts (the season record, the next
game/practice, which items are stale), so compute them in exactly one place.

These are **pure read functions over `getData()`** — no mutation, no
persistence. That keeps `data.js` focused on storage + integrity while giving
every consumer a single source of truth for derived state.

```js
// js/selectors.js
import { getData } from './data.js';

// The rest of the codebase already uses this exact expression for "today"
// (see snacks.js, fundraisers.js). Stay consistent with it: dates are stored
// as 'YYYY-MM-DD' strings and compared lexicographically. (Known minor caveat
// inherited from the existing code: toISOString() is UTC, so "today" can flip
// a few hours early/late relative to local midnight. Not worth diverging from
// the established convention here.)
export const todayStr = () => new Date().toISOString().slice(0, 10);

// --- Win / Loss / Tie record: completed games with both scores set ---
export function getTeamRecord() {
  const { events } = getData();
  let wins = 0, losses = 0, ties = 0;
  for (const e of events) {
    if (e.type !== 'game' || e.status !== 'completed') continue;
    if (e.finalScoreUs == null || e.finalScoreOpponent == null) continue;
    if (e.finalScoreUs > e.finalScoreOpponent) wins++;
    else if (e.finalScoreUs < e.finalScoreOpponent) losses++;
    else ties++;
  }
  return { wins, losses, ties };
}

// --- Next scheduled event of a given type ('game' | 'practice') ---
export function getNextEventOfType(type, today = todayStr()) {
  return getData().events
    .filter(e => e.type === type && e.status === 'scheduled' && e.date >= today)
    .sort((a, b) => a.date === b.date
      ? (a.startTime || '').localeCompare(b.startTime || '')
      : a.date.localeCompare(b.date))[0] || null;
}

// --- Stale events: date has passed, still marked 'scheduled' ---
// (Neither completed nor canceled — the admin forgot to update it.)
export function getStaleEvents(today = todayStr()) {
  return getData().events
    .filter(e => e.status === 'scheduled' && e.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Stale fundraisers: still planned/active, but every occurrence has ended ---
// A fundraiser with no occurrences is skipped (there's no end date to judge).
export function getStaleFundraisers(today = todayStr()) {
  const { fundraisers, fundraiserOccurrences } = getData();
  return fundraisers.filter(f => {
    if (f.status !== 'planned' && f.status !== 'active') return false;
    const occ = fundraiserOccurrences.filter(o => o.fundraiserId === f.id);
    if (!occ.length) return false;
    return occ.every(o => o.endDate < today);
  });
}

// --- Convenience: is there anything needing attention at all? ---
export function hasHygieneItems(today = todayStr()) {
  return getStaleEvents(today).length > 0 || getStaleFundraisers(today).length > 0;
}
```

---

## Stage 10.1 — Team View dashboard (`js/views/team.js` + routing)

A landing page that answers the three questions the admin opens the app to
check: *How are we doing? When's the next game? When's the next practice?* —
plus a "Needs attention" section (built in Stage 10.4) that surfaces stale
items inline.

### `js/views/team.js`

```js
import { getSettings, getOpponentById, updateEvent, updateFundraiser, subscribe }
  from '../data.js';
import {
  getTeamRecord, getNextEventOfType, getStaleEvents, getStaleFundraisers
} from '../selectors.js';
import { escapeHtml } from '../util.js';

function fmtDate(d) {
  // 'YYYY-MM-DD' -> e.g. 'Sat, Apr 12'
  return new Date(d + 'T00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(e) {
  return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

export function mount(container) {
  container.innerHTML = `
    <div id="team-view">
      <h2 id="team-heading">Team</h2>
      <div class="dashboard-cards">
        <section class="card record-card">
          <h3>Record</h3>
          <p id="record-line" class="big-stat">—</p>
        </section>
        <section class="card next-game-card">
          <h3>Next Game</h3>
          <div id="next-game"></div>
        </section>
        <section class="card next-practice-card">
          <h3>Next Practice</h3>
          <div id="next-practice"></div>
        </section>
      </div>
      <section id="needs-attention" class="card needs-attention" hidden>
        <h3>⚠️ Needs Attention</h3>
        <div id="attention-body"></div>
      </section>
    </div>
  `;

  const heading   = container.querySelector('#team-heading');
  const recordEl  = container.querySelector('#record-line');
  const gameEl    = container.querySelector('#next-game');
  const practEl   = container.querySelector('#next-practice');
  const attnCard  = container.querySelector('#needs-attention');
  const attnBody  = container.querySelector('#attention-body');

  function render() {
    const s = getSettings();
    heading.textContent = s.teamName
      ? `${s.teamName}${s.season ? ` — ${s.season}` : ''}`
      : 'Team';

    const { wins, losses, ties } = getTeamRecord();
    recordEl.textContent = ties > 0
      ? `${wins}–${losses}–${ties}`
      : `${wins}–${losses}`;

    // Next game — prominent "vs [opponent]"
    const g = getNextEventOfType('game');
    if (!g) {
      gameEl.innerHTML = `<p class="muted">No upcoming games.</p>`;
    } else {
      const opp = g.opponentId ? getOpponentById(g.opponentId) : null;
      const oppName = opp ? escapeHtml(opp.name) : 'TBD';
      const loc = g.location || (opp && opp.homeLocation) || '';
      gameEl.innerHTML = `
        <p class="vs-line">vs <strong>${oppName}</strong></p>
        <p class="when-line">${fmtDate(g.date)} · ${fmtTime(g)}</p>
        ${loc ? `<p class="loc-line">${escapeHtml(loc)}</p>` : ''}
      `;
    }

    // Next practice
    const pr = getNextEventOfType('practice');
    if (!pr) {
      practEl.innerHTML = `<p class="muted">No upcoming practices.</p>`;
    } else {
      practEl.innerHTML = `
        <p class="when-line"><strong>${fmtDate(pr.date)}</strong> · ${fmtTime(pr)}</p>
        ${pr.location ? `<p class="loc-line">${escapeHtml(pr.location)}</p>` : ''}
      `;
    }

    renderNeedsAttention();
  }

  // --- Needs Attention (Stage 10.4 resolution surface) ---
  function renderNeedsAttention() {
    const staleEvents = getStaleEvents();
    const staleFundraisers = getStaleFundraisers();
    if (!staleEvents.length && !staleFundraisers.length) {
      attnCard.hidden = true;
      attnBody.innerHTML = '';
      return;
    }
    attnCard.hidden = false;

    const eventRows = staleEvents.map(e => {
      const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
      const label = e.type === 'game'
        ? `Game${opp ? ` vs ${escapeHtml(opp.name)}` : ''}`
        : 'Practice';
      return `
        <div class="attn-row" data-kind="event" data-id="${e.id}" data-type="${e.type}">
          <span>${fmtDate(e.date)} · ${label} — still marked scheduled.</span>
          ${e.type === 'game'
            ? `<button class="attn-result-btn">Enter result</button>` : ''}
          <button class="attn-complete-btn">Mark completed</button>
          <button class="attn-cancel-btn">Mark canceled</button>
        </div>`;
    }).join('');

    const fundRows = staleFundraisers.map(f => `
      <div class="attn-row" data-kind="fundraiser" data-id="${f.id}">
        <span>Fundraiser "${escapeHtml(f.name)}" has ended but is still ${escapeHtml(f.status)}.</span>
        <button class="attn-fund-complete-btn">Mark completed</button>
        <button class="attn-fund-cancel-btn">Mark canceled</button>
      </div>`).join('');

    attnBody.innerHTML = eventRows + fundRows;
  }

  attnBody.addEventListener('click', (e) => {
    const row = e.target.closest('.attn-row');
    if (!row) return;
    const id = row.dataset.id;

    if (row.dataset.kind === 'event') {
      if (e.target.classList.contains('attn-complete-btn'))
        updateEvent(id, { status: 'completed' });
      if (e.target.classList.contains('attn-cancel-btn'))
        updateEvent(id, { status: 'canceled' });
      if (e.target.classList.contains('attn-result-btn')) {
        // Mark completed, then jump to Schedule where the score inputs appear.
        updateEvent(id, { status: 'completed' });
        window.location.hash = '#/schedule';
      }
    }

    if (row.dataset.kind === 'fundraiser') {
      if (e.target.classList.contains('attn-fund-complete-btn'))
        updateFundraiser(id, { status: 'completed' });
      if (e.target.classList.contains('attn-fund-cancel-btn'))
        updateFundraiser(id, { status: 'canceled' });
    }
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### Routing + nav changes

**`js/router.js` — read it first, then make two edits:**

```js
// ADD to the routes map (put it first for clarity):
'#/team':        () => import('./views/team.js'),

// CHANGE the default route so the dashboard is the landing page:
const DEFAULT_ROUTE = '#/team';   // was '#/schedule'
```

Everything else in `router.js` (the `mount`/unmount contract, unknown-hash
fallback, `highlightNav`) stays exactly as-is.

**`index.html` — read it first, then add the Team nav link as the first item:**

```html
<nav id="main-nav">
  <a href="#/team">Team</a>            <!-- NEW, first -->
  <a href="#/schedule">Schedule</a>
  <a href="#/roster">Roster</a>
  <a href="#/parents">Parents</a>
  <a href="#/snacks">Snacks</a>
  <a href="#/fundraisers">Fundraisers</a>
  <a href="#/settings">Settings</a>
</nav>
```

### Stage 10.1 gate
- Loading the site with no hash lands on `#/team`, not `#/schedule`.
- With completed games entered, the record shows correct W–L (and W–L–T only
  when at least one tie exists).
- The Next Game card shows a prominent **vs [opponent name]** (or **vs TBD**
  when the game has no opponent), with date/time/location; Next Practice shows
  the soonest scheduled practice. Both say "No upcoming …" when none exist.
- Empty store: record is `0–0`, both cards show their empty message, and the
  Needs Attention card is hidden.

---

## Stage 10.2 — Roster filtering & sorting (`js/views/roster.js`)

Extend the existing Roster view with a controls bar. Filter and sort state
live as view-local variables inside `mount()` (allowed — they're UI prefs,
not cached records); the displayed list is always re-derived from
`getPlayers()` on each render.

**Read the current `roster.js` first.** Keep every existing behavior (inline
edit, star toggle, delete, add-player form, the `subscribe(render)` wiring)
and layer the controls in. The full replacement below preserves all of that.

```js
import {
  getPlayers, addPlayer, updatePlayer, deletePlayer,
  getSettings, updateSettings, subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

const COMMON_POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];

export function mount(container) {
  // view-local UI state (NOT cached records)
  let filterStatus = 'active';   // 'all' | 'active' | 'inactive'
  let filterPosition = '';       // '' = any
  let sortKey = 'jersey';        // 'jersey' | 'last' | 'position' | 'balance'
  let sortDir = 'asc';           // 'asc' | 'desc'

  container.innerHTML = `
    <h2>Roster</h2>
    <div class="roster-controls">
      <label>Show:
        <select id="filter-status">
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>
      </label>
      <label>Position:
        <select id="filter-position"><option value="">Any</option></select>
      </label>
      <label>Sort by:
        <select id="sort-key">
          <option value="jersey">#</option>
          <option value="last">Last name</option>
          <option value="position">Position</option>
          <option value="balance">Balance</option>
        </select>
      </label>
      <button id="sort-dir" title="Toggle sort direction">▲</button>
    </div>
    <datalist id="position-list">
      ${COMMON_POSITIONS.map(p => `<option value="${p}"></option>`).join('')}
    </datalist>
    <table class="roster-table">
      <thead>
        <tr><th></th><th>#</th><th>First</th><th>Last</th><th>Position</th>
            <th>Active</th><th>Balance</th><th></th></tr>
      </thead>
      <tbody id="roster-body"></tbody>
    </table>
    <h3>Add Player</h3>
    <form id="add-player-form">
      <input name="jerseyNumber" placeholder="#" size="3" />
      <input name="firstName" placeholder="First name" required />
      <input name="lastName" placeholder="Last name" required />
      <input name="position" placeholder="Position" list="position-list" />
      <button type="submit">Add Player</button>
    </form>
  `;

  const tbody       = container.querySelector('#roster-body');
  const form        = container.querySelector('#add-player-form');
  const statusSel   = container.querySelector('#filter-status');
  const posSel      = container.querySelector('#filter-position');
  const sortKeySel  = container.querySelector('#sort-key');
  const sortDirBtn  = container.querySelector('#sort-dir');

  function jerseyCmp(a, b) {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b));
  }

  function visiblePlayers() {
    let list = getPlayers().slice();

    if (filterStatus === 'active') list = list.filter(p => p.active);
    else if (filterStatus === 'inactive') list = list.filter(p => !p.active);

    if (filterPosition) list = list.filter(p => p.position === filterPosition);

    list.sort((a, b) => {
      let r;
      if (sortKey === 'jersey') r = jerseyCmp(a.jerseyNumber, b.jerseyNumber);
      else if (sortKey === 'last') r = String(a.lastName).localeCompare(String(b.lastName));
      else if (sortKey === 'position') r = String(a.position).localeCompare(String(b.position));
      else if (sortKey === 'balance') r = (a.outstandingBalanceCents || 0) - (b.outstandingBalanceCents || 0);
      else r = 0;
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }

  function refreshPositionFilterOptions() {
    // union of common positions + any custom positions actually in use
    const used = new Set(getPlayers().map(p => p.position).filter(Boolean));
    COMMON_POSITIONS.forEach(p => used.add(p));
    const opts = [...used].sort((a, b) => a.localeCompare(b))
      .map(p => `<option value="${escapeHtml(p)}" ${p === filterPosition ? 'selected' : ''}>${escapeHtml(p)}</option>`)
      .join('');
    posSel.innerHTML = `<option value="">Any</option>${opts}`;
  }

  function render() {
    // keep controls reflecting current state
    statusSel.value = filterStatus;
    sortKeySel.value = sortKey;
    sortDirBtn.textContent = sortDir === 'asc' ? '▲' : '▼';
    refreshPositionFilterOptions();

    const players = visiblePlayers();
    const myId = getSettings().myPlayerId;
    tbody.innerHTML = players.map(p => `
      <tr data-id="${p.id}" class="${p.id === myId ? 'my-player' : ''} ${!p.active ? 'inactive' : ''}">
        <td><button class="star-btn" title="Mark as my player">${p.id === myId ? '★' : '☆'}</button></td>
        <td><input class="f-jersey" value="${escapeHtml(p.jerseyNumber)}" size="3" /></td>
        <td><input class="f-first" value="${escapeHtml(p.firstName)}" /></td>
        <td><input class="f-last" value="${escapeHtml(p.lastName)}" /></td>
        <td><input class="f-position" value="${escapeHtml(p.position)}" list="position-list" /></td>
        <td><input type="checkbox" class="f-active" ${p.active ? 'checked' : ''} /></td>
        <td>$<input class="f-balance" type="number" step="0.01"
              value="${(p.outstandingBalanceCents / 100).toFixed(2)}" size="6" /></td>
        <td><button class="delete-btn">Delete</button></td>
      </tr>
    `).join('') || `<tr><td colspan="8">No players match this filter.</td></tr>`;
  }

  // filter/sort controls — local state only, then re-render (no data mutation)
  statusSel.addEventListener('change', () => { filterStatus = statusSel.value; render(); });
  posSel.addEventListener('change', () => { filterPosition = posSel.value; render(); });
  sortKeySel.addEventListener('change', () => { sortKey = sortKeySel.value; render(); });
  sortDirBtn.addEventListener('click', () => {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    render();
  });

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('star-btn')) {
      const myId = getSettings().myPlayerId;
      updateSettings({ myPlayerId: myId === id ? null : id });
    }
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this player? This cannot be undone.')) deletePlayer(id);
    }
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-jersey')) updatePlayer(id, { jerseyNumber: e.target.value });
    if (e.target.classList.contains('f-first')) updatePlayer(id, { firstName: e.target.value });
    if (e.target.classList.contains('f-last')) updatePlayer(id, { lastName: e.target.value });
    if (e.target.classList.contains('f-position')) updatePlayer(id, { position: e.target.value });
    if (e.target.classList.contains('f-active')) updatePlayer(id, { active: e.target.checked });
    if (e.target.classList.contains('f-balance')) {
      const cents = Math.round(parseFloat(e.target.value || '0') * 100);
      updatePlayer(id, { outstandingBalanceCents: cents });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addPlayer({
      jerseyNumber: fd.get('jerseyNumber').trim(),
      firstName: fd.get('firstName').trim(),
      lastName: fd.get('lastName').trim(),
      position: fd.get('position').trim()
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

> **Focus caveat (same class of bug as Settings' `activeElement` guard):**
> filter/sort re-renders rebuild `tbody`, so they'd blow away a half-typed
> cell edit. That's acceptable here because the filter/sort controls live in
> the toolbar (outside `tbody`) and a `subscribe()`-driven re-render already
> rebuilds the whole table on every keystroke-triggered `updatePlayer` in the
> existing Stage 5 design — this stage doesn't make that worse. If inline-edit
> focus loss becomes annoying in practice, that's a separate polish task, not
> part of this gate.

### Stage 10.2 gate
- The status filter shows active-only by default; switching to inactive/all
  changes the visible set. Deactivated players disappear under "Active only"
  but still exist (reappear under "All").
- The position filter lists common positions plus any custom position in use,
  and narrows the list correctly; "Any" clears it.
- Sorting by #, last name, position, and balance all work; the direction
  toggle reverses them. Jersey sort treats "7" < "10" numerically and pushes
  non-numeric strings (e.g. "GK") to the end.
- Star toggle, inline edits, add, and delete all still behave as before, and
  a delete/edit in another tab still re-renders this view via `subscribe`.

---

## Stage 10.3 — Upcoming vs. past split on Schedule (`js/views/schedule.js`)

Right now the Schedule view renders every event in one continuous table.
Split it into two boxed sections — **Upcoming** (date ≥ today) and **Past**
(date < today) — so the admin isn't scrolling past last month to find next
week. Past-dated events still marked `scheduled` get a ⚠️ marker (this is the
same stale set surfaced on the Team View — visual reinforcement here).

**Read the current `schedule.js` first.** Keep every existing behavior (inline
edit of all fields, opponent dropdown + `+ New opponent`, status/score
handling, delete, the add-event form, the `subscribe(render)` wiring). The
only change is that `render()` partitions the sorted events into two tables
instead of one. Below is the full replacement — note the added
`import { todayStr } from '../selectors.js';` and the rewritten `render()`;
the event handlers and form logic are unchanged from Stage 5.

```js
import {
  getEvents, addEvent, updateEvent, deleteEvent,
  getOpponents, addOpponent, getOpponentById,
  subscribe
} from '../data.js';
import { todayStr } from '../selectors.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Schedule</h2>
    <section class="schedule-group">
      <h3>Upcoming</h3>
      <table class="schedule-table">
        <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Opponent</th>
          <th>Location</th><th>Status</th><th>Score</th><th></th></tr></thead>
        <tbody id="schedule-upcoming"></tbody>
      </table>
    </section>
    <section class="schedule-group">
      <h3>Past</h3>
      <table class="schedule-table">
        <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Opponent</th>
          <th>Location</th><th>Status</th><th>Score</th><th></th></tr></thead>
        <tbody id="schedule-past"></tbody>
      </table>
    </section>
    <h3>Add Event</h3>
    <form id="add-event-form">
      <select name="type"><option value="practice">Practice</option><option value="game">Game</option></select>
      <input type="date" name="date" required />
      <input type="time" name="startTime" required />
      <input type="time" name="endTime" />
      <input name="location" placeholder="Location" />
      <select name="opponentId" id="opponent-select"><option value="">— No opponent —</option></select>
      <button type="button" id="new-opponent-btn">+ New opponent</button>
      <button type="submit">Add Event</button>
    </form>
  `;

  const upcomingBody = container.querySelector('#schedule-upcoming');
  const pastBody     = container.querySelector('#schedule-past');
  const form         = container.querySelector('#add-event-form');
  const oppSelect    = container.querySelector('#opponent-select');

  function renderOpponentOptions(select, selectedId = '') {
    const opts = getOpponents().map(o =>
      `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
    select.innerHTML = `<option value="">— No opponent —</option>${opts}`;
  }

  function rowHtml(e) {
    const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
    const isGame = e.type === 'game';
    const today = todayStr();
    const stale = e.status === 'scheduled' && e.date < today;
    return `
      <tr data-id="${e.id}" class="${stale ? 'stale-event' : ''}">
        <td>${stale ? '⚠️ ' : ''}<input type="date" class="f-date" value="${e.date}" /></td>
        <td>
          <input type="time" class="f-start" value="${e.startTime}" />
          <input type="time" class="f-end" value="${e.endTime || ''}" />
        </td>
        <td>
          <select class="f-type">
            <option value="practice" ${!isGame ? 'selected' : ''}>Practice</option>
            <option value="game" ${isGame ? 'selected' : ''}>Game</option>
          </select>
        </td>
        <td>${isGame ? `<select class="f-opponent">
            <option value="">— No opponent —</option>${
              getOpponents().map(o => `<option value="${o.id}" ${o.id === e.opponentId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')
            }</select>` : ''}</td>
        <td><input class="f-location" value="${escapeHtml(e.location)}"
              placeholder="${opp ? escapeHtml(opp.homeLocation || '') : ''}" /></td>
        <td>
          <select class="f-status">
            <option value="scheduled" ${e.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="canceled" ${e.status === 'canceled' ? 'selected' : ''}>Canceled</option>
            <option value="completed" ${e.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td>${isGame && e.status === 'completed' ? `
          <input type="number" class="f-score-us" value="${e.finalScoreUs ?? ''}" size="2" /> -
          <input type="number" class="f-score-opp" value="${e.finalScoreOpponent ?? ''}" size="2" />
        ` : ''}</td>
        <td><button class="delete-btn">Delete</button></td>
      </tr>`;
  }

  function render() {
    renderOpponentOptions(oppSelect);
    const today = todayStr();
    const sorted = [...getEvents()].sort((a, b) =>
      a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

    const upcoming = sorted.filter(e => e.date >= today);            // ascending
    const past = sorted.filter(e => e.date < today).reverse();       // most recent first

    upcomingBody.innerHTML = upcoming.map(rowHtml).join('')
      || '<tr><td colspan="8">No upcoming events.</td></tr>';
    pastBody.innerHTML = past.map(rowHtml).join('')
      || '<tr><td colspan="8">No past events.</td></tr>';
  }

  // one delegated click/change handler pair covers both tbodies
  function onClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this event? Removes its snack assignments too.')) deleteEvent(row.dataset.id);
    }
  }
  function onChange(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-date')) updateEvent(id, { date: e.target.value });
    if (e.target.classList.contains('f-start')) updateEvent(id, { startTime: e.target.value });
    if (e.target.classList.contains('f-end')) updateEvent(id, { endTime: e.target.value });
    if (e.target.classList.contains('f-type')) updateEvent(id, { type: e.target.value });
    if (e.target.classList.contains('f-opponent')) updateEvent(id, { opponentId: e.target.value || null });
    if (e.target.classList.contains('f-location')) updateEvent(id, { location: e.target.value });
    if (e.target.classList.contains('f-status')) updateEvent(id, { status: e.target.value });
    if (e.target.classList.contains('f-score-us'))
      updateEvent(id, { finalScoreUs: e.target.value === '' ? null : Number(e.target.value) });
    if (e.target.classList.contains('f-score-opp'))
      updateEvent(id, { finalScoreOpponent: e.target.value === '' ? null : Number(e.target.value) });
  }

  upcomingBody.addEventListener('click', onClick);
  pastBody.addEventListener('click', onClick);
  upcomingBody.addEventListener('change', onChange);
  pastBody.addEventListener('change', onChange);

  container.querySelector('#new-opponent-btn').addEventListener('click', () => {
    const name = prompt('Opponent name?');
    if (!name) return;
    const homeLocation = prompt('Home location (optional)?') || '';
    const opp = addOpponent({ name, homeLocation });
    renderOpponentOptions(oppSelect, opp.id);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addEvent({
      type: fd.get('type'),
      date: fd.get('date'),
      startTime: fd.get('startTime'),
      endTime: fd.get('endTime') || '',
      location: fd.get('location') || '',
      opponentId: fd.get('opponentId') || null
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### Stage 10.3 gate
- Events split into **Upcoming** (today and later, ascending) and **Past**
  (before today, most-recent first); each section shows its own empty message
  when it has no events.
- A past-dated event still marked `scheduled` shows the ⚠️ marker in the Past
  table; marking it completed or canceled clears the marker.
- Editing a date so it crosses today moves the row to the other section on the
  next render.
- All inline edits, opponent add, status/score handling, and delete still work
  in both sections.

---

## Stage 10.4 — Data-hygiene prompt on launch (`js/hygiene.js` + `index.html`)

The Team View already lists stale items in its "Needs Attention" card (Stage
10.1). This step adds the **first-launch prompt**: an app-wide banner —
modeled exactly on the Stage 6 backup nudge — that appears when stale items
exist and points the admin at the Team View to resolve them. It's dismissible
for the current session (in-memory only, no schema/storage change); reloading
re-surfaces it if anything is still stale, which is the intended "prompt again
next launch until you deal with it" behavior.

### New file: `js/hygiene.js`

```js
import { subscribe } from './data.js';
import { getStaleEvents, getStaleFundraisers } from './selectors.js';

export function initHygieneBanner(bannerEl) {
  let dismissed = false;   // session-only; resets on reload (in-memory)

  function render() {
    const events = getStaleEvents();
    const fundraisers = getStaleFundraisers();
    const n = events.length + fundraisers.length;

    if (n === 0 || dismissed) {
      bannerEl.hidden = true;
      return;
    }
    bannerEl.hidden = false;
    bannerEl.innerHTML =
      `📝 ${n} item${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a status update ` +
      `(past-dated but still scheduled/active). ` +
      `Review on the <a href="#/team">Team page</a>. ` +
      `<button id="hygiene-dismiss">Dismiss</button>`;
    bannerEl.querySelector('#hygiene-dismiss').addEventListener('click', () => {
      dismissed = true;
      render();
    });
  }

  subscribe(render);
  render();
}
```

### `index.html` — add a second banner mount + wire it

Read the current boot block first. Add a hygiene banner element next to the
existing `#nudge-banner`, and initialize it alongside `initNudgeBanner`:

```html
<!-- after the existing <div id="nudge-banner" hidden></div> -->
<div id="hygiene-banner" hidden></div>
```

```js
// in the boot <script type="module">, add the import…
import { initHygieneBanner } from './js/hygiene.js';

// …and after initNudgeBanner(...):
initHygieneBanner(document.getElementById('hygiene-banner'));
```

(The backup nudge and the hygiene prompt are independent and can both show at
once; that's fine — they're different concerns stacked in the same header
area.)

### Stage 10.4 gate
- Create a game or practice dated in the past and leave it `scheduled`
  (or edit `meta`/an event date in the console to simulate the passage of
  time): on the next load, the hygiene banner appears app-wide, from every
  view, with an accurate count and a link to the Team page.
- Resolving every stale item (mark completed/canceled, or update the
  fundraiser's status) makes the banner disappear without a reload, via the
  `subscribe` re-render — and the Team View "Needs Attention" card empties and
  hides in lockstep.
- Clicking **Dismiss** hides the banner for the session; reloading brings it
  back if anything is still stale.
- A fundraiser whose only occurrence ended, still `planned`/`active`, shows up
  as a stale item; one with status `completed`/`canceled`, or one with no
  occurrences at all, does **not**.

---

## Overall Stage 10 acceptance gate

- The four capabilities work end-to-end: Team View dashboard (record + next
  game "vs" + next practice), roster filter/sort, schedule upcoming/past
  split, and the launch-time hygiene prompt.
- `SCHEMA_VERSION` is still **2**; `migrate()` is untouched; a Stage 9 backup
  `.json` still imports cleanly (nothing in this stage changed the persisted
  shape).
- No new `localStorage` access outside `data.js`; no third-party scripts added;
  `escapeHtml` used on every interpolated record field in the new/edited views.
- Navigating repeatedly through **all seven** views (Team included) still shows
  no EventListener-leak warnings — the new Team View's `mount()` returns a
  working unsubscribe, same as the others.

---

## Stop point

Once Stage 10's gate passes, **stop**. Ideas that are explicitly *not* in this
stage (add them only if a real need appears): a calendar/month grid on the
Team View, per-player stats or per-opponent head-to-head records, folding the
stale-item count into the export, and persisting dismissed hygiene prompts
across reloads (which would require a schema bump and is deliberately avoided
here).
