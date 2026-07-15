# Football Manager — Staged Build Plan

A dependency-ordered checklist for building the single-admin, static
HTML/localStorage app defined in `FootballManager_Architecture.md`.

Stages are ordered so nothing is built before the thing it depends on. Each
stage ends with an **acceptance gate** — don't move on until it passes.

Guiding rule from the spec: **UI code never touches `localStorage` directly.**
Everything routes through `data.js`. Build that layer first and it stays true.

---

## Stage 0 — Repo & scaffold

- [x] Create the GitHub repo; enable **GitHub Pages** (deploy from `main`, root).
      _(confirmed by admin)._
- [x] Confirm the Pages URL and note the exact origin (`you.github.io/repo`) —
      this is the localStorage boundary (§1.1). _(confirmed by admin)._
- [x] Lay down the file tree from §6:
  - [x] `/index.html`
  - [x] `/css/styles.css`
  - [x] `/js/data.js`, `export.js`, `router.js`, `seed.js`
  - [x] `/js/vendor/` (empty for now)
  - [x] `/js/views/` → `roster.js`, `parents.js`, `schedule.js`, `snacks.js`,
        `fundraisers.js`, `settings.js`
- [x] Add a placeholder `index.html` with `<script type="module">` wiring so
      you confirm **ES modules load on Pages with no build step**.
- [x] Add `.gitignore` (nothing to build, but keep OS/editor cruft out).

**Gate:** the empty shell loads over the live Pages URL and a module log line
prints in the console. No 404s on module imports.

_Verified locally (`python3 -m http.server` + headless Chromium): `index.html`,
`css/styles.css`, and `js/data.js` all return 200; console prints
`[Football Manager] boot OK, data.js stub loaded` with no page errors. The one
404 observed was an unrelated `/favicon.ico` request, not a module import.
Live-Pages verification still needs the two unchecked items above._

---

## Stage 1 — Storage core (`data.js`)

This is the foundation. Build and test it in isolation before any UI.

- [x] Constants: `STORAGE_KEY = 'stm:v1'`, `SCHEMA_VERSION = 1`.
- [x] `uuid()` with `crypto.randomUUID()` + insecure-context fallback (§9.1).
- [x] `emptyData()` returning the full versioned shape (§3) — all arrays
      present, `meta` and `settings` populated.
- [x] In-memory cache + `getData()` / `loadData()` / `saveData()`.
      `saveData()` stamps `meta.lastModifiedAt`.
- [x] Subscription system: `subscribe(fn)` + `_subs` set.
- [x] `migrate()` — pass-through at v1, but **every** load path routes through
      it (§9.4).

**Gate:** in the console, `loadData()` on a fresh origin seeds an empty store;
`saveData()` persists it; reloading the page rehydrates the same object.

_Verified locally (`python3 -m http.server` + headless Chromium, fresh
browser context): `loadData()` returns the full empty shape (schemaVersion 1,
`meta`/`settings` populated, all 9 arrays present); `saveData()` persists to
`localStorage['stm:v1']` and stamps `meta.lastModifiedAt`; reloading the page
and calling `getData()` rehydrates the same `lastModifiedAt`. No console
errors (aside from the unrelated `/favicon.ico` 404)._

---

## Stage 2 — Integrity-enforcing mutations (`data.js` cont.)

The cascade/nullify rules are the whole point of the storage boundary. Get them
right here so views never have to think about referential integrity.

- [x] `touch(rec)` helper.
- [x] **Add/update** helpers per entity (assign `id = uuid()` on create,
      `touch()` on write, `saveData()`): players, parents, playerParents,
      opponents, events, snackAssignments, platforms, fundraisers, occurrences.
- [x] **Delete** helpers with the correct strategy (§9.3):
  - [x] `deleteParent` → cascade `playerParents`, **drop** its snack
        assignments, remove parent.
  - [x] `deletePlayer` → cascade `playerParents`, null `settings.myPlayerId`
        if it matched, remove player.
  - [x] `deleteEvent` → cascade `snackAssignments`, remove event.
  - [x] `deleteOpponent` → **nullify** `event.opponentId` (keep the game),
        remove opponent.
  - [x] `deleteFundraiser` → cascade `fundraiserOccurrences`, remove fundraiser.
  - [x] `deletePlatform` → **nullify** `fundraiser.platformId`, remove platform.
- [x] Thin getters used by export: `getEventById`, `getOpponentById`,
      `getParentById`, `getSnackAssignmentsForEvent`.
- [x] Money is **integer cents** everywhere — no floats (§4).

**Gate:** a scripted scenario (create player+parent+event+snack, then delete
each) leaves **no dangling references** and never throws. Deleting an opponent
leaves the game intact with `opponentId: null`.

_Verified locally (headless Chromium) with the exact scenario: created a
linked player/parent/playerParent/opponent/event/snackAssignment, set
`myPlayerId`, then ran the deletes. `deleteParent` dropped the `playerParents`
row and the snack assignment while the player survived; `deleteOpponent` left
the event intact with `opponentId: null`; `deletePlayer` cleared
`settings.myPlayerId` to `null`. Also spot-checked `deleteFundraiser`
cascading its occurrence and `deletePlatform` nullifying
`fundraiser.platformId`. Money fields (`outstandingBalanceCents`,
`goalAmountCents`, `raisedAmountCents`) held integers throughout. No thrown
errors._

---

## Stage 3 — Cross-tab sync + first-run seeding

- [x] `storage` event listener: reload cache from `e.newValue`, notify subs
      (§9.2). Ignore events for other keys.
- [x] `seed.js`: on first run (no `stm:v1`), create empty store and seed a few
      `fundraiserPlatforms` (e.g. DoubleGood); leave `opponents` empty (§7).
- [x] Wire seeding into boot so it runs exactly once.

**Gate:** open two tabs; a save in tab A triggers a re-render callback in tab B
reading fresh state. Fresh origin shows seeded platforms.

_Verified locally (`python3 -m http.server` + Playwright, two-page context
sharing one origin): a fresh origin seeded `fundraiserPlatforms` with
DoubleGood, GoFundMe, and Snap! Raise, and `opponents` stayed empty. Calling
`updateSettings()` in tab A fired tab B's `subscribe()` callback via the
native `storage` event, and `getData()` in tab B reflected the new
`teamName` immediately. Reloading tab A afterward left the platform list
unchanged (three entries, no duplicates), confirming `seedIfNeeded()` only
seeds once thanks to the new `isFirstRun()` check. No console errors._

---

## Stage 4 — App shell & routing (`router.js`)

- [ ] Hash router (`#/roster`, `#/schedule`, …) — avoids the Pages deep-link
      404 problem (§2).
- [ ] Nav chrome in `index.html` linking each view.
- [ ] View-mount contract: each view reads via `getData()` on render and
      registers a `subscribe()` callback (no locally cached records) (§9.2).
- [ ] Default route + unknown-hash fallback.

**Gate:** navigating hashes swaps views; refresh on a deep hash (e.g.
`#/schedule`) loads correctly on the live Pages URL.

---

## Stage 5 — Core CRUD views

Build in this order (each only needs Stage 1–4). Every dropdown gets inline
**"add new"** (§7). Every list re-renders on the `subscribe` callback.

- [ ] **Roster** (`roster.js`): list/add/edit/deactivate players; `jerseyNumber`
      as string; `position` free text with a datalist; **`outstandingBalanceCents`
      editable inline**; "my player" star toggles `settings.myPlayerId` and
      highlights the row.
- [ ] **Parents** (`parents.js`): CRUD parents; manage `playerParents`
      (many-to-many, one parent across siblings); email optional.
- [ ] **Schedule** (`schedule.js`): unified games + practices; shared
      list/calendar sorted by `date`+`startTime`; game-only fields hidden for
      practices; opponent dropdown; status + final score for completed games;
      highlight "my player" context where relevant.
- [ ] **Snacks** (`snacks.js`): filter events, show assigned parent(s), support
      multiple snack parents per event, **flag unassigned upcoming practices**.
- [ ] **Fundraisers** (`fundraisers.js`): fundraisers + occurrences;
      `raised/goal` progress bar; occurrences listed with date ranges/locations;
      platform dropdown with add-new.

**Gate:** you can run a full season's worth of data entry through the UI, and
all of it survives a reload (because it's all going through `data.js`).

---

## Stage 6 — Backup & durability (`settings.js` + `data.js`)

The spec treats this as first-class, not an afterthought (§1.1, §7).

- [ ] `exportBackup()` → download entire `stm:v1` as
      `stm-backup-YYYY-MM-DD.json`, then set `meta.lastBackupAt` (§9.5).
- [ ] `importBackup(file)` → `migrate()` the parsed file, **confirm before
      overwrite**, replace store, notify subs.
- [ ] `backupNudgeDue()` logic: modified since last backup **and**
      (age > 3 days OR change-count > 25) (§7).
- [ ] Settings UI: team name/season, **"Last backup: N days ago"**, export/import
      buttons, and the **plaintext-PII warning** near the backup button (§7).
- [ ] Nudge banner shown app-wide when `backupNudgeDue()` fires; optional
      one-tap auto-backup download.

**Gate:** export produces a valid JSON; importing it into a *different* browser
profile reproduces the full store. The "N days ago" indicator and nudge behave
correctly across dates.

---

## Stage 7 — Vendored export libs

- [ ] Download **SheetJS** community build → `js/vendor/xlsx.full.min.js`
      (exposes `XLSX`). **Pin the version; record it in the architecture doc.**
- [ ] Download **jsPDF** UMD → `js/vendor/jspdf.umd.min.js`
      (exposes `jspdf.jsPDF`). **Pin + record the version.**
- [ ] Load both via local `<script>` — **no CDN** (hard rule while PII lives in
      localStorage, §2).

**Gate:** `window.XLSX` and `window.jspdf` are defined; nothing external loads
in the Network tab.

---

## Stage 8 — Date-range export (`export.js`)

- [ ] `getEventsInRange(start, end)` — inclusive, sorted by date+time (§8.1).
- [ ] `resolveEvent()` — resolve FKs to names, **tolerate missing refs**
      (`(deleted parent)`, `(unknown)`), format score, cents→string.
- [ ] `exportRangeToXlsx()` — one row per event; column widths; optional
      **Fundraisers sheet** for occurrences overlapping the range (§8.2).
- [ ] `exportRangeToPdf()` — one info block per event; bold header + labeled
      lines; **pagination** when a block would overflow (§8.3).
- [ ] Confirm `outstandingBalanceCents` is **excluded** from this export by
      design (§8 note).
- [ ] Export UI (Settings or Schedule panel): two date inputs (default
      today → +30d), **Download Excel** / **Download PDF**; disable + show
      "No events in range" when empty (§8.4).

**Gate:** a populated range produces a correct `.xlsx` and a paginated `.pdf`;
an empty range disables the buttons; a deleted opponent/parent shows the
tolerant placeholder instead of crashing.

---

## Stage 9 — Hardening & deploy

- [ ] **Durability walkthrough** of §1.1 failure modes documented for the admin:
      clearing site data, incognito, Safari/iOS ITP ~7-day eviction, and the
      **origin-change** trap (Pages → custom domain loses data; only
      export/import bridges it).
- [ ] Verify **no third-party scripts** anywhere (no analytics, no CDN fonts
      that execute JS) — hard rule (§2).
- [ ] Cross-browser smoke test incl. Safari/iOS (the ITP eviction target).
- [ ] Insecure-context check: `uuid()` fallback works if opened via `file://`.
- [ ] Empty-state and error-tolerance pass on every view.
- [ ] Final deploy on `main`; verify live Pages URL end-to-end.

**Gate:** a full dry run — seed → data entry → backup → simulated wipe → import
→ export — completes cleanly on the live site.

---

## Deferred (explicitly out of scope — §10)

- [ ] Backend swap (Firebase/Supabase) — would repoint only `loadData()`/
      `saveData()` + mutation persistence; schema and `export.js` unchanged.
- [ ] Parent-facing / multi-device access — a different product.
- [ ] Roster/balance export as a separate report — not a column in the schedule
      export.

---

### Suggested commit checkpoints
Stage 1–3 (storage core) · Stage 4 (routing) · each view in Stage 5 · Stage 6
(backup) · Stage 7–8 (export) · Stage 9 (deploy). Keeping storage isolated in
the first commits is what keeps the §10 swap cheap later.
