# Football Manager — Design & Schema Reference

**This is the single source of truth for the app.** It is written from the
actual shipped code, not from the older staged build-plan docs (those are being
left behind in the migration). If code and this document ever disagree, the code
wins — but fix this document in the same change so the next instance isn't
misled.

> **Where this lives after migration:** the whole app nests one layer down under
> `/Football/` in the new repo (see [§13 Repo migration](#13-repo-migration)).
> Paths inside the code are all relative, so the nesting needs no code changes —
> but read §13 before touching anything, there are two non-obvious traps
> (`.nojekyll` placement and shared-origin `localStorage`).

---

## 1. What the app is

A single-admin, static web app for running **one** youth football team: roster,
schedule (games + practices), snack duty, fundraisers, and parent
communications. One person (a team parent/coach) uses it on their phone.

- **No backend, no login, no build step, no framework.** Vanilla ES modules
  loaded with `<script type="module">`.
- **All data lives in the browser's `localStorage`** on one device. There is no
  cloud copy. Durability (backup/restore, the "back up your data" nudge) is
  therefore a first-class feature, not an afterthought.
- **Hosted on GitHub Pages** as a static site, installable as a PWA.
- The only third-party code is **SheetJS** (xlsx) and **jsPDF**, both *vendored*
  into `js/vendor/` and loaded from disk — never fetched at runtime.

---

## 2. Hard rules (invariants) — do not break these

These are load-bearing. Every one is checkable; a violation is a bug even if the
app still appears to work.

| # | Invariant |
|---|---|
| **I-1** | `localStorage` is touched **only** inside `js/data.js`. No view/helper/feature reads or writes it directly. (`sessionStorage` is used for one ephemeral UI hand-off — see §7 — and is *not* the durable store.) |
| **I-2** | **Zero third-party origins at runtime.** No CDN, fonts, analytics, or off-origin fetches. Vendored libs load from `./js/vendor/` only. |
| **I-3** | **Every record-derived string interpolated into `innerHTML` passes through `escapeHtml()`** — including strings placed inside `href` attributes (`mailto:`, `sms:`). The **import path is untrusted input**; a crafted backup file must not be able to inject markup. (See §11. This was a real shipped XSS — five sinks missed escaping.) |
| **I-4** | **Money is integer cents** in storage and in memory. Convert to/from dollar strings only at the display/input boundary, via `util.js` helpers. No floats stored, no float math on money. |
| **I-5** | **All paths are relative (`./…`)** — module imports, `<script>`/`<link>`, manifest `start_url`/`scope`/icons, SW cache list. A leading `/` breaks on the Pages subpath, and doubly so under the new `/Football/` nesting. |
| **I-6** | **Every view honors the mount contract:** `mount(containerEl)` subscribes and returns an unmount function that unsubscribes. No orphaned subscriptions. |
| **I-7** | **Missing foreign keys never throw.** A deleted parent/opponent/player renders as a placeholder string (`(deleted parent)`, `TBD`, `(unknown)`) everywhere it's referenced. |
| **I-8** | **All load paths route through `migrate()`**, and `SCHEMA_VERSION` matches what `migrate()` can actually produce from every older version (including hand-built files). Any change to the stored shape **requires** bumping `SCHEMA_VERSION` and adding a `migrate()` branch. |
| **I-9** | `Player.outstandingBalanceCents` appears in **no** export format. It's private and not for the schedule handout. |
| **I-10** | The SW `SHELL_FILES` list matches reality: every listed path exists at that exact name, and every module the app needs to boot offline is listed. Bump `CACHE_NAME` whenever any cached file changes. (`cache.addAll` is atomic — one 404 caches nothing.) |

---

## 3. File layout

In the new repo everything sits under `/Football/` (except repo-root housekeeping
files — see §13):

```
/Football/
  index.html                 app shell: header nav, mount points, module bootstrap
  manifest.webmanifest       PWA manifest (relative start_url/scope/icons)
  sw.js                      service worker: precache shell + offline strategy
  DESIGN.md                  this document
  css/
    styles.css               all styling (one file), theme + mobile + dialogs
  icons/                     full PWA icon set 16→512 + maskable 192/512
  js/
    data.js                  THE ONLY file that touches localStorage
    util.js                  escapeHtml, cents↔dollars helpers
    selectors.js             pure derived reads (record, next event, staleness, dates)
    router.js                hash routing + mount/unmount lifecycle
    seed.js                  first-run defaults (fundraiser platforms)
    messaging.js             mailto/sms builders + weekly digest text
    export.js                date-range .xlsx / .pdf export
    nudge.js                 backup-reminder banner
    hygiene.js               stale-items banner
    wizard.js                first-run Getting Started wizard (controller)
    wizard-content.js        wizard copy (pure data, 11 steps)
    vendor/
      xlsx.full.min.js       SheetJS, pinned, vendored (never fetched)
      jspdf.umd.min.js       jsPDF, pinned, vendored
    views/                   one module per screen; each exports mount(container)
      team.js                landing dashboard (default route)
      schedule.js            games + practices, upcoming/past split
      roster.js              players; filter/sort; "my player" star
      parents.js             parents + player links
      communications.js      weekly digest broadcast + per-parent contact
      snacks.js              snack duty per practice
      fundraisers.js         fundraisers + occurrences + platforms
      settings.js            team info, backup/restore, export, help, danger zone
```

Repo-root files that must **not** move into `/Football/`: see §13.

---

## 4. Architecture in one paragraph

`index.html` loads the two vendored libs (classic scripts, so `window.XLSX` /
`window.jspdf` exist), then a single module bootstrap that calls
`seedIfNeeded()`, `initRouter()`, `initNudgeBanner()`, `initHygieneBanner()`,
`initWizard()`, and registers the service worker. **All state lives in one
in-memory object** (`_cache` in `data.js`) that mirrors the single
`localStorage` entry. Views never hold their own copy of records — they read
through `data.js` getters on every render, mutate through `data.js` helpers, and
re-render when `data.js` notifies subscribers. That one-way loop
(read → mutate helper → `saveData` → notify → re-render) is the whole
architecture.

---

## 5. Data model / schema

**Storage key:** `stm:v1` (a single JSON object). **`SCHEMA_VERSION`: `3`.**

The key name is fixed and version-independent; the *version* is the
`schemaVersion` field inside the JSON, not the key. Do **not** rename the key to
migrate — bump `schemaVersion` and extend `migrate()`.

### 5.1 Root object

```jsonc
{
  "schemaVersion": 3,
  "meta": {
    "lastModifiedAt": "ISO-8601 string | null",   // stamped by saveData()
    "lastBackupAt":   "ISO-8601 string | null",   // stamped by exportBackup()
    "changesSinceBackup": 0                        // save() increments; backup resets to 0
  },
  "settings": {
    "teamName":     "",            // free text
    "season":       "",            // free text, e.g. "Fall 2026"
    "myPlayerId":   null,          // Player.id highlighted app-wide, or null
    "hasSeenWizard": false         // false → first-run wizard auto-opens (added in v3)
  },
  "players":              [ /* Player */ ],
  "parents":              [ /* Parent */ ],
  "playerParents":        [ /* PlayerParent (join) */ ],
  "opponents":            [ /* Opponent */ ],
  "events":               [ /* Event */ ],
  "snackAssignments":     [ /* SnackAssignment */ ],
  "fundraiserPlatforms":  [ /* FundraiserPlatform */ ],
  "fundraisers":          [ /* Fundraiser */ ],
  "fundraiserOccurrences":[ /* FundraiserOccurrence */ ]
}
```

**Universal record rules**

- Every record has a string **`id`** (from `uuid()` — `crypto.randomUUID()` with
  a Math.random fallback for insecure `file://` contexts).
- Every record has an **`updatedAt`** ISO string, stamped **only** by the
  `data.js` mutation helpers (`touch()`), never set by hand anywhere else.
- **Dates are `"YYYY-MM-DD"` strings**, **times are `"HH:MM"` strings** — never
  `Date` objects — in storage. They are compared **lexicographically** (which is
  why the string format matters).
- **Money fields end in `Cents` and are integers.**

### 5.2 Entities

**Player**
```jsonc
{ "id","firstName","lastName",
  "jerseyNumber": "string",          // string, not number — allows "" and legacy values
  "position": "string",              // position CODE (see §9.2), free-text tolerated
  "active": true,
  "outstandingBalanceCents": 0,      // int cents; NEVER exported (I-9)
  "updatedAt": "ISO" }
```

**Parent**
```jsonc
{ "id","name","phone","email","updatedAt" }   // phone/email may be ""
```

**PlayerParent** (many-to-many join; a parent can link multiple kids, and a kid
multiple parents)
```jsonc
{ "id","playerId","parentId","relationship":"","updatedAt" }
```

**Opponent**
```jsonc
{ "id","name","homeLocation":"","updatedAt" }
```

**Event** (games *and* practices share one collection, discriminated by `type`)
```jsonc
{ "id",
  "type": "game" | "practice",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "" | "HH:MM",
  "location": "",
  "opponentId": "Opponent.id | null",   // games only; null = TBD/none
  "status": "scheduled" | "completed" | "canceled",
  "finalScoreUs": null | number,        // integer goals; games only
  "finalScoreOpponent": null | number,
  "notes": "",
  "updatedAt": "ISO" }
```

**SnackAssignment** (which parent brings snacks to which event; the Snacks view
only surfaces *practices*)
```jsonc
{ "id","eventId","parentId","notes":"","updatedAt" }
```

**FundraiserPlatform** (e.g. DoubleGood, GoFundMe)
```jsonc
{ "id","name","url":"","updatedAt" }
```

**Fundraiser**
```jsonc
{ "id",
  "kind": "uniforms" | "team_trip" | "general",   // free-text tolerated
  "name": "",
  "platformId": "FundraiserPlatform.id | null",    // null = "In person"
  "goalAmountCents": 0,
  "raisedAmountCents": 0,
  "status": "planned" | "active" | "completed" | "canceled",
  "notes": "",
  "updatedAt": "ISO" }
```

**FundraiserOccurrence** (a fundraiser can run on multiple date ranges, e.g. a
car-wash series)
```jsonc
{ "id","fundraiserId","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD",
  "location":"","notes":"","updatedAt" }
```

### 5.3 Referential integrity — delete strategies

`data.js` owns cascade/nullify logic. **Never delete a record by splicing an
array directly in a view** — call the helper so dependents are handled:

| Delete | Strategy |
|---|---|
| `deleteParent` | **cascade** `playerParents`; **drop** the parent's `snackAssignments` (meaningless without a parent); remove parent |
| `deletePlayer` | **cascade** `playerParents`; clear `settings.myPlayerId` if it matched; remove player |
| `deleteEvent` | **cascade** its `snackAssignments`; remove event |
| `deleteOpponent` | **nullify** `event.opponentId` on referencing games (keep the game); remove opponent |
| `deleteFundraiser` | **cascade** its `fundraiserOccurrences`; remove fundraiser |
| `deletePlatform` | **nullify** `fundraiser.platformId` (keep the fundraiser as "In person"); remove platform |

Anything a delete *nullifies* rather than cascades must render tolerantly at
every read site (I-7).

---

## 6. `data.js` — the storage layer

The only module allowed to call `localStorage`. Public surface:

- **Boot/cache:** `getData()` (returns the live in-memory `_cache`, loading it on
  first call), `loadData()` (re-reads from disk through `migrate()`),
  `isFirstRun()` (true iff the key has never been written — the seed signal).
- **Persistence:** `saveData({ countAsChange = true })` — stamps
  `meta.lastModifiedAt`, optionally bumps `changesSinceBackup`, writes to disk,
  and notifies subscribers.
- **Subscriptions:** `subscribe(fn) → unsubscribe`. Views subscribe in `mount`
  and call the returned unsubscribe in their unmount.
- **Generic helpers** (internal): `addRecord/updateRecord/removeRecord` stamp
  `updatedAt` and `saveData()`.
- **Typed helpers per entity:** `add*/update*/get*/delete*` — always go through
  these. New entities/fields follow the identical pattern.
- **Backup:** `exportBackup()` (writes a pretty-printed JSON blob, updates
  `lastBackupAt`, zeroes `changesSinceBackup`), `importBackup(file)` (validates,
  migrates, replaces the store), `hardResetAllData()` (wipes the key + cache).
- **Nudge:** `backupNudgeDue()` (see §6.3).

### 6.1 `saveData()` failure handling (don't remove this)

`localStorage.setItem` **throws** on a full quota and in Safari/iOS Private mode
(where *every* write fails). `saveData()` wraps the write in try/catch: on
failure it raises a **one-time** `alert()` telling the admin their data isn't
being saved (and to export a backup / leave Private mode), still notifies
subscribers so the UI stays consistent for the session, and returns without
rethrowing (rethrowing would break each caller's event handler for no benefit).
A subsequent successful write re-arms the warning. **The failure must never be
silent** — a silent failure means the admin thinks data saved when it didn't.

### 6.2 `migrate()` and versioning (I-8)

```
migrate(data):
  data.meta     ??= { …defaults… }     // defend hand-built files missing containers
  data.settings ??= {}
  if schemaVersion < 2: add meta.changesSinceBackup; → 2
  if schemaVersion < 3: settings.hasSeenWizard ??= true; → 3   // true for upgraders → don't re-show wizard
  return data
```

- **Every** load path routes through `migrate()`: `loadData()`, the cross-tab
  `storage` listener, and `importBackup()`.
- **To add a field or change the shape:** (1) add it to `emptyData()`, (2) bump
  `SCHEMA_VERSION`, (3) add an `if (data.schemaVersion < N)` branch that defaults
  the field on older stores, (4) if the field affects offline boot, remember the
  SW (I-10). Skipping (2)/(3) is the exact mistake that made `hasSeenWizard`
  drift in v2 — it happened to be saved by a defensive `=== false` guard in the
  wizard, but don't rely on luck.
- `importBackup()` **refuses** a backup whose `schemaVersion > SCHEMA_VERSION`
  (can't safely migrate backward). It validates shape *before* touching the live
  store (`isValidStore`), so a corrupt/wrong/truncated file leaves existing data
  untouched and shows a clear error.

### 6.3 Backup nudge logic

`backupNudgeDue()` returns true when there are edits since the last backup **and**
(more than 3 days have elapsed since the last backup **or** more than 25 changes
have accumulated). Never backed up + any modification ⇒ due. Drives the
`nudge.js` banner and the "Last backup: …" styling in Settings.

### 6.4 Cross-tab sync

A `window` `storage` listener fires in *other* tabs when the key changes. It
reloads `_cache` from the new value (through `migrate()`) and notifies
subscribers, so a second tab can't silently overwrite the first on its next
save. Single-user app ⇒ **last-write-wins** is acceptable and intended.

---

## 7. Routing & the mount contract

`router.js` is hash-based (`#/team`, `#/schedule`, …) — required because GitHub
Pages 404s on deep server paths. `#/team` is the default and the landing route.

- Unknown/empty hash → redirect to `#/team` (never a blank screen).
- On each navigation: call the previous view's **unmount**, clear the outlet,
  highlight the nav link, dynamically `import()` the view module, call its
  `mount(outlet)`, and store the returned unmount.
- **Every view** ends `mount` with `const unsub = subscribe(render); render();
  return () => unsub();` (I-6). A view that subscribes without returning an
  unsubscribe leaks a listener on every navigation — invisible until the app
  slows down.

**Ephemeral wizard→roster hand-off:** the wizard's final "Add your first player"
step sets `sessionStorage['fm:expandAddPlayerOnce'] = '1'`, and the next
`roster.js` mount reads-and-clears it to auto-open the Add Player form once. This
is `sessionStorage` (not the durable store) and deliberately *not* part of the
schema — it's the one sanctioned storage touch outside `data.js`.

---

## 8. Cross-cutting conventions

### 8.1 Escaping / XSS (I-3)

`util.js` `escapeHtml(s)` escapes `& < > " '`. **Rule:** any record-derived value
interpolated into an `innerHTML` template must be wrapped in `escapeHtml()` —
this includes values placed inside attribute values (`value="${…}"`,
`href="${…}"`). Static enum literals the code itself writes (e.g. the
`['planned','active',…]` option list) don't need it. `textContent =` assignment
is inherently safe and preferred where no markup is needed (e.g. the weekly-update
`<pre>`). Treat the **import path as hostile**: a backup's fields can contain
`<img onerror>` payloads, so escaping at the render site is the defense, not
input sanitization.

### 8.2 Money (I-4)

- Store/compute in **integer cents**.
- `util.js`: `centsToDollarsStr(cents)` → `"12.34"`; `dollarsToCents(str)` →
  rounded int, `NaN`-safe (returns 0). **Use these** — don't inline
  `(c/100).toFixed(2)` or `parseFloat(x)*100`.

### 8.3 Dates (the UTC trap)

Date fields are `"YYYY-MM-DD"` strings compared lexicographically. **Never**
build a `Date` from a bare date string (`new Date('2026-07-16')` parses as
**UTC** and shifts a day for anyone west of UTC in the evening). Always:

- For "today" and date math, import from `selectors.js`: `todayStr()` (local
  calendar date) and `addDaysStr(dateStr, n)` (calendar math, DST-safe).
- To render a stored date, parse as **local**: `new Date(dateStr + 'T00:00')`.

`selectors.js` is the single source for "today"; views/export/messaging import it
rather than keeping their own copy. Ranges are **inclusive on both ends**
(`>= start && <= end`).

---

## 9. View-by-view notes

Each view module exports `mount(container)` and follows the subscribe/re-render
loop. Common UI idiom: a collapsible **"+ Add"** form, a table with **expand
rows** for secondary fields, and an **Edit** toggle that swaps display spans for
inputs. Edits persist on `change` via the entity's `update*` helper.

### 9.1 team.js (`#/team`, default)
Dashboard: team name + season, **W–L(–T) record** (`getTeamRecord`), **Next
Game** and **Next Practice** (`getNextEventOfType`), and a **Needs Attention**
card listing stale events/fundraisers with one-tap status fixes
(`getStaleEvents`/`getStaleFundraisers`). Tolerant of missing opponents (`TBD`).

### 9.2 roster.js (`#/roster`)
Players with status filter (active/inactive/all, **active default**), position
filter, and sort (#, last name, position, balance ± direction). Position is a
**dropdown of codes** — `CB, S, DL, OL, LB, WR, RB, TE, QB, K, P, LS` — but any
legacy/custom value on a record is preserved (rendered via a label map, kept in
the option list so editing doesn't clobber it). "Follow" star sets
`settings.myPlayerId` (highlighted app-wide). Balance edits go through
`dollarsToCents`. Reads the wizard's `sessionStorage` flag to auto-open Add once.

### 9.3 schedule.js (`#/schedule`)
Unified games+practices, split **Upcoming** (ascending) / **Past**
(most-recent-first) by `date < todayStr()`. Past-dated + still-`scheduled` rows
are flagged (`⚠️`). New-opponent creation uses a styled `<dialog>` (not
`prompt()`). Games expose opponent/score fields; practices don't. `type`/`status`
label fallbacks are escaped (I-3).

### 9.4 parents.js (`#/parents`)
Parents CRUD + link/unlink children via the `playerParents` join. Delete warns it
also removes the parent's snack assignments.

### 9.5 communications.js (`#/communications`)
Renders the **weekly digest** (`buildWeeklyUpdateText`, 7-day window) into a
`<pre>` via `textContent`. **Email All** builds a multi-recipient `mailto:` from
all parent emails; per-parent Email/Text rows build `mailto:`/`sms:` links
(escaped in `href`). Copy-to-clipboard fallback for when no mail client is wired.

### 9.6 snacks.js (`#/snacks`)
**Practices only** (by design). Flags upcoming practices with no snack parent.
Assign/unassign pulls from the parent list. Deleted parents render
`(deleted parent)` (I-7). Date/time are escaped.

### 9.7 fundraisers.js (`#/fundraisers`)
Active vs **Completed** (collapsible history) fundraisers, each with a progress
bar, occurrences, and a platform link. Fields lock behind an **Edit** toggle.
New-platform creation uses a styled `<dialog>`. Money via `centsToDollarsStr`/
`dollarsToCents`.

### 9.8 settings.js (`#/settings`)
Team name/season; **Backup** (export/import with the plaintext-PII warning
adjacent to the button); **date-range Export** (xlsx/pdf, disabled when the range
is empty); the **"Keeping your data safe"** help section (the durability copy the
non-technical admin actually reads — iOS ITP eviction, Home-Screen-vs-Safari-tab
partition, URL-change data loss); **Get as App** install-instructions modal
(iPhone/Android); and a **Danger Zone** hard reset gated behind typing the literal
word `RESET`. Also a "replay the wizard" link.

---

## 10. Export, messaging, PWA, wizard, banners

### 10.1 export.js
`getEventsInRange(start,end)` inclusive + sorted. `resolveEvent` flattens an event
with **all FKs resolved tolerantly** (`(deleted parent)`, `(unknown)`).
`exportRangeToXlsx` → an **Events** sheet + an optional **Fundraisers** sheet
(occurrences overlapping the range), via vendored `window.XLSX`.
`exportRangeToPdf` → a formatted schedule via vendored `window.jspdf`.
**`outstandingBalanceCents` appears in neither** (I-9). Snack **phone** is
included in exports (it's the point of the handout).

### 10.2 messaging.js
`buildWeeklyUpdateText(daysAhead=7)` — plain-text digest of upcoming
events+snacks. `mailtoLink(emails, subject, body)` — recipients joined with
**literal commas** (encoding the comma breaks multi-recipient parsing);
subject/body via `encodeURIComponent` (**not** `URLSearchParams`, which encodes
spaces as `+` — `mailto:` needs `%20`). `smsLink` picks `&` vs `?` by iOS
detection. These encoding choices are load-bearing; don't "simplify" them.

### 10.3 PWA / service worker (sw.js)
`manifest.webmanifest` is fully relative (`start_url:"./index.html"`,
`scope:"./"`, `./icons/…`). `sw.js`:

- **`SHELL_FILES`** lists the shell + **every** `js/*.js` and `js/views/*.js`
  module + both vendored libs + all icons. If a module isn't listed, the app
  boots online (uncached fetch) but **404s offline**. Keep this list in sync with
  the `js/` tree (I-10).
- **`CACHE_NAME`** (currently `stm-shell-v10`) — **bump it on every change to any
  cached file**, or service-worker-controlled clients keep serving stale code.
  The `activate` handler deletes all caches whose name ≠ `CACHE_NAME`.
- **Fetch strategy:** cache-first for shell URLs (safe because they're pinned per
  `CACHE_NAME`), network-first for navigations (fresh HTML online, cached shell
  offline). Non-GET / cross-origin requests are ignored.

### 10.4 wizard.js / wizard-content.js
11-step first-run tour in a `<dialog>`. Auto-opens when
`settings.hasSeenWizard === false` (strict `=== false`, so a pre-v3 store where
the key is `undefined` does **not** auto-open). Any exit (finish/skip/ESC/backdrop)
sets `hasSeenWizard: true`. Step 2 is a branch ("used this before" → Settings to
restore). Step 10 is a form that writes team name/season. Copy lives in
`wizard-content.js` as pure data.

### 10.5 nudge.js / hygiene.js
App-level banners above the outlet. `nudge.js` shows when `backupNudgeDue()`.
`hygiene.js` shows a count of stale events+fundraisers with a session-only
Dismiss. Both are init-once singletons (subscribe, never unmounted) — this is
intentional and distinct from the routed-view mount contract.

---

## 11. Debugging playbook (start here when something's wrong)

Symptoms → where to look, informed by real bugs this codebase has had:

- **Data "didn't save" / disappears on reload** → `saveData()` write may be
  throwing (quota / **Private mode**). Confirm the one-time alert fired; check
  `localStorage` isn't disabled. Not a logic bug — an environment one. (§6.1)
- **Events show a day early/late** → the UTC date-parse trap. Grep for
  `new Date(` on a bare `YYYY-MM-DD`; it must be `+ 'T00:00'` or go through
  `selectors.js`. (§8.3)
- **Markup/script from a record renders as HTML** → a missing `escapeHtml()`.
  Grep every `innerHTML` template for interpolated record fields, *including*
  attribute values and the **import path**. (§8.1, I-3)
- **App boots online but is a blank/"Loading…" shell offline** → a module missing
  from `SHELL_FILES`, or `CACHE_NAME` not bumped so an old cache is serving.
  Diff `SHELL_FILES` against the `js/` tree; confirm the bump. (§10.3, I-10)
- **Old code keeps running after a deploy** → same: `CACHE_NAME` wasn't bumped;
  the SW is serving the previous cache. Bump it.
- **A view throws after deleting a parent/opponent/player** → a read site not
  tolerating a null/missing FK. Add a placeholder; check the delete helper's
  cascade/nullify. (§5.3, I-7)
- **Wizard won't stop reopening / never opens** → `hasSeenWizard` semantics.
  Remember the strict `=== false` gate and the `migrate()` default. (§6.2, §10.4)
- **Money is a penny off or shows `NaN`** → inline float math instead of the
  `util.js` helpers. (§8.2)
- **Two tabs clobber each other** → the `storage` listener isn't reloading, or a
  view mutated `_cache` without calling a `saveData()` helper. (§6.4)
- **`localStorage` full / QuotaExceeded** → the store is one JSON blob; large
  numbers of records/notes can grow it. Backup + hard reset is the escape hatch.

**Verification harness.** There's no unit-test suite; the established method is a
headless-Chromium smoke test driven by Playwright against a locally served copy:

```
python3 -m http.server 8410      # serve the /Football app dir
# then drive http://localhost:8410 with Playwright (Chromium):
#   fresh boot → seed + default route + zero console errors
#   populate every entity (incl. deliberately orphaned FKs)
#   visit all 8 routes → no throws, placeholders render
#   backup → wipe → import → deep-equal round-trip
#   feed corrupt / wrong-shape / newer-version / truncated backups → store untouched
#   date-range xlsx+pdf with an orphaned-FK event in range
#   weekly digest + mailto href well-formed (%20 not +)
#   offline (setOffline after SW install) → reload → app fully boots
#   crafted-backup XSS probe (<img onerror> in fields) → nothing executes
#   viewport sweep 320/360/375/390px → no page-level horizontal overflow
#   network log → zero non-repo origins
```

Modules import cleanly in the page via
`await import(new URL('./js/data.js', location.href).href)`, so a test can call
`getData()`/`add*()` directly to set up state.

---

## 12. Known constraints & non-goals

- **Single user, single team, single device.** `settings.myPlayerId` is a
  highlight preference, **not** an identity/auth system. No multi-user, no
  parent-facing access — that would be a different product.
- **`localStorage` is a cache, not a database.** Anything durability-related is
  first-class; don't treat backup/restore as optional polish.
- **No build step, no npm for app code, no CDN.** New libraries must be vendored
  into `js/vendor/` at a pinned version.
- Deferred (out of scope unless explicitly re-scoped): backend swap
  (Firebase/Supabase would repoint only `loadData`/`saveData` + persistence —
  schema and `export.js` unchanged), auto-backup, parent-facing access.

---

## 13. Repo migration (root → `/Football/`)  ← read before moving files

The app tree nests one level down into `/Football/`. Because **all in-app paths
are relative** (I-5), the internal references (`./js/…`, `./css/…`, `./icons/…`,
manifest, SW cache list, SW registration `./sw.js`) need **no edits** — they
resolve relative to `index.html`/`sw.js` wherever that folder sits.

Two things that are **not** obvious:

1. **`.nojekyll` must stay at the *published root*, not inside `/Football/`.**
   GitHub Pages runs Jekyll on the publishing source's root and, without
   `.nojekyll`, strips files/dirs beginning with `_` and can interfere with the
   served tree. Keep an empty `.nojekyll` at the **repo root** (or whatever
   directory Pages is set to publish). It is a repo-housekeeping file, not an app
   file — do not bury it under `/Football/`. (`.gitignore` likewise stays at repo
   root.)

2. **`localStorage` is scoped to the *origin*, not the path.** All GitHub Pages
   project sites for one account are served from the same origin
   `https://<user>.github.io` (the `/<repo>/…` path is *not* part of the origin).
   Consequences:
   - Moving from `…github.io/OldRepo/` to `…github.io/NewRepo/Football/` keeps
     the **same origin**, so the existing `stm:v1` store is **still there** — data
     carries over automatically, no export/import needed. (If instead you move to
     a **custom domain**, the origin changes and the store does **not** follow —
     then the backup file is the only bridge, exactly as the in-app help warns.)
   - Because the key `stm:v1` is shared across every app on that origin, do **not**
     run a second app using the same key on the same `github.io` account, or the
     two will read/write each other's data. If you ever co-host, namespace the
     key. Same caution for `CACHE_NAME`: the SW `activate` handler deletes caches
     it doesn't own, so a second app reusing the `stm-shell-*` scheme on the same
     origin could evict this one's cache. The SW *scope* (`/Football/`) isolates
     which fetches it handles, but Cache Storage itself is per-origin.

**Migration checklist**
- [ ] Move `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `icons/`, `js/`
      (and this `DESIGN.md`) into `/Football/`.
- [ ] Keep `.nojekyll` and `.gitignore` at the **repo root**.
- [ ] In GitHub Pages settings, note the app now lives at
      `https://<user>.github.io/<newrepo>/Football/` — that's the URL to install
      and to give the admin.
- [ ] Sanity pass: DevTools Network shows zero non-repo origins; every
      `./js/*.js` in `SHELL_FILES` returns 200 at the new path; SW registers with
      scope `…/Football/`; offline reload boots the working app.
- [ ] If the old app was live on the same `github.io` account, take it down (or
      confirm it used a different key) so the two don't share `stm:v1`.
- [ ] Bump `CACHE_NAME` once after the move so returning clients re-cache at the
      new paths.

---

*End of reference. Keep this file in lockstep with the code — it is the only doc
carried into the new repo.*
