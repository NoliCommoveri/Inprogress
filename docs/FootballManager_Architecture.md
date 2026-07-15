# Football Manager — Architecture & Data Design

Static HTML/JS app, hosted on GitHub Pages, **single admin user**, no backend.
Data persists in the browser via `localStorage`. This document is the spec to
build against.

---

## 1. Product Decision & The localStorage Constraint

Football Manager is a **personal admin tool for one team manager**. The admin
tracks roster, schedule, snack duty, and fundraisers, then **manually texts**
parents. Parents never open the app. Contact fields (phone/email) exist so the
admin has them on hand to text/call — not for any login or self-service.

Because there is no backend, **all data lives only in this one admin's browser
profile**. Consequences the build must respect:

- **No auth.** `settings.myPlayerId` is just a highlight preference.
- **localStorage is not durable** — see below. Backup is a first-class feature,
  not an afterthought.
- If shared/parent-facing access is ever wanted, that's a different product;
  the storage boundary in §9 keeps that swap cheap, but it's explicitly out of
  scope now.

### 1.1 Durability — treat localStorage as cache, not a database

localStorage can be wiped without warning by any of:
- "Clear browsing data" / clearing cookies+site data.
- Private/incognito sessions (nothing persists).
- Storage-pressure eviction under low disk.
- **Safari/iOS ITP: localStorage for a site is evicted after ~7 days of no
  visits.** For a weekly-use tool this is a live data-loss path.
- **Origin change:** localStorage is keyed to exact origin. Moving from
  `you.github.io/repo` to a custom domain (or a different repo) = different
  origin = data does **not** follow. Only an export/import bridges that.

Mitigations (see §7):
1. Backup = export the whole store to a `.json` file; import restores it.
2. A visible **"Last backup: N days ago"** indicator in Settings.
3. A **nudge banner** when there are unsaved-to-disk changes older than a
   threshold (default: modified since last backup **and** >3 days, or >25
   changes).
4. Optional **auto-backup**: offer a one-tap download whenever the nudge fires.

---

## 2. Tech Stack

- Vanilla HTML/CSS/JS, **no build step** — keeps GitHub Pages trivial.
- App code as native **ES modules** (`<script type="module">`); GitHub Pages
  serves these fine. No bundler.
- Single-page shell (`index.html`) + **hash routing** (`#/roster`,
  `#/schedule`, …) — hash routing avoids the deep-link 404 problem on Pages.
- `localStorage` as the only store, behind one `data.js` module (§9).
- **Vendored libraries only.** The Excel/PDF exporters need SheetJS and jsPDF.
  Because the origin holds family PII, we do **not** load these from a CDN.
  Download each library once, commit the single file into `/js/vendor/`, and
  load it with a local `<script>`. No third-party origin ever executes in the
  page, so nothing external can read localStorage.
  - `js/vendor/xlsx.full.min.js` — SheetJS Community Edition v0.18.5, vendored
    2026-07-15 (via the `xlsx` npm tarball's `dist/` build — SheetJS's own
    `cdn.sheetjs.com`, which hosts newer 0.20.x builds, was unreachable from
    the build environment's network policy; 0.18.5 is the latest version
    SheetJS still publishes to the npm registry and is the same official
    `dist/xlsx.full.min.js` artifact, just an older pin).
  - `js/vendor/jspdf.umd.min.js` — jsPDF v4.2.1, vendored 2026-07-15 (via the
    `jspdf` npm tarball, current stable at vendor time).
- **No other third-party scripts** (no analytics, no CDN fonts/CSS that execute
  JS). This is a hard rule while PII lives in localStorage.

---

## 3. Storage Layout

Single namespaced root object, versioned:

```
localStorage key: "stm:v1"

{
  "schemaVersion": 1,
  "meta": {
    "lastModifiedAt": null,   // ISO string; stamped on every save
    "lastBackupAt": null      // ISO string; set when a backup is exported
  },
  "settings": {
    "teamName": "",
    "season": "",
    "myPlayerId": null
  },
  "players": [],
  "parents": [],
  "playerParents": [],
  "opponents": [],
  "events": [],
  "snackAssignments": [],
  "fundraiserPlatforms": [],
  "fundraisers": [],
  "fundraiserOccurrences": []
}
```

`schemaVersion` drives a migration function on load (§9.4). `data.js` exposes
`loadData()`, `saveData()`, typed getters, and **mutating helpers that enforce
integrity** — UI code never touches `localStorage` and never deletes raw
records without going through the helpers.

---

## 4. Entity Schema

Every record carries `updatedAt` (ISO string), stamped by the mutating helpers.
It aids sorting, debugging, and cross-tab conflict detection.
**All money is integer cents** (e.g. `$50.00` → `5000`) to avoid float drift.

### Player
```js
{
  id: "uuid",
  firstName: "",
  lastName: "",
  jerseyNumber: "",   // string — handles "00" / leading zeros
  position: "",       // free text; offer a datalist of common positions
  active: true,       // roster turnover without deleting history
  outstandingBalanceCents: 0,  // integer cents; money owed by this player's
                                // family (dues, uniform cost, etc). Admin-
                                // editable directly in the Roster view — a
                                // separate concept from the Fundraiser totals
                                // below, which stay aggregate across the team.
  updatedAt: "ISO"
}
```
`settings.myPlayerId` points to the admin's own player (single flag, not
per-row state).

### Parent
```js
{ id, name: "", phone: "", email: "", updatedAt }   // email optional
```

### PlayerParent (join, many-to-many)
```js
{ id, playerId, parentId, relationship: "", updatedAt }  // "Mom"/"Dad"/"Guardian" optional
```
Multiple parents per player, and one parent across siblings.

### Opponent (seed list / dropdown)
```js
{ id, name: "", homeLocation: "", updatedAt }   // homeLocation optional
```

### Event (games + practices, unified)
```js
{
  id, type: "practice" | "game",
  date: "YYYY-MM-DD",           // string — sidesteps timezone bugs
  startTime: "HH:MM",
  endTime: "HH:MM",             // optional
  location: "",
  opponentId: "uuid|null",      // games only
  status: "scheduled" | "canceled" | "completed",
  finalScoreUs: null,           // number, completed games only
  finalScoreOpponent: null,     // number, completed games only
  notes: "",
  updatedAt: "ISO"
}
```
One table for both types → single sort-by-`date`+`startTime` query for
calendar/list/export. Game-only fields hidden for practices.

### SnackAssignment
```js
{ id, eventId, parentId, notes: "", updatedAt }   // notes e.g. "orange slices + water"
```
Not unique on `eventId` — supports multiple snack parents per event.

### FundraiserPlatform (seed list, add-new inline)
```js
{ id, name: "", url: "", updatedAt }   // url optional; e.g. "DoubleGood"
```

### Fundraiser
```js
{
  id,
  kind: "uniforms" | "team_trip" | "general" | string,  // free text allowed
  name: "",
  platformId: "uuid|null",     // null for purely in-person
  goalAmountCents: 0,          // integer cents
  raisedAmountCents: 0,        // integer cents; aggregate, not per player
  status: "planned" | "active" | "completed" | "canceled",
  notes: "",
  updatedAt: "ISO"
}
```

### FundraiserOccurrence
```js
{
  id, fundraiserId,
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",       // == startDate for single-day
  location: "",                // in-person only
  notes: "",
  updatedAt: "ISO"
}
```
Continuous online campaign → one occurrence spanning the range. Recurring
in-person (three car-wash Saturdays) → three occurrences under one fundraiser.
`goal/raisedAmountCents` stay on the parent Fundraiser (track overall).

---

## 5. Relationships

```
Player 1───* PlayerParent *───1 Parent
Event  *───1 Opponent               (games only)
Event  1───* SnackAssignment *───1 Parent
Fundraiser 1───* FundraiserOccurrence
Fundraiser *───1 FundraiserPlatform (optional)
```

---

## 6. File Structure

```
/index.html
/css/styles.css
/js/
  data.js            // load/save/migrate, integrity-enforcing helpers, cross-tab sync
  export.js          // date-range .xlsx + .pdf, and full-store JSON backup/restore
  router.js          // hash-based view switching
  seed.js            // default platforms on first run
  vendor/
    xlsx.full.min.js // SheetJS (vendored, pinned)
    jspdf.umd.min.js // jsPDF   (vendored, pinned)
  views/
    roster.js
    parents.js
    schedule.js      // games + practices, shared list/calendar
    snacks.js
    fundraisers.js
    settings.js      // team name, backup status, export/import, range export, "my player"
```

---

## 7. Key Workflows

- **First-run seeding**: no `stm:v1` key → create empty store, seed a few
  `fundraiserPlatforms` (e.g. DoubleGood); leave `opponents` empty. Every
  dropdown has inline "add new".
- **Backup / durability (see §1.1)**:
  - Settings shows **"Last backup: N days ago"** from `meta.lastBackupAt`.
  - Nudge banner when `meta.lastModifiedAt > meta.lastBackupAt` **and**
    (age > 3 days OR change-count > 25).
  - **Export backup** → downloads the entire `stm:v1` object as
    `stm-backup-YYYY-MM-DD.json`, then sets `meta.lastBackupAt`.
  - **Import backup** → validates `schemaVersion`, migrates if older, replaces
    the store (confirm first — it overwrites).
  - ⚠️ The backup `.json` contains contact info in **plaintext**. Surface a
    one-line warning near the button so the admin stores it somewhere private.
- **"My player" highlight**: star toggle sets `settings.myPlayerId`; roster and
  schedule highlight that player.
- **Snack schedule view**: filter Events `type=practice`, show assigned parent,
  flag unassigned upcoming practices.
- **Fundraiser progress**: `raisedAmountCents / goalAmountCents` progress bar;
  occurrences listed underneath with date ranges/locations.
- **Date-range export** (see §8): pick start/end → download `.xlsx` (whole
  range, one row per event) and/or `.pdf` (blocked by event).

---

## 8. Date-Range Export (`export.js`)

Goal: the admin picks a start and end date and gets **(a)** an Excel workbook
of every event in the range and **(b)** a PDF where each event is its own
info block. Both resolve foreign keys to human-readable names (opponent, snack
parent + phone) and tolerate missing references.

Note: `Player.outstandingBalanceCents` (§4) is a static per-player fact, not
tied to a date range, so it is intentionally **not** part of this export. If a
roster/balance export is wanted later, that's a separate sheet/report, not a
column folded into the schedule export.

### 8.1 Shared range query + resolvers

```js
// export.js  (ES module)
import {
  getData, getEventById, getOpponentById,
  getParentById, getSnackAssignmentsForEvent
} from './data.js';

const pad = n => String(n).padStart(2, '0');
const centsToStr = c => `$${(c / 100).toFixed(2)}`;

// inclusive range, sorted by date then start time
export function getEventsInRange(startDate, endDate) {
  const { events } = getData();
  return events
    .filter(e => e.date >= startDate && e.date <= endDate)
    .sort((a, b) =>
      a.date === b.date
        ? (a.startTime || '').localeCompare(b.startTime || '')
        : a.date.localeCompare(b.date));
}

// flatten one event into display-ready fields (all refs resolved + tolerant)
function resolveEvent(e) {
  const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
  const snacks = getSnackAssignmentsForEvent(e.id).map(sa => {
    const p = getParentById(sa.parentId);
    return {
      parent: p ? p.name : '(deleted parent)',
      phone: p ? p.phone : '',
      notes: sa.notes || ''
    };
  });
  const score = (e.type === 'game' && e.status === 'completed'
    && e.finalScoreUs != null && e.finalScoreOpponent != null)
    ? `${e.finalScoreUs}–${e.finalScoreOpponent}` : '';
  return {
    date: e.date,
    type: e.type,
    time: e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime,
    opponent: opp ? opp.name : (e.type === 'game' ? '(unknown)' : ''),
    location: e.location || (opp && opp.homeLocation) || '',
    status: e.status,
    score,
    snacks,
    notes: e.notes || ''
  };
}

function fileStamp(startDate, endDate) {
  return `${startDate}_to_${endDate}`;
}
```

### 8.2 Excel — whole range, one row per event

```js
// requires vendored SheetJS on window.XLSX
export function exportRangeToXlsx(startDate, endDate) {
  const rows = getEventsInRange(startDate, endDate).map(e => {
    const r = resolveEvent(e);
    return {
      Date: r.date,
      Day: new Date(r.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' }),
      Type: r.type,
      Time: r.time,
      Opponent: r.opponent,
      Location: r.location,
      Status: r.status,
      Score: r.score,
      'Snack Parent': r.snacks.map(s => s.parent).join('; '),
      'Snack Phone': r.snacks.map(s => s.phone).filter(Boolean).join('; '),
      Notes: r.notes
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['Date','Day','Type','Time','Opponent','Location','Status','Score','Snack Parent','Snack Phone','Notes']
  });
  ws['!cols'] = [
    { wch: 11 }, { wch: 5 }, { wch: 9 }, { wch: 14 }, { wch: 20 },
    { wch: 24 }, { wch: 11 }, { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 40 }
  ];

  // Optional 2nd sheet: fundraiser occurrences overlapping the range
  const { fundraiserOccurrences, fundraisers } = getData();
  const fRows = fundraiserOccurrences
    .filter(o => o.startDate <= endDate && o.endDate >= startDate)
    .map(o => {
      const f = fundraisers.find(x => x.id === o.fundraiserId);
      return {
        Fundraiser: f ? f.name : '(deleted)',
        Start: o.startDate, End: o.endDate,
        Location: o.location || '',
        Goal: f ? centsToStr(f.goalAmountCents) : '',
        Raised: f ? centsToStr(f.raisedAmountCents) : '',
        Notes: o.notes || ''
      };
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Events');
  if (fRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fRows), 'Fundraisers');
  }
  XLSX.writeFile(wb, `schedule_${fileStamp(startDate, endDate)}.xlsx`);
}
```

### 8.3 PDF — blocked by event

Each event is a self-contained block: bold header (weekday, date, type, time),
then labeled lines. Handles pagination when a block would overflow the page.

```js
// requires vendored jsPDF on window.jspdf
export function exportRangeToPdf(startDate, endDate, teamName = '') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const M = 48;                       // margin
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const line = (text, { size = 10, bold = false, gap = 14, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const wrapped = doc.splitTextToSize(text, W - M * 2 - indent);
    wrapped.forEach(t => {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(t, M + indent, y);
      y += gap;
    });
  };

  // title
  line(`${teamName ? teamName + ' — ' : ''}Schedule ${startDate} to ${endDate}`,
       { size: 15, bold: true, gap: 22 });

  const events = getEventsInRange(startDate, endDate);
  if (!events.length) { line('No events in this range.'); }

  events.forEach(e => {
    const r = resolveEvent(e);
    // keep the header with at least its first lines: page-break before a new block if low
    if (y > H - M - 60) { doc.addPage(); y = M; }

    const wd = new Date(r.date + 'T00:00')
      .toLocaleDateString(undefined, { weekday: 'long' });
    line(`${wd}, ${r.date}  ·  ${r.type.toUpperCase()}  ·  ${r.time}`,
         { size: 12, bold: true, gap: 16 });

    if (r.opponent) line(`Opponent: ${r.opponent}`, { indent: 12 });
    if (r.location) line(`Location: ${r.location}`, { indent: 12 });
    line(`Status: ${r.status}${r.score ? `  (Final ${r.score})` : ''}`, { indent: 12 });
    r.snacks.forEach(s =>
      line(`Snack: ${s.parent}${s.phone ? ` (${s.phone})` : ''}${s.notes ? ` — ${s.notes}` : ''}`,
           { indent: 12 }));
    if (r.notes) line(`Notes: ${r.notes}`, { indent: 12 });

    y += 8;                                   // gap between blocks
    doc.setDrawColor(220).line(M, y, W - M, y); // divider
    y += 14;
  });

  doc.save(`schedule_${fileStamp(startDate, endDate)}.pdf`);
}
```

### 8.4 UI

In **Settings** (or a small "Export" panel on the Schedule view): two date
inputs (default = today → +30 days) and two buttons, **Download Excel** and
**Download PDF**, each calling the matching function. If the range is empty,
disable the buttons and show "No events in range".

---

## 9. `data.js` — Storage, Integrity, Cross-Tab

### 9.1 Boot + in-memory cache + subscriptions

```js
const STORAGE_KEY = 'stm:v1';
const SCHEMA_VERSION = 1;

let _cache = null;
const _subs = new Set();               // () => void, called after external change

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // fallback for insecure contexts (e.g. opening via file://)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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

### 9.2 Cross-tab sync

The `storage` event fires in **other** tabs when our key changes. On it, reload
the cache and notify the UI to re-render, so a second tab can't silently
overwrite the first. For a single user this is sufficient — no CRDT/merge
needed.

```js
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  _cache = e.newValue ? migrate(JSON.parse(e.newValue)) : emptyData();
  _subs.forEach(fn => fn());          // views re-render from fresh state
});
```

Views should read via `getData()` on each render and register a `subscribe()`
callback rather than caching records locally.

### 9.3 Integrity-enforcing mutations (cascade / nullify)

UI never deletes raw records; it calls these. Reads elsewhere must tolerate a
missing ref (resolvers in §8 already do).

```js
function touch(rec) { rec.updatedAt = new Date().toISOString(); return rec; }

// --- Parent: cascade join rows, drop snack assignments ---
export function deleteParent(parentId) {
  const d = getData();
  d.playerParents = d.playerParents.filter(pp => pp.parentId !== parentId);
  // snack assignment loses its parent → drop the assignment (it's meaningless without one)
  d.snackAssignments = d.snackAssignments.filter(sa => sa.parentId !== parentId);
  d.parents = d.parents.filter(p => p.id !== parentId);
  saveData();
}

// --- Player: cascade its join rows ---
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

// --- Opponent: nullify from games (don't delete the game) ---
export function deleteOpponent(opponentId) {
  const d = getData();
  d.events.forEach(e => { if (e.opponentId === opponentId) { e.opponentId = null; touch(e); } });
  d.opponents = d.opponents.filter(o => o.id !== opponentId);
  saveData();
}

// --- Fundraiser: cascade occurrences ---
export function deleteFundraiser(fundraiserId) {
  const d = getData();
  d.fundraiserOccurrences = d.fundraiserOccurrences.filter(o => o.fundraiserId !== fundraiserId);
  d.fundraisers = d.fundraisers.filter(f => f.id !== fundraiserId);
  saveData();
}

// --- Platform: nullify from fundraisers ---
export function deletePlatform(platformId) {
  const d = getData();
  d.fundraisers.forEach(f => { if (f.platformId === platformId) { f.platformId = null; touch(f); } });
  d.fundraiserPlatforms = d.fundraiserPlatforms.filter(p => p.id !== platformId);
  saveData();
}
```

Add/update helpers follow the same pattern: assign `id = uuid()` on create,
call `touch()` on write, then `saveData()`. Getters used by `export.js`
(`getOpponentById`, `getParentById`, `getEventById`,
`getSnackAssignmentsForEvent`) are thin lookups over `getData()`.

### 9.4 Migration

`schemaVersion` starts at **1** — the first shape ever persisted. `migrate()`
is a pass-through until a change requires bumping `SCHEMA_VERSION`; the first
real migration gets written here that day. Keeping the function present now
means every caller (`loadData`, the `storage` listener, `importBackup`) already
routes through it.

```js
function migrate(data) {
  // Pass-through at schemaVersion 1. When a future change requires a migration,
  // branch on data.schemaVersion here, mutate `data` in place, bump
  // data.schemaVersion, and return it.
  return data;
}
```

### 9.5 Backup / restore (used by Settings)

```js
export function exportBackup() {
  const d = getData();
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stm-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  d.meta.lastBackupAt = new Date().toISOString();
  saveData();
}

export async function importBackup(file) {
  const parsed = migrate(JSON.parse(await file.text()));
  _cache = parsed;
  saveData();
  _subs.forEach(fn => fn());
}

export function backupNudgeDue() {
  const { meta } = getData();
  if (!meta.lastModifiedAt) return false;
  if (!meta.lastBackupAt) return true;
  const ageDays = (Date.parse(meta.lastModifiedAt) - Date.parse(meta.lastBackupAt)) / 864e5;
  return Date.parse(meta.lastModifiedAt) > Date.parse(meta.lastBackupAt) && ageDays > 3;
}
```

---

## 10. Future Consideration: Swapping Storage Later

Out of scope for now: if multi-device/parent-facing access ever becomes real,
only `data.js`'s `loadData()`/`saveData()` (and the mutation helpers'
persistence calls) get repointed at Firebase/Supabase. The schema and
`export.js` don't change. Keeping every storage touch behind `data.js` now is
what keeps that swap cheap — but it is a different product from today's
single-admin tool.
