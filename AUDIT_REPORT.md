# Pre-Distribution Audit — 2026-07-16, commit 37a7a76

## Resolution (applied 2026-07-16, follow-up commit)

The BLOCKER and all four SHOULD-FIX findings below have since been **fixed and
re-verified** — the full Phase 4 smoke test plus the XSS and v2→v3 migration
probes now pass (18/18, zero console/page errors):

- **BLOCKER XSS** — the five sinks now pass through `escapeHtml()`; crafted
  `<img onerror>` payloads no longer execute in Fundraisers, Snacks, or
  Schedule.
- **`saveData()` write guard** — `setItem` is wrapped; a quota/Private-mode
  failure now raises a one-time visible warning instead of failing silently.
- **Schema drift** — `SCHEMA_VERSION` bumped to 3 with a `migrate()` branch
  that defaults `hasSeenWizard` (`true` for pre-existing stores); `migrate()`
  also now defends a hand-built file missing `meta`/`settings`.
- **Settings mobile overflow** — the file input is constrained; the 320–390px
  sweep is clean.
- `sw.js` `CACHE_NAME` bumped `v8` → `v9` for the changed cached files.

The findings below are preserved as the original audit record of commit
37a7a76.

## Verdict

*(Original audit verdict, pre-fix.)* **DO NOT SHIP** until the one BLOCKER is fixed. A crafted backup file can inject
executing HTML into several views when it is imported. Everything else is
sound: the data model, offline story, export, PII warnings, and invariants
I-1/I-2/I-4/I-5/I-6/I-7/I-9/I-10 all hold. Fix the XSS on the import path,
address the four SHOULD-FIX items, and this app is ready for a family's real
PII.

---

## What actually shipped (Phase 0 drift map)

| File / feature | Owning stage | Notes |
|---|---|---|
| `index.html`, `css/styles.css` | Stage 0/4 + UX review | shell, nav, mobile layout |
| `js/data.js` | Stages 1–2, 6 | storage core, mutations, backup/restore, hard reset |
| `js/util.js` | Stage 5 | `escapeHtml`, cents↔dollars |
| `js/router.js` | Stage 4 | hash routing, mount/unmount |
| `js/seed.js` | Stage 3 | first-run platform seed |
| `js/selectors.js` | Stage 10 | pure derived reads, `todayStr`/`addDaysStr` |
| `js/nudge.js`, `js/hygiene.js` | Stage 6 / 10 | app-level banners |
| `js/messaging.js` | Stage 8.5 | mailto/sms builders, weekly digest |
| `js/export.js` | Stages 7–8 | date-range xlsx/pdf |
| `js/views/{roster,parents,schedule,snacks,fundraisers,settings}.js` | Stage 5 (+ UX review, Stage 10) | CRUD views |
| `js/views/team.js` | Stage 10 | dashboard/default route |
| `js/views/communications.js` | Stage 8.5 | weekly digest + quick-contact |
| `js/wizard.js`, `js/wizard-content.js` | Stage 11 | Getting Started wizard |
| `manifest.webmanifest`, `sw.js`, `icons/*` | PWA scaffold + Stage 9 | offline shell |
| Roster **position dropdown** | post-plan (PR #19/#21) | documented in BuildPlan follow-up |
| Fundraiser **edit-lock + completed/history split** | post-plan (PR #20) | documented in BuildPlan follow-up |
| Settings **Danger Zone / hard reset** | post-plan | documented in BuildPlan follow-up |
| Settings **"Get as App" install modal** | post-plan (PR #25/#26) | **UNDOCUMENTED** — not in any build-plan file. Static copy only, no record data; safe, but never went through a gate. |

Undocumented `js/*.js` modules that could 404 offline: **none** — every module
on disk is listed in `SHELL_FILES` and `CACHE_NAME` is current (`stm-shell-v8`,
bumped in the same commit that last changed a cached file). I-10 holds.

---

## Findings

### [BLOCKER] Unescaped record fields let an imported backup inject executing HTML (I-3 / XSS)

- **Where:**
  - `js/views/fundraisers.js:65` — `<span class="f-status-display">${f.status}</span>`
  - `js/views/snacks.js:48` — `<td class="col-date">${e.date}</td>`
  - `js/views/snacks.js:49` — `<td class="col-time">${e.startTime}</td>`
  - `js/views/schedule.js:100` — `<td>${TYPE_LABEL[e.type] || e.type}</td>` (raw `e.type` fallback)
  - `js/views/schedule.js:126` — `<span>${STATUS_LABEL[e.status] || e.status}</span>` (raw `e.status` fallback)
- **Evidence:** Imported a crafted backup whose fields contained
  `<img src=x onerror="…">`. On rendering, the payloads executed:
  - Fundraisers view: `f.status` payload fired (`window.__xss3` set, injected `<img>` present) — confirmed in the Phase 4 smoke run (step 7).
  - Follow-up probe with a practice event and a bad-`type`/bad-`status` event:
    all four remaining sinks fired — `snackDate`, `snackTime`, `schedType`,
    `schedStatus` all `true`, two `<img>` elements injected into `#outlet`.
  - The stray `GET /x → 404` in the console log is the injected `<img src=x>`
    fetching — a symptom of this same finding, not a separate defect.
- **Risk:** The import path is untrusted input (Phase 2). A backup file the
  admin was handed (emailed, shared, tampered) can run arbitrary script in the
  app's origin the moment it is imported — reading/exfiltrating the entire
  store of family PII, silently rewriting it, or wiping it. I-3 requires *every*
  record-derived string interpolated into `innerHTML` to pass through
  `escapeHtml()`. `team.js:111` already escapes this very `f.status` field;
  these five sinks were missed.
- **Proposed fix:** Wrap each interpolation in `escapeHtml()`:
  `${escapeHtml(f.status)}`, `${escapeHtml(e.date)}`, `${escapeHtml(e.startTime)}`,
  and for the label fallbacks `${TYPE_LABEL[e.type] || escapeHtml(e.type)}` /
  `${STATUS_LABEL[e.status] || escapeHtml(e.status)}`. `escapeHtml` is already
  imported in all three files. No behavior change for legitimate enum/date/time
  values.

---

### [SHOULD-FIX] `saveData()` swallows nothing but also guards nothing — silent data loss on a failed write

- **Where:** `js/data.js:61-68` (`saveData`), reached by every `add*/update*/delete*`.
- **Evidence:** `localStorage.setItem(...)` runs with no `try/catch`. On
  `QuotaExceededError` or in Safari/iOS Private mode (where `setItem` throws on
  every call), the exception propagates up through the mutation helper into the
  view's event handler, which has no catch. The in-memory `_cache` already holds
  the change and subscribers still re-render, so the UI shows the edit as saved —
  but nothing reached disk, and the change is gone on the next reload.
- **Risk:** The admin believes data is saved when it is not. Rule #9 is explicit
  that durability is a first-class concern, and the in-app help even tells users
  Private mode "doesn't save anything" — but the app gives no signal when a save
  actually fails. Existing on-disk data is not corrupted; only the newest change
  is silently lost.
- **Proposed fix:** Wrap the `setItem` in `try/catch`; on failure, surface a
  visible, non-silent error (e.g. a persistent banner: "Couldn't save — this
  browser may be full or in Private mode. Export a backup now.") and rethrow or
  return a failure flag so callers don't report success. Keep it minimal — no
  new dependency.

---

### [SHOULD-FIX] `settings.hasSeenWizard` was added to the stored shape without bumping `SCHEMA_VERSION` or extending `migrate()` (I-8 / storage contract)

- **Where:** `js/data.js:24` (`emptyData()` adds `hasSeenWizard`), `js/data.js:4`
  (`SCHEMA_VERSION = 2`), `js/data.js:32-41` (`migrate()` has no v2→v3 branch).
- **Evidence:** Stage 11 introduced `settings.hasSeenWizard`. The storage
  contract states any change to the stored shape "requires bumping
  `schemaVersion` and extending `migrate()`." That did not happen — the field
  was added to the empty shape only. A store created before Stage 11 (schema
  already `2`) has no `hasSeenWizard` key after `migrate()` runs.
- **Risk:** No data loss today — `wizard.js:40` deliberately gates on
  `=== false` (not truthiness), so a missing key reads as `undefined` and the
  wizard correctly stays closed for pre-Stage-11 stores. The problem is process
  drift: the contract that keeps every load path honest was skipped, and the
  next person who adds a field and *does* rely on `migrate()` will find the
  version number lying about what the shape guarantees.
- **Proposed fix:** Either bump `SCHEMA_VERSION` to 3 and add a `migrate()`
  branch that defaults `settings.hasSeenWizard` (choose `true` for pre-existing
  stores so long-time users aren't shown the first-run wizard), or document
  explicitly that `hasSeenWizard` is intentionally optional and the `=== false`
  guard is the migration. The first is truer to the contract.

---

### [SHOULD-FIX] Settings view overflows horizontally on phone widths (Phase 4 step 8 gate)

- **Where:** `js/views/settings.js:39-41` (`.import-label` / `#import-backup-input`),
  `css/styles.css:274` (`.import-label { display: inline-flex; … }` with no width cap).
- **Evidence:** Viewport sweep at 320/360/375/390px: every width reported
  page-level horizontal overflow on `#/settings` (document `scrollWidth` 456 vs
  innerWidth). The offending node is the native file input inside
  `.import-label` — intrinsic width ~365px, unconstrained, pushing its right
  edge to 456px. All seven other views passed at every width.
- **Risk:** The whole Settings page scrolls sideways on every phone — the exact
  screen that holds Backup/Export/Danger-Zone, the features a mobile admin needs
  most. Cosmetic, not data-threatening, but it's a real mobile-usability defect
  and it fails the project's own no-horizontal-overflow gate.
- **Proposed fix:** Constrain the file input, e.g.
  `.import-label { flex-wrap: wrap; }` plus
  `#import-backup-input { max-width: 100%; }` (or make the label `display: block`
  and give the input `width: 100%`). Verify the sweep passes afterward.

---

### [NOTE] `sessionStorage` used outside `data.js`

- **Where:** `js/wizard.js:150` (set) and `js/views/roster.js:44-45` (read/clear),
  key `fm:expandAddPlayerOnce`.
- **Detail:** The Phase 1 sweep flags any `sessionStorage` use outside `data.js`.
  This one is an ephemeral, one-shot UI handoff (expand the Add-Player form once
  after the wizard) — it never touches the durable store and isn't part of the
  schema, so it doesn't violate I-1's intent. Recording it so the sweep's result
  is explained rather than silently ignored.

### [NOTE] Money formatting duplicated instead of reusing the `util.js` helpers

- **Where:** `js/views/fundraisers.js:75,77,78,110` use inline
  `(cents / 100).toFixed(2)`; `js/views/roster.js:247` uses inline
  `Math.round(parseFloat(...) * 100)`.
- **Detail:** `centsToDollarsStr` / `dollarsToCents` exist for exactly this.
  These sites are at display/input write-points, so I-4 (integer cents in
  storage/transit) is **not** violated — it's style duplication only. Worth
  consolidating, but it's a small logic edit, not mechanical cleanup, so it's
  left for the admin rather than the cleanup commit.

### [NOTE] Fundraiser "New platform" still uses native `prompt()`

- **Where:** `js/views/fundraisers.js:180-182`.
- **Detail:** The UX-review pass replaced the opponent `prompt()` with a styled
  `<dialog>` (commit c0dcf8d) but left the platform-creation `prompt()`/`prompt()`
  pair as native dialogs. Inconsistent UX, not a defect. `prompt()` returns
  plain text and is passed straight to `addFundraiserPlatform`, so no injection
  concern at creation — but note the platform `name` is later rendered; it flows
  through `escapeHtml` at every render site, so it's safe.

### [NOTE] `migrate()` assumes `data.meta` exists

- **Where:** `js/data.js:34` — `data.meta.changesSinceBackup = …` inside the
  `< 2` branch.
- **Detail:** A hand-built v1 file lacking a `meta` object would throw here on
  the `loadData()` path (the `importBackup` path is protected by `isValidStore`,
  which requires `meta`). I-8 mentions hand-built v1 files. Low likelihood (who
  hand-edits `localStorage`), but a one-line guard (`data.meta ??= {…}`) would
  close it.

### [NOTE] `README.md` is a one-line stub

- **Where:** `README.md` (contents: `# Inprogress`).
- **Detail:** The *in-app* "Keeping your data safe" section (`settings.js`) is
  thorough and accurate for what shipped — that's the copy the non-technical
  admin will actually read, and it's good. The repo README is empty; harmless
  for the end user, listed for completeness.

---

## Smoke test log

Served locally (`python3 -m http.server`) and driven with headless Chromium via
Playwright. 8 pages of the Phase 4 script, plus a targeted XSS follow-up probe.

| Phase 4 step | Result | Summary |
|---|---|---|
| 1. Fresh boot | **PASS** | Seed ran (3 platforms), default route `#/team`, wizard auto-opened, **zero** console/page errors. |
| 2. Populate all views | **PASS** | 2 players, parents, opponent, 5 events, snack, fundraiser+occurrence created. |
| 2b. Routes with orphaned FKs | **PASS** | All 8 routes render with dangling opponent/parent refs; no throws, placeholders shown (I-7). |
| 3a. Export backup | **PASS** | Downloaded `stm-backup-2026-07-16.json`; filename carries no PII. |
| 3b. Wipe → import → compare | **PASS** | Store byte-identical after round-trip (ignoring `meta`). |
| 3c. Bad imports (corrupt / wrong-shape / newer-version / truncated) | **PASS** | All four rejected with clear errors; existing store untouched. |
| 3d. Cancel on import confirm | **PASS** | Dismissing the confirm leaves data untouched. |
| 4. Date-range xlsx + pdf with orphaned-FK event in range | **PASS** | Both files generated, no errors; orphan rendered as `(unknown)`. |
| 5. Weekly update + Email All href | **PASS** | Digest renders; `mailto:` uses literal comma between recipients, `%20` for spaces (not `+`), subject/body correctly encoded. |
| 6. Offline reload | **PASS** | SW active + controlling; after `setOffline(true)` + reload the app fully boots and reads all data (not stuck on "Loading…"). |
| 7. XSS via crafted backup | **FAIL → BLOCKER** | Injected `<img onerror>` payloads executed in Fundraisers, Snacks, and Schedule views. See BLOCKER above. |
| 8. Cross-tab | **PASS** | Two tabs editing; neither clobbers the other (storage listener reloads cache before next save). |
| 9. Network origins | **PASS** | Zero non-repo origins across the whole session (only same-origin + the injected `/x` from the XSS payload). |
| 10. Viewport sweep 320/360/375/390 | **FAIL → SHOULD-FIX** | `#/settings` overflows horizontally at every width (file input). All other views clean. |

Console errors across the session: only the `GET /x 404` produced by the XSS
test's own `<img src=x>` payload — no genuine app 404s (`SHELL_FILES` verified
complete on disk). Page (uncaught) errors: **none**.

---

## Docs to update

*(Listed only — the admin maintains the build-plan/architecture docs.)*

- **Architecture / storage contract:** record that `settings.hasSeenWizard`
  (Stage 11) is part of the stored shape, and document the schema-version
  decision made when fixing the SHOULD-FIX above (bump to v3 + migrate, or an
  explicit "optional field, `=== false` is the guard" note).
- **BuildPlan:** add a follow-up entry for the **"Get as App" install modal**
  (PR #25/#26) — it currently appears in no build-plan file.
- **Stage 9 deferred list:** unchanged in scope — auto-backup and
  parent-facing access are still deferred; nothing shipped against them. (The
  Danger-Zone hard reset, position dropdown, and fundraiser history split are
  already captured in BuildPlan follow-up notes.)
- **`README.md`:** populate the stub (what the app is, how to serve/deploy),
  or note deliberately that the in-app help is the canonical user doc.

---

## Cleanup commit

**None made.** The Phase 1 debris sweep found no `console.log`/`debugger`, no
`TODO`/`FIXME`/`HACK`/`XXX`, no commented-out blocks, no unused exports, no
orphaned CSS selectors, and no unreferenced files — so there was nothing
eligible for the single `audit: safe cleanup` commit. The two style items
(money-helper duplication, native `prompt()`) are logic edits, not mechanical
debris removal, and are left for the admin per the ground rules.
