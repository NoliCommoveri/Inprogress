# Football Manager — Claude Code Build Instructions (Stages 0–3)

You are building the **storage foundation** of a static HTML/JS app called
Football Manager. No backend, no build step, hosted on GitHub Pages,
single admin user, all data in `localStorage`. Full context is in
`FootballManager_Architecture.md` if you have access to it — this document
is self-contained for Stages 0–3 and repeats everything you need.

**The repo already exists and GitHub Pages is already enabled** (deploying
from `main`, root). Do not attempt repo creation or Pages configuration.
Your job is the file tree, the storage layer, and cross-tab sync + seeding.

## Hard rules (do not violate these)

1. **UI code never touches `localStorage` directly.** Every read/write goes
   through `js/data.js`. This rule is why the storage layer gets built
   first — get it right and it stays true for the rest of the app.
2. **No build step.** Vanilla ES modules (`<script type="module">`), no
   bundler, no transpilation, no npm install for app code.
3. **No third-party scripts of any kind at this stage** — no CDN, no
   analytics. (Vendored export libs come in a later stage, out of scope
   here.)
4. **Money is integer cents everywhere**, never floats.
5. **Every record carries `updatedAt`** (ISO string), stamped by mutating
   helpers only — never set by hand elsewhere.
6. Stop after Stage 3's acceptance gate passes. Do not start on routing,
   views, or export — those are separate follow-up stages.

---

## Stage 0 — File tree & placeholder shell

Create this structure:

```
/index.html
/css/styles.css
/.gitignore
/js/
  data.js
  export.js
  router.js
  seed.js
  vendor/
    .gitkeep
  views/
    roster.js
    parents.js
    schedule.js
    snacks.js
    fundraisers.js
    settings.js
```

- `export.js`, `router.js`, and every file under `views/` are **stubs only**
  at this stage — a top comment saying what they'll hold and which stage
  builds them. Do not implement any logic in them yet.
- `css/styles.css` can be empty or near-empty for now.
- `js/vendor/.gitkeep` just keeps the empty dir in git (vendored libs land
  in a later stage).

**`.gitignore`:**
```
.DS_Store
Thumbs.db
*.log
```

**`index.html`** — minimal shell that boots the storage layer and seeding,
and proves modules load with no build step:

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
  <div id="app">Loading…</div>
  <script type="module">
    import { getData } from './js/data.js';
    import { seedIfNeeded } from './js/seed.js';

    seedIfNeeded();
    console.log('[Football Manager] boot OK, data =', getData());
  </script>
</body>
</html>
```

### Stage 0 acceptance gate
- Serve the folder with any static server (`npx serve`, `python3 -m
  http.server`, etc. — ES modules need `http://`, not `file://`, in most
  browsers) and open it.
- Console shows `[Football Manager] boot OK, data = {...}` with no 404s on
  any module import.

---

## Stage 1 — Storage core (`js/data.js`, part 1)

Build and verify this in isolation before anything else touches it.

### Full data shape

```js
{
  schemaVersion: 1,
  meta: {
    lastModifiedAt: null,   // ISO string; stamped on every save
    lastBackupAt: null      // ISO string; unused until the backup stage
  },
  settings: {
    teamName: "",
    season: "",
    myPlayerId: null
  },
  players: [],
  parents: [],
  playerParents: [],
  opponents: [],
  events: [],
  snackAssignments: [],
  fundraiserPlatforms: [],
  fundraisers: [],
  fundraiserOccurrences: []
}
```

### Implement in `data.js`

```js
const STORAGE_KEY = 'stm:v1';
const SCHEMA_VERSION = 1;

let _cache = null;
const _subs = new Set(); // () => void, called after an external (cross-tab) change

// ---------- UUID ----------
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // fallback for insecure contexts (e.g. opened via file://)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- Empty shape ----------
function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { lastModifiedAt: null, lastBackupAt: null },
    settings: { teamName: '', season: '', myPlayerId: null },
    players: [], parents: [], playerParents: [], opponents: [],
    events: [], snackAssignments: [],
    fundraiserPlatforms: [], fundraisers: [], fundraiserOccurrences: []
  };
}

// ---------- Migration ----------
function migrate(data) {
  // Pass-through at schemaVersion 1. When a future change requires a
  // migration: branch on data.schemaVersion, mutate `data` in place, bump
  // data.schemaVersion, return it. Every load path (loadData, the storage
  // listener, and the future importBackup) must route through this.
  return data;
}

// ---------- Boot / cache / persistence ----------
export function getData() {          // always returns the live in-memory copy
  if (!_cache) loadData();
  return _cache;
}

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  _cache = raw ? migrate(JSON.parse(raw)) : emptyData();
  return _cache;
}

export function saveData() {
  _cache.meta.lastModifiedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
}

export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }
```

### Stage 1 acceptance gate (test in the browser console)
```js
import * as data from './js/data.js';
data.loadData();        // fresh origin → returns the full emptyData() shape
data.saveData();        // persists it
// reload the page, then:
data.getData();         // rehydrates the same object
```

---

## Stage 2 — Integrity-enforcing mutations (`js/data.js`, part 2)

This is the whole point of the storage boundary: views never worry about
referential integrity because every add/update/delete goes through here.

### Internal helpers (add once, reuse for every entity)

```js
function touch(rec) { rec.updatedAt = new Date().toISOString(); return rec; }

function addRecord(arr, fields) {
  const rec = touch({ id: uuid(), ...fields });
  arr.push(rec);
  saveData();
  return rec;
}

function updateRecord(arr, id, patch) {
  const rec = arr.find(r => r.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  touch(rec);
  saveData();
  return rec;
}

function removeRecord(arr, id) {
  const idx = arr.findIndex(r => r.id === id);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  saveData();
  return true;
}
```

### Settings (singleton, not a collection)

```js
export function getSettings() { return getData().settings; }
export function updateSettings(patch) {
  Object.assign(getData().settings, patch);
  saveData();
  return getData().settings;
}
```

### Player
```js
export function addPlayer({ firstName = '', lastName = '', jerseyNumber = '',
    position = '', active = true, outstandingBalanceCents = 0 } = {}) {
  return addRecord(getData().players,
    { firstName, lastName, jerseyNumber, position, active, outstandingBalanceCents });
}
export function updatePlayer(id, patch) { return updateRecord(getData().players, id, patch); }
export function getPlayers() { return getData().players; }
export function getPlayerById(id) { return getData().players.find(p => p.id === id) || null; }
```

### Parent
```js
export function addParent({ name = '', phone = '', email = '' } = {}) {
  return addRecord(getData().parents, { name, phone, email });
}
export function updateParent(id, patch) { return updateRecord(getData().parents, id, patch); }
export function getParents() { return getData().parents; }
export function getParentById(id) { return getData().parents.find(p => p.id === id) || null; }
```

### PlayerParent (join, many-to-many)
```js
export function addPlayerParent({ playerId, parentId, relationship = '' }) {
  return addRecord(getData().playerParents, { playerId, parentId, relationship });
}
export function updatePlayerParent(id, patch) { return updateRecord(getData().playerParents, id, patch); }
export function deletePlayerParent(id) { return removeRecord(getData().playerParents, id); }
export function getPlayerParentsForPlayer(playerId) {
  return getData().playerParents.filter(pp => pp.playerId === playerId);
}
export function getPlayerParentsForParent(parentId) {
  return getData().playerParents.filter(pp => pp.parentId === parentId);
}
```

### Opponent
```js
export function addOpponent({ name = '', homeLocation = '' } = {}) {
  return addRecord(getData().opponents, { name, homeLocation });
}
export function updateOpponent(id, patch) { return updateRecord(getData().opponents, id, patch); }
export function getOpponents() { return getData().opponents; }
export function getOpponentById(id) { return getData().opponents.find(o => o.id === id) || null; }
```

### Event (games + practices, unified)
```js
export function addEvent({ type, date, startTime, endTime = '', location = '',
    opponentId = null, status = 'scheduled', finalScoreUs = null,
    finalScoreOpponent = null, notes = '' }) {
  return addRecord(getData().events,
    { type, date, startTime, endTime, location, opponentId, status,
      finalScoreUs, finalScoreOpponent, notes });
}
export function updateEvent(id, patch) { return updateRecord(getData().events, id, patch); }
export function getEvents() { return getData().events; }
export function getEventById(id) { return getData().events.find(e => e.id === id) || null; }
```

### SnackAssignment
```js
export function addSnackAssignment({ eventId, parentId, notes = '' }) {
  return addRecord(getData().snackAssignments, { eventId, parentId, notes });
}
export function updateSnackAssignment(id, patch) { return updateRecord(getData().snackAssignments, id, patch); }
export function deleteSnackAssignment(id) { return removeRecord(getData().snackAssignments, id); }
export function getSnackAssignmentsForEvent(eventId) {
  return getData().snackAssignments.filter(sa => sa.eventId === eventId);
}
```

### FundraiserPlatform
```js
export function addFundraiserPlatform({ name = '', url = '' } = {}) {
  return addRecord(getData().fundraiserPlatforms, { name, url });
}
export function updateFundraiserPlatform(id, patch) { return updateRecord(getData().fundraiserPlatforms, id, patch); }
export function getFundraiserPlatforms() { return getData().fundraiserPlatforms; }
export function getFundraiserPlatformById(id) {
  return getData().fundraiserPlatforms.find(p => p.id === id) || null;
}
```

### Fundraiser
```js
export function addFundraiser({ kind = 'general', name = '', platformId = null,
    goalAmountCents = 0, raisedAmountCents = 0, status = 'planned', notes = '' } = {}) {
  return addRecord(getData().fundraisers,
    { kind, name, platformId, goalAmountCents, raisedAmountCents, status, notes });
}
export function updateFundraiser(id, patch) { return updateRecord(getData().fundraisers, id, patch); }
export function getFundraisers() { return getData().fundraisers; }
export function getFundraiserById(id) { return getData().fundraisers.find(f => f.id === id) || null; }
```

### FundraiserOccurrence
```js
export function addFundraiserOccurrence({ fundraiserId, startDate, endDate, location = '', notes = '' }) {
  return addRecord(getData().fundraiserOccurrences, { fundraiserId, startDate, endDate, location, notes });
}
export function updateFundraiserOccurrence(id, patch) {
  return updateRecord(getData().fundraiserOccurrences, id, patch);
}
export function deleteFundraiserOccurrence(id) {
  return removeRecord(getData().fundraiserOccurrences, id);
}
export function getFundraiserOccurrencesForFundraiser(fundraiserId) {
  return getData().fundraiserOccurrences.filter(o => o.fundraiserId === fundraiserId);
}
```

### Delete helpers with cascade/nullify strategy (the important part)

```js
// --- Parent: cascade join rows, DROP snack assignments (meaningless without a parent) ---
export function deleteParent(parentId) {
  const d = getData();
  d.playerParents = d.playerParents.filter(pp => pp.parentId !== parentId);
  d.snackAssignments = d.snackAssignments.filter(sa => sa.parentId !== parentId);
  d.parents = d.parents.filter(p => p.id !== parentId);
  saveData();
}

// --- Player: cascade its join rows, clear "my player" if it matched ---
export function deletePlayer(playerId) {
  const d = getData();
  d.playerParents = d.playerParents.filter(pp => pp.playerId !== playerId);
  if (d.settings.myPlayerId === playerId) d.settings.myPlayerId = null;
  d.players = d.players.filter(p => p.id !== playerId);
  saveData();
}

// --- Event: cascade its snack assignments ---
export function deleteEvent(eventId) {
  const d = getData();
  d.snackAssignments = d.snackAssignments.filter(sa => sa.eventId !== eventId);
  d.events = d.events.filter(e => e.id !== eventId);
  saveData();
}

// --- Opponent: NULLIFY from games — keep the game, just drop the opponent link ---
export function deleteOpponent(opponentId) {
  const d = getData();
  d.events.forEach(e => { if (e.opponentId === opponentId) { e.opponentId = null; touch(e); } });
  d.opponents = d.opponents.filter(o => o.id !== opponentId);
  saveData();
}

// --- Fundraiser: cascade its occurrences ---
export function deleteFundraiser(fundraiserId) {
  const d = getData();
  d.fundraiserOccurrences = d.fundraiserOccurrences.filter(o => o.fundraiserId !== fundraiserId);
  d.fundraisers = d.fundraisers.filter(f => f.id !== fundraiserId);
  saveData();
}

// --- Platform: NULLIFY from fundraisers — keep the fundraiser ---
export function deletePlatform(platformId) {
  const d = getData();
  d.fundraisers.forEach(f => { if (f.platformId === platformId) { f.platformId = null; touch(f); } });
  d.fundraiserPlatforms = d.fundraiserPlatforms.filter(p => p.id !== platformId);
  saveData();
}
```

### Stage 2 acceptance gate
Script this scenario in the console and confirm no dangling references and
no thrown errors:
1. `addPlayer`, `addParent`, `addPlayerParent` linking them, `addEvent`,
   `addSnackAssignment` on that event/parent.
2. `deleteParent(parentId)` → the `playerParents` row and the
   `snackAssignments` row for that parent are both gone; the player itself
   still exists.
3. `deleteOpponent(opponentId)` on an event that referenced it → the event
   still exists with `opponentId: null` (not deleted).
4. `deletePlayer(playerId)` where `settings.myPlayerId` pointed at it →
   `settings.myPlayerId` is now `null`.
5. Confirm money fields (`outstandingBalanceCents`, `goalAmountCents`,
   `raisedAmountCents`) only ever hold integers in your test data.

---

## Stage 3 — Cross-tab sync + first-run seeding

### Cross-tab sync (add to `data.js`)

The `storage` event fires in **other** tabs when our key changes. Reload the
cache and notify subscribers so a second tab can't silently clobber the
first. No merge/CRDT logic needed — single user, single source of truth per
tab-refresh.

```js
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  _cache = e.newValue ? migrate(JSON.parse(e.newValue)) : emptyData();
  _subs.forEach(fn => fn());
});
```

(Future views should read via `getData()` on every render and register a
`subscribe()` callback rather than caching records locally — that's a
Stage 4+ concern, just noting it so the contract is clear.)

### First-run seeding (`js/seed.js`)

```js
import { getData, saveData, addFundraiserPlatform } from './data.js';

const DEFAULT_PLATFORMS = ['DoubleGood', 'GoFundMe', 'Snap! Raise'];

export function seedIfNeeded() {
  const alreadyRan = localStorage.getItem('stm:v1') !== null;
  if (alreadyRan) return;

  // Force-create and persist the empty shape so a real 'stm:v1' key exists
  // even if the admin adds nothing on the very first visit.
  getData();
  saveData();

  DEFAULT_PLATFORMS.forEach(name => addFundraiserPlatform({ name }));
  // opponents deliberately stay empty — no sensible default list (§7)
}
```

`index.html` already calls `seedIfNeeded()` before `getData()` logging (see
Stage 0), so seeding is wired into boot and runs exactly once per origin.

### Stage 3 acceptance gate
- **Fresh origin test**: clear site data (or use a private window against
  the served URL), load the page. Console log shows `fundraiserPlatforms`
  populated with the three defaults and `opponents: []`.
- **Cross-tab test**: open the page in two tabs. In tab A's console, run
  something like `data.addOpponent({ name: 'Test FC' })`. In tab B, confirm
  a `subscribe()` callback fires and `getData().opponents` in tab B now
  includes `'Test FC'` without a manual reload. (You can register a quick
  `subscribe(() => console.log('B saw a change', getData()))` in tab B's
  console to observe this.)
- Reloading either tab still rehydrates the full, current store.

---

## Stop point

Once Stage 3's gate passes, **stop**. Routing (`router.js`), the CRUD views,
vendored export libraries, the date-range export, and backup/restore are
separate follow-up stages and are out of scope for this handoff.
