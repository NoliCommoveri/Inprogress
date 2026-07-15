# Football Manager — Claude Code Build Instructions (Stages 4–6)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained for Stages 4–6 and
repeats everything you need.

**Stages 0–3 are already implemented**: the file tree, `js/data.js`'s
storage core, integrity-enforcing mutations, cross-tab sync, and first-run
seeding all exist and pass their gates. Do not redo that work — **read the
existing `js/data.js` before editing it** so you extend it rather than
duplicate or conflict with what's there.

Your job now: the app shell/router, the six CRUD views, and backup/durability.

## Hard rules (do not violate these)

1. **UI code never touches `localStorage` directly.** Every read/write goes
   through the functions already exported by `js/data.js` (extended in
   Stage 6). Views call those functions and nothing else.
2. **No build step.** Vanilla ES modules, no bundler, no transpilation.
3. **No third-party scripts of any kind at this stage.** Vendored export
   libs (SheetJS/jsPDF) are Stage 7 — out of scope here. Views must render
   with plain DOM APIs / template strings only.
4. **Every view reads via `getData()` (or the typed getters) on each
   render and registers a `subscribe()` callback — no view caches records
   in its own module-level variables.** This is what makes cross-tab sync
   and the nudge banner work correctly.
5. **Money is integer cents in storage, always.** Views convert to/from
   dollar strings only at the render/input boundary (see `js/util.js`
   below) — never store a float.
6. **Escape user-entered text before interpolating into `innerHTML`.** Use
   the shared `escapeHtml()` helper (added below) everywhere a record field
   is rendered into a template string.
7. **Stop after Stage 6's acceptance gate passes.** Vendored export
   libraries, the date-range export, and final hardening/deploy are
   separate follow-up stages and out of scope for this handoff.

---

## New shared helper: `js/util.js`

Not in the original file tree, but every view below needs the same two
things (HTML-escaping and cents↔dollars conversion), so add this one small
module now rather than duplicating it six times.

```js
// js/util.js
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function centsToDollarsStr(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export function dollarsToCents(str) {
  return Math.round(parseFloat(str || '0') * 100) || 0;
}
```

---

## Stage 4 — App shell & routing (`js/router.js`)

### View-mount contract

Every view module in `js/views/` exports:

```js
export function mount(containerEl) {
  // render initial DOM into containerEl
  // register subscribe(render) so the view re-renders on any data change
  // return an unmount function that unsubscribes
  return () => unsub();
}
```

The router calls `mount()` when navigating **to** a view and calls the
previously-returned unmount function when navigating **away**. This is what
prevents orphaned `subscribe()` callbacks from piling up as the admin
clicks around.

### `js/router.js`

```js
const routes = {
  '#/schedule':    () => import('./views/schedule.js'),
  '#/roster':      () => import('./views/roster.js'),
  '#/parents':     () => import('./views/parents.js'),
  '#/snacks':      () => import('./views/snacks.js'),
  '#/fundraisers': () => import('./views/fundraisers.js'),
  '#/settings':    () => import('./views/settings.js'),
};
const DEFAULT_ROUTE = '#/schedule';

let currentUnmount = null;

export function initRouter(outletEl, navEl) {
  window.addEventListener('hashchange', () => renderRoute(outletEl, navEl));
  renderRoute(outletEl, navEl);
}

async function renderRoute(outletEl, navEl) {
  const hash = window.location.hash;
  if (!routes[hash]) {
    window.location.hash = DEFAULT_ROUTE;   // triggers hashchange -> re-entry
    return;
  }
  if (currentUnmount) { currentUnmount(); currentUnmount = null; }
  outletEl.innerHTML = '';
  highlightNav(navEl, hash);
  const mod = await routes[hash]();
  currentUnmount = mod.mount(outletEl) || null;
}

function highlightNav(navEl, hash) {
  navEl.querySelectorAll('a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
}
```

Hash routing means the browser never sends the route to the server — a
direct load of `.../#/roster` still just serves `index.html`, and this
script reads `location.hash` client-side. No server-side rewrite rules are
needed on GitHub Pages.

### Update `index.html`

Replace the Stage 0 placeholder shell with nav chrome, an outlet, a nudge
banner mount point (wired up in Stage 6), and the new boot sequence:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Football Manager</title>
  <link rel="stylesheet" href="./css/styles.css" />
</head>
<body>
  <header>
    <h1>Football Manager</h1>
    <nav id="main-nav">
      <a href="#/schedule">Schedule</a>
      <a href="#/roster">Roster</a>
      <a href="#/parents">Parents</a>
      <a href="#/snacks">Snacks</a>
      <a href="#/fundraisers">Fundraisers</a>
      <a href="#/settings">Settings</a>
    </nav>
  </header>
  <div id="nudge-banner" hidden></div>
  <main id="outlet">Loading…</main>

  <script type="module">
    import { seedIfNeeded } from './js/seed.js';
    import { initRouter } from './js/router.js';
    import { initNudgeBanner } from './js/nudge.js';

    seedIfNeeded();
    initRouter(document.getElementById('outlet'), document.getElementById('main-nav'));
    initNudgeBanner(document.getElementById('nudge-banner'));
  </script>
</body>
</html>
```

`js/nudge.js` doesn't exist yet — it's created in Stage 6. If you're
stopping at Stage 4 only, stub it as an empty `initNudgeBanner()` no-op so
`index.html` doesn't throw; Stage 5 below assumes Stage 6 hasn't landed yet
either, so a stub is fine until you get there.

### Stage 4 acceptance gate

- Clicking each nav link swaps the visible view; the clicked link gets an
  `active` class.
- Loading the site directly at a deep hash (e.g. `.../#/roster`) shows that
  view immediately, no 404, no flash of the default route.
- An unknown hash (e.g. `.../#/nope`) redirects to `#/schedule`.
- Opening the browser console shows no "possible EventListener leak"
  warnings after navigating through all six views repeatedly — confirms
  `mount`/unmount is actually unsubscribing.

---

## Stage 5 — Core CRUD views

Build in this order; each view only needs Stages 1–4. Every list re-renders
via the `subscribe()` callback — never via manual DOM patching after a
mutation call. Every dropdown that references another entity gets inline
"add new" per the architecture (§7).

> Note on "my player" highlighting: the architecture says schedule should
> "highlight 'my player' context where relevant," but `Event` records have
> no player reference in the schema (schedule is team-wide, not
> per-player). There's nothing structural to highlight on that view, so
> Stage 5 does **not** add a highlight to Schedule — only Roster, where
> `settings.myPlayerId` actually points at a row. Flagging this now so it's
> a deliberate omission, not a missed requirement.

### `js/views/roster.js`

```js
import {
  getPlayers, addPlayer, updatePlayer, deletePlayer,
  getSettings, updateSettings, subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

const COMMON_POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];

export function mount(container) {
  container.innerHTML = `
    <h2>Roster</h2>
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

  const tbody = container.querySelector('#roster-body');
  const form = container.querySelector('#add-player-form');

  function render() {
    const players = getPlayers();
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
    `).join('') || '<tr><td colspan="8">No players yet.</td></tr>';
  }

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

### `js/views/parents.js`

```js
import {
  getParents, addParent, updateParent, deleteParent,
  getPlayers, getPlayerParentsForParent, addPlayerParent, deletePlayerParent,
  subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Parents</h2>
    <table class="parents-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Players</th><th></th></tr></thead>
      <tbody id="parents-body"></tbody>
    </table>
    <h3>Add Parent</h3>
    <form id="add-parent-form">
      <input name="name" placeholder="Name" required />
      <input name="phone" placeholder="Phone" />
      <input name="email" placeholder="Email (optional)" />
      <button type="submit">Add Parent</button>
    </form>
  `;

  const tbody = container.querySelector('#parents-body');
  const form = container.querySelector('#add-parent-form');

  function render() {
    const parents = getParents();
    const players = getPlayers();
    tbody.innerHTML = parents.map(p => {
      const links = getPlayerParentsForParent(p.id);
      const linkedNames = links.map(l => {
        const pl = players.find(x => x.id === l.playerId);
        return pl
          ? `${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}
             <button class="unlink-btn" data-link="${l.id}">×</button>`
          : '';
      }).join(', ');
      const linkedIds = new Set(links.map(l => l.playerId));
      const options = players.filter(pl => !linkedIds.has(pl.id))
        .map(pl => `<option value="${pl.id}">${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}</option>`)
        .join('');
      return `
        <tr data-id="${p.id}">
          <td><input class="f-name" value="${escapeHtml(p.name)}" /></td>
          <td><input class="f-phone" value="${escapeHtml(p.phone)}" /></td>
          <td><input class="f-email" value="${escapeHtml(p.email)}" /></td>
          <td>${linkedNames}
            ${options ? `<select class="link-select"><option value="">+ link player…</option>${options}</select>` : ''}
          </td>
          <td><button class="delete-btn">Delete</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">No parents yet.</td></tr>';
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this parent? Removes their snack assignments too.')) deleteParent(id);
    }
    if (e.target.classList.contains('unlink-btn')) {
      deletePlayerParent(e.target.dataset.link);
    }
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-name')) updateParent(id, { name: e.target.value });
    if (e.target.classList.contains('f-phone')) updateParent(id, { phone: e.target.value });
    if (e.target.classList.contains('f-email')) updateParent(id, { email: e.target.value });
    if (e.target.classList.contains('link-select') && e.target.value) {
      addPlayerParent({ playerId: e.target.value, parentId: id });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addParent({
      name: fd.get('name').trim(),
      phone: fd.get('phone').trim(),
      email: fd.get('email').trim()
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### `js/views/schedule.js`

```js
import {
  getEvents, addEvent, updateEvent, deleteEvent,
  getOpponents, addOpponent, getOpponentById,
  subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Schedule</h2>
    <table class="schedule-table">
      <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Opponent</th>
        <th>Location</th><th>Status</th><th>Score</th><th></th></tr></thead>
      <tbody id="schedule-body"></tbody>
    </table>
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

  const tbody = container.querySelector('#schedule-body');
  const form = container.querySelector('#add-event-form');
  const oppSelect = container.querySelector('#opponent-select');

  function renderOpponentOptions(select, selectedId = '') {
    const opts = getOpponents().map(o =>
      `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
    select.innerHTML = `<option value="">— No opponent —</option>${opts}`;
  }

  function render() {
    renderOpponentOptions(oppSelect);
    const events = [...getEvents()].sort((a, b) =>
      a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

    tbody.innerHTML = events.map(e => {
      const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
      const isGame = e.type === 'game';
      return `
        <tr data-id="${e.id}">
          <td><input type="date" class="f-date" value="${e.date}" /></td>
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
    }).join('') || '<tr><td colspan="8">No events yet.</td></tr>';
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this event? Removes its snack assignments too.')) deleteEvent(row.dataset.id);
    }
  });

  tbody.addEventListener('change', (e) => {
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
  });

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

### `js/views/snacks.js`

Per architecture §7, this view filters to **practices only** and flags
unassigned upcoming ones — it isn't a general snack-assignment view for
every event type.

```js
import {
  getEvents, getSnackAssignmentsForEvent, addSnackAssignment, deleteSnackAssignment,
  getParents, getParentById, subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Snack Schedule</h2>
    <table class="snacks-table">
      <thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Snack Parent(s)</th><th>Assign</th></tr></thead>
      <tbody id="snacks-body"></tbody>
    </table>
  `;
  const tbody = container.querySelector('#snacks-body');

  function render() {
    const today = new Date().toISOString().slice(0, 10);
    const practices = getEvents()
      .filter(e => e.type === 'practice')
      .sort((a, b) => a.date === b.date
        ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));
    const parents = getParents();

    tbody.innerHTML = practices.map(e => {
      const assignments = getSnackAssignmentsForEvent(e.id);
      const isUpcoming = e.date >= today && e.status === 'scheduled';
      const unassigned = isUpcoming && assignments.length === 0;
      const assignedList = assignments.map(sa => {
        const p = getParentById(sa.parentId);
        return `${p ? escapeHtml(p.name) : '(deleted parent)'}
          <button class="unassign-btn" data-sa="${sa.id}">×</button>`;
      }).join(', ');
      const assignedIds = new Set(assignments.map(sa => sa.parentId));
      const options = parents.filter(p => !assignedIds.has(p.id))
        .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

      return `
        <tr data-id="${e.id}" class="${unassigned ? 'unassigned-flag' : ''}">
          <td>${e.date}</td>
          <td>${e.startTime}</td>
          <td>${escapeHtml(e.location)}</td>
          <td>${assignedList || (unassigned ? '⚠️ Unassigned' : '—')}</td>
          <td>${options ? `<select class="assign-select">
              <option value="">+ assign parent…</option>${options}</select>` : '(no parents)'}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">No practices scheduled.</td></tr>';
  }

  tbody.addEventListener('click', (e) => {
    if (e.target.classList.contains('unassign-btn')) {
      deleteSnackAssignment(e.target.dataset.sa);
    }
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    if (e.target.classList.contains('assign-select') && e.target.value) {
      addSnackAssignment({ eventId: row.dataset.id, parentId: e.target.value });
    }
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### `js/views/fundraisers.js`

```js
import {
  getFundraisers, addFundraiser, updateFundraiser, deleteFundraiser,
  getFundraiserOccurrencesForFundraiser, addFundraiserOccurrence,
  updateFundraiserOccurrence, deleteFundraiserOccurrence,
  getFundraiserPlatforms, addFundraiserPlatform, getFundraiserPlatformById,
  subscribe
} from '../data.js';
import { escapeHtml, dollarsToCents } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Fundraisers</h2>
    <div id="fundraisers-list"></div>
    <h3>Add Fundraiser</h3>
    <form id="add-fundraiser-form">
      <input name="name" placeholder="Name" required />
      <select name="kind">
        <option value="uniforms">Uniforms</option>
        <option value="team_trip">Team Trip</option>
        <option value="general">General</option>
      </select>
      <select name="platformId" id="platform-select"><option value="">— In person —</option></select>
      <button type="button" id="new-platform-btn">+ New platform</button>
      <input name="goalAmount" type="number" step="0.01" placeholder="Goal $" />
      <button type="submit">Add Fundraiser</button>
    </form>
  `;

  const list = container.querySelector('#fundraisers-list');
  const form = container.querySelector('#add-fundraiser-form');
  const platformSelect = container.querySelector('#platform-select');

  function renderPlatformOptions(select, selectedId = '') {
    const opts = getFundraiserPlatforms().map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    select.innerHTML = `<option value="">— In person —</option>${opts}`;
  }

  function render() {
    renderPlatformOptions(platformSelect);
    const fundraisers = getFundraisers();
    list.innerHTML = fundraisers.map(f => {
      const pct = f.goalAmountCents > 0
        ? Math.min(100, Math.round(100 * f.raisedAmountCents / f.goalAmountCents)) : 0;
      const occurrences = getFundraiserOccurrencesForFundraiser(f.id);
      return `
        <div class="fundraiser-card" data-id="${f.id}">
          <input class="f-name" value="${escapeHtml(f.name)}" />
          <select class="f-status">
            ${['planned', 'active', 'completed', 'canceled'].map(s =>
              `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span>Platform:
            <select class="f-platform">
              <option value="">— In person —</option>${
                getFundraiserPlatforms().map(p => `<option value="${p.id}" ${p.id === f.platformId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')
              }</select>
          </span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          Raised $<input class="f-raised" type="number" step="0.01" value="${(f.raisedAmountCents / 100).toFixed(2)}" size="8" />
          / Goal $<input class="f-goal" type="number" step="0.01" value="${(f.goalAmountCents / 100).toFixed(2)}" size="8" />
          (${pct}%)
          <button class="delete-fundraiser-btn">Delete Fundraiser</button>
          <ul class="occurrence-list">
            ${occurrences.map(o => `
              <li data-occ="${o.id}">
                <input type="date" class="occ-start" value="${o.startDate}" />
                to <input type="date" class="occ-end" value="${o.endDate}" />
                <input class="occ-location" placeholder="Location" value="${escapeHtml(o.location)}" />
                <button class="delete-occ-btn">Remove</button>
              </li>`).join('')}
          </ul>
          <button class="add-occ-btn">+ Add date/occurrence</button>
        </div>`;
    }).join('') || '<p>No fundraisers yet.</p>';
  }

  list.addEventListener('click', (e) => {
    const card = e.target.closest('.fundraiser-card');
    if (!card) return;
    const fid = card.dataset.id;
    if (e.target.classList.contains('delete-fundraiser-btn')) {
      if (confirm('Delete this fundraiser and all its occurrences?')) deleteFundraiser(fid);
    }
    if (e.target.classList.contains('add-occ-btn')) {
      const today = new Date().toISOString().slice(0, 10);
      addFundraiserOccurrence({ fundraiserId: fid, startDate: today, endDate: today });
    }
    if (e.target.classList.contains('delete-occ-btn')) {
      deleteFundraiserOccurrence(e.target.closest('li').dataset.occ);
    }
  });

  list.addEventListener('change', (e) => {
    const card = e.target.closest('.fundraiser-card');
    if (!card) return;
    const fid = card.dataset.id;
    if (e.target.classList.contains('f-name')) updateFundraiser(fid, { name: e.target.value });
    if (e.target.classList.contains('f-status')) updateFundraiser(fid, { status: e.target.value });
    if (e.target.classList.contains('f-platform')) updateFundraiser(fid, { platformId: e.target.value || null });
    if (e.target.classList.contains('f-raised')) updateFundraiser(fid, { raisedAmountCents: dollarsToCents(e.target.value) });
    if (e.target.classList.contains('f-goal')) updateFundraiser(fid, { goalAmountCents: dollarsToCents(e.target.value) });

    const occLi = e.target.closest('li[data-occ]');
    if (occLi) {
      const oid = occLi.dataset.occ;
      if (e.target.classList.contains('occ-start')) updateFundraiserOccurrence(oid, { startDate: e.target.value });
      if (e.target.classList.contains('occ-end')) updateFundraiserOccurrence(oid, { endDate: e.target.value });
      if (e.target.classList.contains('occ-location')) updateFundraiserOccurrence(oid, { location: e.target.value });
    }
  });

  container.querySelector('#new-platform-btn').addEventListener('click', () => {
    const name = prompt('Platform name?');
    if (!name) return;
    const url = prompt('URL (optional)?') || '';
    const platform = addFundraiserPlatform({ name, url });
    renderPlatformOptions(platformSelect, platform.id);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addFundraiser({
      name: fd.get('name').trim(),
      kind: fd.get('kind'),
      platformId: fd.get('platformId') || null,
      goalAmountCents: dollarsToCents(fd.get('goalAmount') || '0'),
      raisedAmountCents: 0,
      status: 'planned'
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### `js/views/settings.js` (Stage 5 portion only — team name/season)

Stage 6 below extends this same file with backup/restore. Build this
minimal version first so Stage 5's gate can pass on its own.

```js
import { getSettings, updateSettings, subscribe } from '../data.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Settings</h2>
    <section>
      <label>Team name: <input id="team-name" /></label><br/>
      <label>Season: <input id="season" /></label>
    </section>
  `;
  const teamInput = container.querySelector('#team-name');
  const seasonInput = container.querySelector('#season');

  function render() {
    const s = getSettings();
    if (document.activeElement !== teamInput) teamInput.value = s.teamName;
    if (document.activeElement !== seasonInput) seasonInput.value = s.season;
  }

  teamInput.addEventListener('change', () => updateSettings({ teamName: teamInput.value }));
  seasonInput.addEventListener('change', () => updateSettings({ season: seasonInput.value }));

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

(The `document.activeElement !== input` guard on re-render matters here:
without it, typing in Team name would get clobbered mid-keystroke every
time `saveData()` fires a re-render from some other tab or view.)

### Stage 5 acceptance gate

- A full season's worth of data — several players, parents linked to
  players (including one parent linked to two siblings), practices and
  games with an opponent, snack assignments, a fundraiser with multiple
  occurrences — can be entered entirely through the UI.
- Reloading the page after entry shows all of it unchanged (proves
  everything routed through `data.js`).
- Deleting a parent removes their snack assignments and player links from
  the UI immediately, without a manual refresh, and without deleting the
  player.
- Deleting an opponent leaves its games visible with "no opponent" shown,
  not removed.
- The roster star toggle moves between players and clears correctly if the
  starred player is deleted.
- The Snacks view flags an unassigned upcoming practice and stops flagging
  it the moment a parent is assigned.

---

## Stage 6 — Backup & durability

This extends **existing** Stage 1 code in `js/data.js` — read the current
file before editing so these additions merge cleanly rather than duplicate
exports.

### Why this needs a schema migration

The nudge rule in the architecture (§7) is: show the nudge when data has
changed since the last backup **and** (it's been more than 3 days, **or**
more than 25 changes have piled up). The age check needs nothing new, but
the change-count check needs a counter that doesn't exist in the
`schemaVersion: 1` shape Stage 1 shipped. This is exactly the situation
`migrate()` was built for (§9.4) — so Stage 6 is where it gets used for the
first time.

**Bump `SCHEMA_VERSION` to `2`.** Add `meta.changesSinceBackup: 0` to
`emptyData()`, and write the migration branch that backfills it for any
store still at version 1:

```js
// js/data.js — CHANGE
const SCHEMA_VERSION = 2;   // was 1

// emptyData() — CHANGE: add changesSinceBackup to meta
function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { lastModifiedAt: null, lastBackupAt: null, changesSinceBackup: 0 },
    settings: { teamName: '', season: '', myPlayerId: null },
    players: [], parents: [], playerParents: [], opponents: [],
    events: [], snackAssignments: [],
    fundraiserPlatforms: [], fundraisers: [], fundraiserOccurrences: []
  };
}

// migrate() — CHANGE: replace the v1 pass-through with a real v1 -> v2 step
function migrate(data) {
  if (data.schemaVersion < 2) {
    data.meta.changesSinceBackup = data.meta.changesSinceBackup ?? 0;
    data.schemaVersion = 2;
  }
  // Pass-through at schemaVersion 2. Next migration branches here.
  return data;
}
```

### `saveData()` — CHANGE: make the change-counter optional

The counter should increment on every real data mutation, but **not** on
the bookkeeping save `exportBackup()` does right after it resets the
counter to zero (otherwise every backup would immediately show "1 change
since backup"). Add an options param with a backward-compatible default so
every existing call site in Stage 1–5 code keeps working unmodified:

```js
// js/data.js — CHANGE saveData() signature
export function saveData({ countAsChange = true } = {}) {
  _cache.meta.lastModifiedAt = new Date().toISOString();
  if (countAsChange) {
    _cache.meta.changesSinceBackup = (_cache.meta.changesSinceBackup || 0) + 1;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
}
```

Every other existing call to `saveData()` (inside `addRecord`,
`updateRecord`, `removeRecord`, `updateSettings`, and every `delete*`
function) is fine as-is — it'll now count as a change by default, which is
exactly what we want.

### New exports: backup, restore, nudge check

```js
// js/data.js — ADD
export function exportBackup() {
  const d = getData();
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  d.meta.lastBackupAt = new Date().toISOString();
  d.meta.changesSinceBackup = 0;
  saveData({ countAsChange: false });
}

export async function importBackup(file) {
  const parsed = migrate(JSON.parse(await file.text()));
  _cache = parsed;
  saveData({ countAsChange: false });
  _subs.forEach(fn => fn());
}

export function backupNudgeDue() {
  const { meta } = getData();
  if (!meta.lastModifiedAt) return false;
  if (!meta.lastBackupAt) return true;
  const modifiedSinceBackup = Date.parse(meta.lastModifiedAt) > Date.parse(meta.lastBackupAt);
  const ageDays = (Date.parse(meta.lastModifiedAt) - Date.parse(meta.lastBackupAt)) / 864e5;
  const changeCount = meta.changesSinceBackup || 0;
  return modifiedSinceBackup && (ageDays > 3 || changeCount > 25);
}
```

Note `importBackup` also uses `countAsChange: false` — a restore isn't a
"change" the admin made, it's a known-good state coming back in.

### `js/views/settings.js` — extend with the backup section

Replace the Stage 5 version of this file with the full version below (team
name/season logic is unchanged, backup section is new):

```js
import {
  getSettings, updateSettings, subscribe,
  exportBackup, importBackup, getData, backupNudgeDue
} from '../data.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Settings</h2>
    <section>
      <label>Team name: <input id="team-name" /></label><br/>
      <label>Season: <input id="season" /></label>
    </section>

    <section class="backup-section">
      <h3>Backup</h3>
      <p id="last-backup-status"></p>
      <button id="export-backup-btn">Export Backup (.json)</button>
      <label class="import-label">
        Import Backup: <input type="file" id="import-backup-input" accept="application/json" />
      </label>
      <p class="warning">
        ⚠️ The backup file contains player and parent contact info in plain
        text. Store it somewhere private — not a shared drive or an email
        account you don't control.
      </p>
    </section>
  `;

  const teamInput = container.querySelector('#team-name');
  const seasonInput = container.querySelector('#season');
  const statusEl = container.querySelector('#last-backup-status');
  const exportBtn = container.querySelector('#export-backup-btn');
  const importInput = container.querySelector('#import-backup-input');

  function render() {
    const s = getSettings();
    if (document.activeElement !== teamInput) teamInput.value = s.teamName;
    if (document.activeElement !== seasonInput) seasonInput.value = s.season;

    const { meta } = getData();
    if (!meta.lastBackupAt) {
      statusEl.textContent = 'Last backup: never';
    } else {
      const days = Math.floor((Date.now() - Date.parse(meta.lastBackupAt)) / 864e5);
      statusEl.textContent = `Last backup: ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}`;
    }
    statusEl.classList.toggle('nudge', backupNudgeDue());
  }

  teamInput.addEventListener('change', () => updateSettings({ teamName: teamInput.value }));
  seasonInput.addEventListener('change', () => updateSettings({ season: seasonInput.value }));

  exportBtn.addEventListener('click', () => exportBackup());

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    const ok = confirm(
      'Importing will REPLACE all current data with the contents of this backup file. This cannot be undone. Continue?'
    );
    if (ok) {
      await importBackup(file);
      alert('Backup imported.');
    }
    importInput.value = '';
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

### New file: `js/nudge.js` (app-wide banner)

```js
import { backupNudgeDue, subscribe } from './data.js';

export function initNudgeBanner(bannerEl) {
  function render() {
    if (backupNudgeDue()) {
      bannerEl.hidden = false;
      bannerEl.innerHTML = `⚠️ You have unsaved changes since your last backup. ` +
        `Go to <a href="#/settings">Settings</a> to export a backup.`;
    } else {
      bannerEl.hidden = true;
    }
  }
  subscribe(render);
  render();
}
```

This is what `index.html` (Stage 4) already imports and calls
`initNudgeBanner(document.getElementById('nudge-banner'))` on — no further
`index.html` changes needed in this stage.

### Stage 6 acceptance gate

- Clicking **Export Backup** downloads `stm-backup-YYYY-MM-DD.json`
  containing the full store, `schemaVersion: 2`, and resets "Last backup"
  to "today" immediately.
- Making 26+ small edits without exporting causes the nudge banner to
  appear app-wide (visible from every view, not just Settings); exporting
  makes it disappear again.
- Waiting (or manually editing `meta.lastModifiedAt`/`lastBackupAt` in
  the console to simulate 4+ days apart) also triggers the nudge on its own,
  independent of change count.
- Importing that exported file into a **different** browser profile (or
  after clearing site data) reproduces the full store exactly, after the
  confirm dialog.
- Hand-construct a minimal `schemaVersion: 1` JSON file (no
  `changesSinceBackup` field, matching what Stage 1–5 would have produced
  before this stage existed) and import it — it must load without throwing
  and end up at `schemaVersion: 2` with `changesSinceBackup: 0`.
- Canceling the import confirm dialog leaves existing data completely
  untouched.

---

## Stop point

Once Stage 6's gate passes, **stop**. Vendored export libraries (SheetJS,
jsPDF), the date-range Excel/PDF export, and the final hardening/deploy
pass are separate follow-up stages and out of scope for this handoff.
