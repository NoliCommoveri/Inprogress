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

- [x] Hash router (`#/roster`, `#/schedule`, …) — avoids the Pages deep-link
      404 problem (§2).
- [x] Nav chrome in `index.html` linking each view.
- [x] View-mount contract: each view reads via `getData()` on render and
      registers a `subscribe()` callback (no locally cached records) (§9.2).
- [x] Default route + unknown-hash fallback.

**Gate:** navigating hashes swaps views; refresh on a deep hash (e.g.
`#/schedule`) loads correctly on the live Pages URL.

_Verified locally (`python3 -m http.server` + headless Chromium): nav links
swap views and gain the `active` class, a deep-hash reload (`#/roster`) loads
that view directly with no flash of the default route, an unknown hash
(`#/nope`) redirects to `#/schedule`, and 60 rounds of repeated navigation
produced no console errors beyond an unrelated `/favicon.ico` 404. Live-Pages
verification still needs to be confirmed on the deployed URL._

---

## Stage 5 — Core CRUD views

Build in this order (each only needs Stage 1–4). Every dropdown gets inline
**"add new"** (§7). Every list re-renders on the `subscribe` callback.

- [x] **Roster** (`roster.js`): list/add/edit/deactivate players; `jerseyNumber`
      as string; `position` free text with a datalist; **`outstandingBalanceCents`
      editable inline**; "my player" star toggles `settings.myPlayerId` and
      highlights the row.
- [x] **Parents** (`parents.js`): CRUD parents; manage `playerParents`
      (many-to-many, one parent across siblings); email optional.
- [x] **Schedule** (`schedule.js`): unified games + practices; shared
      list/calendar sorted by `date`+`startTime`; game-only fields hidden for
      practices; opponent dropdown; status + final score for completed games;
      highlight "my player" context where relevant.
- [x] **Snacks** (`snacks.js`): filter events, show assigned parent(s), support
      multiple snack parents per event, **flag unassigned upcoming practices**.
- [x] **Fundraisers** (`fundraisers.js`): fundraisers + occurrences;
      `raised/goal` progress bar; occurrences listed with date ranges/locations;
      platform dropdown with add-new.

**Gate:** you can run a full season's worth of data entry through the UI, and
all of it survives a reload (because it's all going through `data.js`).

_Verified locally (`python3 -m http.server` + headless Chromium, scripted
through the actual UI): entered 3 players, 2 parents (one linked to two
siblings), a practice and a game with an inline-added opponent, a snack
assignment, and a fundraiser with an occurrence — all of it survived a
reload. Deleting a parent removed her snack assignment and player link from
the UI immediately with no manual refresh, while the linked player stayed on
the roster. Deleting an opponent left its game in place with the opponent
select reset to "no opponent". Starring then deleting a player cleared the
roster highlight. The snacks view flagged an unassigned upcoming practice
and stopped flagging it the instant a parent was assigned. This also
surfaced and fixed a same-tab gap in `data.js`: `saveData()` previously only
notified subscribers via the cross-tab `storage` event, so a view's own
mutations never triggered its own re-render — it now notifies local
subscribers on every save._

---

## Stage 6 — Backup & durability (`settings.js` + `data.js`)

The spec treats this as first-class, not an afterthought (§1.1, §7).

- [x] `exportBackup()` → download entire `stm:v1` as
      `stm-backup-YYYY-MM-DD.json`, then set `meta.lastBackupAt` (§9.5).
- [x] `importBackup(file)` → `migrate()` the parsed file, **confirm before
      overwrite**, replace store, notify subs.
- [x] `backupNudgeDue()` logic: modified since last backup **and**
      (age > 3 days OR change-count > 25) (§7).
- [x] Settings UI: team name/season, **"Last backup: N days ago"**, export/import
      buttons, and the **plaintext-PII warning** near the backup button (§7).
- [x] Nudge banner shown app-wide when `backupNudgeDue()` fires; optional
      one-tap auto-backup download.

**Gate:** export produces a valid JSON; importing it into a *different* browser
profile reproduces the full store. The "N days ago" indicator and nudge behave
correctly across dates.

_Verified locally (`python3 -m http.server` + headless Chromium): export
produces `stm-backup-YYYY-MM-DD.json` at `schemaVersion: 2` with
`changesSinceBackup` reset to 0 and the status line flipping to "today"
immediately. 26 small edits without exporting shows the nudge banner from
every view, not just Settings; exporting clears it again. Manually pushing
`lastModifiedAt`/`lastBackupAt` 4+ days apart triggers the nudge independent
of change count. Importing an exported file into a fresh browser context
reproduces the full store. A hand-built `schemaVersion: 1` file with no
`changesSinceBackup` field imports cleanly and lands at `schemaVersion: 2`
with `changesSinceBackup: 0`. Canceling the import confirm dialog leaves
existing data untouched. This also surfaced and fixed a bug in
`exportBackup()`: it built the downloaded JSON before resetting
`lastBackupAt`/`changesSinceBackup` instead of after, so the backup file's
own metadata was already stale the moment it was written._

---

## Stage 7 — Vendored export libs

- [x] Download **SheetJS** community build → `js/vendor/xlsx.full.min.js`
      (exposes `XLSX`). **Pin the version; record it in the architecture doc.**
- [x] Download **jsPDF** UMD → `js/vendor/jspdf.umd.min.js`
      (exposes `jspdf.jsPDF`). **Pin + record the version.**
- [x] Load both via local `<script>` — **no CDN** (hard rule while PII lives in
      localStorage, §2).

**Gate:** `window.XLSX` and `window.jspdf` are defined; nothing external loads
in the Network tab.

_Verified locally (`python3 -m http.server` + headless Chromium via
Playwright): `window.XLSX` and `window.jspdf.jsPDF` are both defined on load
with zero import statements, and the Network tab shows zero third-party
requests — only `http://localhost:*` traffic. Both vendor files download via
the npm registry tarballs (`cdn.sheetjs.com`/`unpkg.com` were unreachable
under this build environment's network policy) and are confirmed non-empty,
minified JS. Pinned: SheetJS Community Edition v0.18.5 (npm's latest
published build — see the architecture doc §2 note on why not 0.20.x) and
jsPDF v4.2.1, both recorded in `FootballManager_Architecture.md` §2 with the
vendor date._

---

## Stage 8 — Date-range export (`export.js`)

- [x] `getEventsInRange(start, end)` — inclusive, sorted by date+time (§8.1).
- [x] `resolveEvent()` — resolve FKs to names, **tolerate missing refs**
      (`(deleted parent)`, `(unknown)`), format score, cents→string.
- [x] `exportRangeToXlsx()` — one row per event; column widths; optional
      **Fundraisers sheet** for occurrences overlapping the range (§8.2).
- [x] `exportRangeToPdf()` — one info block per event; bold header + labeled
      lines; **pagination** when a block would overflow (§8.3).
- [x] Confirm `outstandingBalanceCents` is **excluded** from this export by
      design (§8 note).
- [x] Export UI (Settings or Schedule panel): two date inputs (default
      today → +30d), **Download Excel** / **Download PDF**; disable + show
      "No events in range" when empty (§8.4).

**Gate:** a populated range produces a correct `.xlsx` and a paginated `.pdf`;
an empty range disables the buttons; a deleted opponent/parent shows the
tolerant placeholder instead of crashing.

_Verified locally (`python3 -m http.server` + headless Chromium via
Playwright): seeded a player/parent/opponent/game with a snack assignment,
exported `.xlsx` and `.pdf` — the workbook's `Events` sheet had the correct
row (opponent name, `3–1` score, snack parent + phone), and the PDF's text
stream had the matching info block with no third-party network calls.
Inspected the raw `.xlsx` (unzipped) and `.pdf` (raw content stream, since
this build's PDFs aren't Flate-compressed) to confirm actual output rather
than just trusting no-throw. Deleted the parent and opponent afterward and
re-exported: `deleteParent`/`deleteOpponent`'s existing cascade/nullify
helpers already remove the dangling snack assignment and null the
`opponentId`, so the export showed `(unknown)` for the opponent and no
snack row — confirmed no exception either way. Seeded 40 events with long
notes across a 6-week range and exported to PDF: produced 5 pages with no
block split across a page boundary (verified via the page-break check
before each event's header). Toggling the date range to a window with zero
events disabled both buttons and un-hid "No events in range"; widening the
range back re-enabled them immediately. Grepped both export outputs for
`outstandingBalanceCents`/balance figures — absent from either format. Also
fixed two small CSS gaps surfaced by this UI: `.warning` styling was scoped
to `.backup-section` only (the new `.export-section .warning` wouldn't have
picked it up) and there was no `button:disabled` style, so the empty-range
state wasn't visibly distinct — both fixed in `css/styles.css`._

---

## Stage 8.5 — Communications / Weekly Update (`messaging.js` + `views/communications.js`)

Not originally in this plan — inserted between Stage 8 and Stage 9 per
`FootballManager_ClaudeCode_Stage8.5-Messaging.md`. Recorded here after the
fact; this section was missing from the plan even though the stage shipped
(PRs [#10](https://github.com/NoliCommoveri/Inprogress/pull/10)–[#11](https://github.com/NoliCommoveri/Inprogress/pull/11)),
which is exactly the kind of drift a docs-review pass is meant to catch.

- [x] `js/messaging.js`: Weekly Update text builder (upcoming events, snack
      assignments) and per-parent `mailto:`/`sms:` link builders.
- [x] `js/views/communications.js`, routed at `#/communications`, nav link
      placed after Parents: Weekly Update broadcast panel + per-parent
      quick-contact list, replacing the earlier draft that split this across
      Schedule and Parents.
- [x] Empty state: zero upcoming events shows a fallback message; "Email All"
      is disabled (styled `<a>`, not `<button>`) and unclickable when there
      are no recipient emails.
- [x] `mailto:` body encoding fixed to use spaces, not `+` (PR #11).
- [x] Single-contact Email/Text links prefilled with the weekly digest (PR #10 follow-up).

**Gate:** Weekly Update text is accurate for a populated week; Email All and
per-parent links open with correct recipients/body; no schema change
(`SCHEMA_VERSION` untouched).

_No new verification note added here — see
`FootballManager_ClaudeCode_Stage8.5-Messaging.md` and PRs #9–#11 for the
build/verification record that should have been mirrored into this file at
the time._

---

## PWA scaffolding — manifest, service worker, icons

Also not originally in this plan; shipped in PRs
[#12](https://github.com/NoliCommoveri/Inprogress/pull/12)–[#13](https://github.com/NoliCommoveri/Inprogress/pull/13)
between Stage 8.5 and Stage 9, and is a stated prerequisite in
`FootballManager_ClaudeCode_Stage9.md`'s opening summary ("Everything before
this is already implemented... PWA scaffolding"). Recorded here after the
fact for the same reason as Stage 8.5 above.

- [x] `manifest.webmanifest`: `start_url`/`scope` relative (`./`), full icon
      set declared (16px–512px + maskable 192/512), `background_color`/
      `theme_color` set to `#011325`.
- [x] `sw.js`: installs a shell cache (`CACHE_NAME`), network-first for
      navigations, cache-first for shell assets; currently caches the HTML
      shell + CSS + icons + vendored export libs, but **not** the app's own
      `js/*.js` modules — see Stage 9.3 below, this is the offline gap it
      fixes.
- [x] Full branded icon set generated and committed to `/icons/` (16×16
      through 512×512, plus maskable 192/512).
- [ ] Real offline verification (cached shell hydrates without a network
      hit) — blocked on Stage 9.3, not done yet.

**Gate:** install banner appears on Chrome/Android; `manifest.webmanifest`
and `sw.js` both 200 with no console errors. The *offline-actually-works*
gate belongs to Stage 9.3, not here.

---

## Stage 9 — Hardening & deploy

The detailed, authoritative instructions for this stage are
`FootballManager_ClaudeCode_Stage9.md` (sub-stages 9.1–9.7) — it supersedes
the shorter list below, which predates Stage 8.5 and the PWA work and was
never reconciled with the fuller doc.

- [x] **9.1 — Minimal functional CSS pass**: iOS safe-area/notch padding
      (`env(safe-area-inset-*)` + `viewport-fit=cover`); confirm the
      "disabled" Email-All link (`.btn-link.disabled`) is genuinely
      unclickable. (`css/styles.css` itself is already built out — this is
      a small patch, not a rewrite.)
- [x] **9.2 — Harden `importBackup`**: validate shape/`schemaVersion` before
      touching the live store; a bad file must leave existing data untouched
      and show a clear error (Architecture §7).
- [x] **9.3 — Make the PWA actually work offline**: precache the app's own
      JS modules (not just the shell/CSS/icons/vendor libs) so airplane mode
      → relaunch loads the **working app**, not a stuck "Loading…" shell;
      bump `CACHE_NAME` (currently `stm-shell-v2` → `v3`).
- [x] **9.4 — In-app durability / help section**: collapsible "Keeping your
      data safe" section in Settings covering §1.1 failure modes, the iOS
      installed-app-vs-Safari-tab partition trap, and the
      install-mitigates-eviction tip. (Supersedes the durability-walkthrough
      bullet from the original version of this section — it has to live in
      the app, not a repo doc a non-developer admin will never open.)
- [x] **9.5 — Empty-state & error-tolerance verification** on every view.
- [ ] **9.6 — Cross-browser & insecure-context smoke test** incl. Safari/iOS
      (the ITP eviction target) and a `file://` open to check the `uuid()`
      fallback. **Not verifiable in this build environment** (no real iOS/
      Android devices, no Firefox/Safari engines) — automated headless-Chrome
      checks substituted where possible (see verification note below); a real
      device pass is still owed before the live-URL dry run in 9.7.
- [x] **9.7 — Deploy checklist**: `CACHE_NAME` bump, zero third-party
      requests, vendored versions recorded, brand color `#011325` consistent,
      all paths relative. **Live-URL dry run still pending** — needs the
      actual GitHub Pages deploy, not just local serving.

**Gate:** a full dry run — seed → data entry → backup → simulated wipe →
import → export — completes cleanly on the live site, airplane mode →
relaunch loads the fully working app (not just the shell), and the in-app
durability section is present. Full gate text in
`FootballManager_ClaudeCode_Stage9.md`.

**Verification note (this session):** Served the app locally
(`python3 -m http.server`) and drove it with headless Chromium via
Playwright, since this build environment has no real iOS/Android hardware
and no live Pages deploy to test against.
- Loaded the app online, reloaded it once online (service worker now
  controlling), then set the browser context offline and reloaded again:
  the Schedule view rendered fully (table, Add Event form, opponent picker)
  with zero console/page errors in all three passes — confirms 9.3's fix;
  previously this would have stuck on "Loading…" since `js/*.js` wasn't
  cached.
- Imported a non-JSON file and a valid-JSON-wrong-shape file via
  `#/settings`: both were rejected with the expected alert text and no
  thrown errors; a subsequent valid backup (round-tripped from
  `getData()`) imported successfully with the "Backup imported." alert —
  confirms 9.2 leaves bad imports non-destructive while good ones still work.
- Confirmed `.help-section` renders on `#/settings` with the Home-Screen
  and 7-day ITP-eviction copy present — confirms 9.4.
- Grepped the app source for `http://`/`https://` references (excluding
  vendored libs): none found — confirms the zero-third-party-request part
  of 9.7 at the source level (not a live Network-tab capture).
- Spot-checked empty/orphaned-reference handling by reading each view's
  source (9.5): all six original CRUD views plus Communications already
  have empty-state copy, and `snacks.js`/`export.js` already render
  `(deleted parent)`/`(unknown)` for orphaned links — no code changes were
  needed here, consistent with the doc's expectation that this stage mostly
  verifies Stage 5/8.5 work rather than rebuilding it.
- **Deviation from the Stage 9 doc's literal 9.1 patch:** the doc only
  names the base `header`/`#outlet` rules, but `css/styles.css` already had
  a `@media (max-width: 480px) { #outlet { padding: 8px; } }` override that
  would have silently discarded the `env(safe-area-inset-bottom)` addition
  on any viewport under 480px — i.e. on the real iPhones this fix targets.
  Patched that override to keep the safe-area term (`padding: 8px 8px
  calc(env(safe-area-inset-bottom) + 8px)`) instead of applying the doc's
  text as a no-op fix.
- Not done: real iOS/Android hardware pass (9.6), and the live Pages
  dry run + DevTools Network-tab capture (9.7's last two bullets) — both
  need an actual deploy and real devices, neither available in this
  session.

---

## Stage 10 (optional, not yet started)

`FootballManager_ClaudeCode_Stage10.md` describes an optional follow-on —
Team View dashboard, roster filter/sort, Schedule upcoming/past split, and a
launch-time data-hygiene prompt. It is **not** part of this plan's required
scope and explicitly assumes Stage 9's gate has already passed. Do not start
it until Stage 9 is done and confirmed; tracked here only so the doc isn't
orphaned/undiscoverable from this file.

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
