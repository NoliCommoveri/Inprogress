# Football Manager — Claude Code Build Instructions (Stage 9 — Hardening & Deploy)

You are finishing **Football Manager**, a static HTML/JS app. No backend, no
build step, hosted on GitHub Pages, single admin user, all data in
`localStorage`. Full context is in `FootballManager_Architecture.md` if you
have access to it — this document is self-contained for Stage 9 and repeats
what you need.

**Everything before this is already implemented and passing its gates:**
storage core + integrity mutations (0–3), router + six CRUD views + backup
(4–6), vendored SheetJS/jsPDF + date-range export (7–8), the messaging /
Weekly-Update layer (8.5), and PWA scaffolding (manifest, `sw.js`, icons).
**Read the current `index.html`, `js/data.js`, `js/util.js`, `sw.js`, and
`js/views/settings.js` before editing them** so you extend what's there
instead of duplicating or conflicting with it.

Your job now is hardening and deploy — no new entities, and (with one
deliberate exception in 9.3) no new behavior. This stage adds **no schema
fields, no `schemaVersion` bump, no migration**. It closes the gaps that
opened as later stages (PWA, messaging) landed after the original plan was
written.

## Hard rules (carry over from the base spec)

1. **UI code never touches `localStorage` directly.** Everything routes
   through `js/data.js`.
2. **No build step, no third-party scripts, no CDN.** Same-origin only —
   PII lives in `localStorage`.
3. **Money is integer cents in storage.** Convert at the render/input
   boundary only.
4. **Escape record-derived text** before interpolating into `innerHTML`
   (`escapeHtml()` from `js/util.js`).
5. **Relative paths only** (`./…`, never `/…`) — Pages serves from a project
   subpath.
6. **Stop after Stage 9's gate passes.** This is the last handoff.

---

## Why this stage exists (what the original plan missed)

The `BuildPlan.md` Stage 9 was written before PWA scaffolding and Stage 8.5
existed. Three things it lists are now stale or incomplete, and two new
failure modes appeared:

- The **durability walkthrough** it calls for was scoped as admin-facing
  docs, but a solo non-developer admin will never open the repo. It has to
  live **in the app** (9.4). It also predates the two biggest real-world
  data-loss traps: the **iOS installed-app-vs-Safari-tab storage split** and
  the fact that **installing to the home screen mitigates ITP eviction**.
- The **PWA offline gate** ("cached shell instead of the offline error
  page") passes on a technicality: the shell renders, but its ES-module
  imports hit the network and fail, so the app never hydrates offline. 9.3
  fixes this for real.
- `importBackup` **never validated its input** (Architecture §7 asked it
  to). One bad file can corrupt the in-memory store. 9.2 hardens it.
- There has been **no CSS** — views reference classes (`.my-player`,
  `.progress-fill`, `.nudge`, `.disabled`, …) that don't exist, and the iOS
  `black-translucent` status bar slides content under the notch. 9.1 does a
  minimal functional pass.

---

## Stage 9.1 — Minimal functional CSS pass

Scope: make the class hooks the views already emit *do something*, make the
app legible on a phone, and fix the iOS safe-area bug. This is **functional,
not a design exercise** — distinctive visual polish is explicitly deferred
(see the deferral list). Keep it small.

### `index.html` — CHANGE the viewport tag

`env(safe-area-inset-*)` returns `0` on iOS unless the viewport opts into the
full screen. The current tag doesn't, so the safe-area padding below would be
a no-op without this:

```html
<!-- was: <meta name="viewport" content="width=device-width, initial-scale=1.0" /> -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### `css/styles.css` — replace the empty/near-empty file

```css
:root {
  --brand: #123524;
  --danger: #a4243b;
  --ok: #2e7d32;
  --line: #ddd;
  --warn-bg: #fff4e5;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font: 15px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #1a1a1a;
}

/* Header carries the iOS status-bar inset (black-translucent draws under it). */
header {
  background: var(--brand);
  color: #fff;
  padding: calc(env(safe-area-inset-top) + 10px) 12px 10px;
}
header h1 { margin: 0 0 8px; font-size: 1.15rem; }

nav#main-nav { display: flex; flex-wrap: wrap; gap: 4px; }
nav#main-nav a {
  color: #fff; text-decoration: none;
  padding: 6px 10px; border-radius: 6px; font-size: .95rem;
}
nav#main-nav a.active { background: rgba(255, 255, 255, .22); font-weight: 600; }

main#outlet {
  padding: 12px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 24px);
  max-width: 960px; margin: 0 auto;
}

/* App-wide backup nudge banner (Stage 6) */
#nudge-banner {
  background: var(--warn-bg); border-bottom: 1px solid #e0b070;
  padding: 8px 12px; font-size: .9rem;
}
#nudge-banner a { color: var(--brand); font-weight: 600; }

/* Tables (roster / parents / schedule / snacks) */
table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px 5px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; color: #555; }
input, select, button { font: inherit; padding: 4px 6px; }
input[type="date"], input[type="time"], input[type="number"] { max-width: 100%; }

/* Roster row states */
tr.my-player { background: #fffbe6; }
tr.my-player td:first-child { box-shadow: inset 3px 0 0 #f2c200; }
tr.inactive { opacity: .55; }
.star-btn { border: none; background: none; cursor: pointer; font-size: 1.1rem; }

/* Destructive buttons */
.delete-btn, .delete-fundraiser-btn, .unlink-btn, .unassign-btn, .delete-occ-btn {
  color: var(--danger); border: 1px solid currentColor; background: #fff;
  border-radius: 5px; cursor: pointer;
}
.unlink-btn, .unassign-btn { padding: 0 6px; }

/* Snacks unassigned flag */
tr.unassigned-flag { background: #fdecec; }

/* Fundraisers */
.fundraiser-card {
  border: 1px solid var(--line); border-radius: 8px;
  padding: 12px; margin-bottom: 12px;
}
.progress-bar {
  height: 10px; background: #eee; border-radius: 5px; overflow: hidden; margin: 8px 0;
}
.progress-fill { height: 100%; background: var(--ok); }
.occurrence-list { list-style: none; padding-left: 0; margin: 8px 0; }
.occurrence-list li { padding: 4px 0; }

/* Settings sections */
.backup-section, .export-section, .help-section {
  border-top: 1px solid var(--line); margin-top: 16px; padding-top: 12px;
}
.warning { background: var(--warn-bg); padding: 8px 10px; border-radius: 6px; font-size: .9rem; }
#last-backup-status.nudge { color: var(--danger); font-weight: 600; }

/* Weekly Update (Stage 8.5) */
.weekly-update { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 12px; }
.weekly-update pre {
  white-space: pre-wrap; background: #f7f7f7;
  padding: 10px; border-radius: 6px; font-size: .9rem;
}

/* Buttons / links styled as buttons */
.btn {
  display: inline-block; background: var(--brand); color: #fff;
  padding: 7px 12px; border-radius: 6px; text-decoration: none; cursor: pointer;
}

/*  CRITICAL: "Email All Parents" is an <a>, not a <button>. messaging.js
    toggles the .disabled CLASS on it — without pointer-events:none the link
    still fires a recipient-less mailto when clicked. Same for any .btn. */
.btn.disabled, a.disabled { opacity: .5; pointer-events: none; }

/* Native disabled buttons (export buttons) */
button:disabled { opacity: .5; cursor: not-allowed; }
```

> The `a.disabled { pointer-events: none }` rule isn't cosmetic — it's the
> only thing stopping the "disabled" Email-All link from opening a broken
> `mailto:` with no recipients. Don't drop it.

---

## Stage 9.2 — Harden `importBackup` (shape validation)

Right now `importBackup` does `migrate(JSON.parse(...))` and replaces the
store with no checks. A non-JSON file throws mid-way; a valid-JSON-but-wrong-
shape file either throws inside `migrate` (which assumes `data.meta` exists)
or silently persists garbage. Architecture §7 says import must *validate*
`schemaVersion` and migrate — this closes that gap. Validate **before**
touching `_cache`, so a bad import leaves the live store untouched.

### `js/data.js` — ADD a validator

```js
const REQUIRED_ARRAYS = [
  'players', 'parents', 'playerParents', 'opponents', 'events',
  'snackAssignments', 'fundraiserPlatforms', 'fundraisers', 'fundraiserOccurrences'
];

function isValidStore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (typeof data.schemaVersion !== 'number') return false;
  if (!data.meta || typeof data.meta !== 'object') return false;
  if (!data.settings || typeof data.settings !== 'object') return false;
  return REQUIRED_ARRAYS.every(k => Array.isArray(data[k]));
}
```

### `js/data.js` — REPLACE `importBackup`

```js
export async function importBackup(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON — it may be corrupted or not a backup file.");
  }
  if (!isValidStore(parsed)) {
    throw new Error("That file doesn't look like a Football Manager backup (missing expected data). Nothing was changed.");
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    // A backup from a NEWER version of the app. We can migrate forward, never
    // safely backward — refuse rather than silently drop fields we don't know.
    throw new Error("This backup was made by a newer version of the app. Update the app before importing it. Nothing was changed.");
  }
  const migrated = migrate(parsed);   // shape + meta now guaranteed present
  _cache = migrated;
  saveData({ countAsChange: false });
  _subs.forEach(fn => fn());
}
```

Only `_cache` is reassigned *after* validation passes, so a rejected file
never corrupts the in-memory store — the admin can retry with a good file.

### `js/views/settings.js` — CHANGE the import handler to catch failures

The current handler assumes `importBackup` always succeeds. Wrap it:

```js
importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  if (!file) return;
  const ok = confirm(
    'Importing will REPLACE all current data with the contents of this backup file. This cannot be undone. Continue?'
  );
  if (ok) {
    try {
      await importBackup(file);
      alert('Backup imported.');
    } catch (err) {
      alert('Import failed. ' + err.message);   // store left untouched
    }
  }
  importInput.value = '';
});
```

---

## Stage 9.3 — Make the PWA actually work offline

**This is the one deliberate behavior change in Stage 9.** The service worker
precaches only the HTML shell + CSS + icons and skips `js/*.js` (Stage-time
choice: "app code changes often"). Offline, the cached `index.html` renders
"Loading…", then its module imports (`data.js`, the router, the dynamically-
imported views) hit the network, fail, and the app never boots. At deploy the
app has stabilized, so flip that tradeoff: precache the app's JS and the
vendored libs, and lean on `CACHE_NAME` discipline to avoid staleness.

### `sw.js` — CHANGE `SHELL_FILES` and bump `CACHE_NAME`

```js
const CACHE_NAME = 'stm-shell-v2';   // was 'stm-shell-v1' — MUST bump so the
                                     // new file list actually gets cached

const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // app modules
  './js/data.js',
  './js/util.js',
  './js/router.js',
  './js/seed.js',
  './js/nudge.js',
  './js/messaging.js',
  './js/export.js',
  './js/views/roster.js',
  './js/views/parents.js',
  './js/views/schedule.js',
  './js/views/snacks.js',
  './js/views/fundraisers.js',
  './js/views/settings.js',
  // vendored libs (large, frozen once pinned)
  './js/vendor/xlsx.full.min.js',
  './js/vendor/jspdf.umd.min.js'
];
```

The existing install/activate/fetch logic doesn't change: network-first for
navigations (fresh HTML when online), cache-first for everything else.

Two things to know and note:

- **`cache.addAll` is atomic** — if any one path 404s, the whole install
  fails and nothing caches. Verify every path above exists at those exact
  names before deploying (the view files, `messaging.js`, and both vendor
  files must all be present).
- **Cache-first + unhashed filenames = one stale load after deploy.** Because
  files aren't content-hashed, a deploy that changes JS won't be seen until
  the new SW installs, activates, and clears the old cache — typically on the
  *next* launch after the one that fetches the new SW. Bumping `CACHE_NAME`
  on every deploy that changes cached files is what guarantees the refresh
  eventually happens. For a weekly single-user tool this one-load lag is
  fine; just don't forget the bump (see 9.7).

**Revised offline expectation** (supersedes the PWA doc's weaker gate):
airplane mode → relaunch → the **fully working app** loads and reads existing
`localStorage` data, not just a "Loading…" shell. Export still works offline
(vendored libs are cached). New online-only features: none — the whole app is
local.

---

## Stage 9.4 — In-app durability / help section

The `BuildPlan.md` durability walkthrough must be **in the app**, not a repo
README the admin will never see. Add a collapsible Help section to Settings.
Copy is static (no record data), so no escaping needed. Write it in plain,
non-technical language.

### `js/views/settings.js` — ADD to the `container.innerHTML`

Append this section after the existing `.export-section`:

```html
<section class="help-section">
  <h3>Keeping your data safe (read me)</h3>
  <details>
    <summary>Where your data lives &amp; how to not lose it</summary>
    <p>All your team's info is stored <strong>only in this browser, on this
       device</strong>. There is no cloud copy. That means:</p>
    <ul>
      <li><strong>Back up often.</strong> Use "Export Backup" above and keep
          the file somewhere safe (see the private-info warning there).</li>
      <li><strong>Clearing browsing data / history wipes it.</strong> If you
          clear cookies and site data for this site, your team data goes with
          it. Export a backup first.</li>
      <li><strong>Private / Incognito windows don't save anything.</strong>
          Always use a normal window for real data.</li>
      <li><strong>iPhone / Safari auto-deletes after ~7 days unused.</strong>
          If you don't open the site for about a week, Safari can erase its
          data. Open it weekly — or better, <em>add it to your Home Screen</em>
          (Share → Add to Home Screen), which makes the data much more
          durable.</li>
      <li><strong>iPhone: the Home Screen app and the Safari tab are separate.</strong>
          They keep <em>separate</em> copies of the data. Pick one and always
          use that one. If you added it to your Home Screen, stop using the
          Safari tab (and vice-versa), or you'll be editing two different
          copies.</li>
      <li><strong>Moving to a new web address loses the data.</strong> If the
          site's URL ever changes (a custom domain, a different repo), it
          starts empty. Export a backup on the old address and import it on
          the new one — that's the only bridge.</li>
    </ul>
    <p>The short version: <strong>export a backup regularly</strong>, and on
       iPhone, install it to your Home Screen and stick to that one copy.</p>
  </details>
</section>
```

No JS wiring needed — `<details>` is native. Confirm the existing `render()`
doesn't clobber this static markup (it only sets input values and the backup
status line, so it won't).

---

## Stage 9.5 — Empty-state & error-tolerance verification

Mostly a verification pass; fix anything that fails. Confirm each is true (the
listed views already implement most of these — the task is to *prove* it, not
rebuild it):

- **Every list has an empty state**, not a bare table: Roster "No players
  yet", Parents "No parents yet", Schedule "No events yet", Snacks "No
  practices scheduled", Fundraisers "No fundraisers yet". (All present in
  Stage 5 — verify none regressed.)
- **Snacks with zero parents** shows "(no parents)" in the assign cell, not a
  broken empty `<select>`.
- **Weekly Update with zero upcoming events** shows the "No practices or
  games scheduled…" fallback (Stage 8.5), and **Email All with zero emails**
  is disabled and labeled — now actually un-clickable thanks to 9.1's
  `a.disabled` rule.
- **Deleted foreign keys tolerated everywhere they surface**: export shows
  `(deleted parent)` / `(unknown)`; snacks show `(deleted parent)`; parents/
  schedule don't throw on an orphaned link. (Resolvers already do this —
  spot-check by deleting a parent/opponent that's still referenced.)
- **Export empty range** disables both buttons and shows "No events in
  range".
- **`myPlayerId` pointing at a deleted player** clears to `null` (Stage 2
  `deletePlayer`) — the star just disappears, no crash.

If any view throws on empty/orphaned data, fix it in that view with the same
tolerant-placeholder pattern already used elsewhere. No new patterns.

---

## Stage 9.6 — Cross-browser & insecure-context smoke test

- **Safari / iOS** (the ITP eviction target): full walkthrough on a real
  iPhone if possible — enter data, add to Home Screen, relaunch standalone,
  confirm data present and header sits below the notch (9.1). Re-confirm the
  installed-app-vs-tab partition note from 9.4 by checking data entered in one
  doesn't appear in the other.
- **Chrome / Android**: install banner, standalone launch, maskable icon not
  clipped.
- **Desktop Chrome + one of Firefox/Safari**: all six views, backup
  round-trip, export.
- **Insecure-context `uuid()` fallback**: open `index.html` via `file://`
  (not `http://`) and confirm `crypto.randomUUID` absence falls back without
  error — adding a record still produces a valid id. (Note: ES-module `import`
  may be blocked under `file://` in some browsers; if so, test the fallback by
  temporarily forcing the non-`crypto` branch in a served context instead, and
  document that `file://` isn't a supported run mode.)
- **Offline** (9.3): airplane mode → relaunch → working app, and an export
  still downloads.

---

## Stage 9.7 — Deploy checklist

- [ ] **Bump `CACHE_NAME`** in `sw.js` (tie to 9.3 — do this on *every*
      deploy that changes any cached file, or stale assets serve from cache).
- [ ] Verify **no third-party requests**: DevTools Network tab on a full
      reload and during an export shows only the repo's own Pages origin —
      zero CDN / analytics / font hits. Hard rule since Stage 0.
- [ ] Verify **vendored versions are recorded** in
      `FootballManager_Architecture.md` §2 (exact SheetJS + jsPDF versions and
      vendored date — from Stage 7). No `-latest` references anywhere.
- [ ] Verify **brand color `#123524` is consistent** across
      `manifest.webmanifest` (×2), the `theme-color` meta in `index.html`, and
      the icon-generation `BG` — they're hand-synced and easy to drift.
- [ ] Verify **all paths are relative** (`./…`) — manifest `start_url`/
      `scope`/icon `src`, the manifest `<link>`, the two vendor `<script>`
      tags, and the module boot. A leading `/` 404s on the Pages subpath.
- [ ] **Full dry run on the live URL**: seed → data entry across all views →
      export backup → clear site data (simulated wipe) → import backup →
      date-range Excel + PDF export → Weekly Update email/copy. Completes
      cleanly end to end.
- [ ] Deploy from `main`, root.

### Stage 9 acceptance gate

- The app is styled and legible on a phone; the iOS header clears the notch;
  the "disabled" Email-All link is genuinely un-clickable.
- Importing a corrupt or wrong-shape file shows a clear message and leaves
  existing data **completely untouched**; a valid backup still restores.
- Airplane mode → relaunch → the **fully working app** loads from cache
  (not just a "Loading…" shell), reads existing data, and can still export.
- The in-app "Keeping your data safe" section is present in Settings and
  covers all §1.1 failure modes plus the iOS partition trap and the
  install-mitigates-eviction tip.
- Every view survives empty and orphaned-reference data without throwing.
- The full dry run in 9.7 passes on the live Pages URL, and the Network tab
  shows zero non-repo origins throughout.

---

## Accepted deferrals (deliberate, not misses)

These were considered and intentionally left out of scope:

- **One-tap auto-backup when the nudge fires** (Architecture §1.1 mitigation
  4). The nudge currently just links to Settings; the admin exports manually.
  Additive later if wanted.
- **Idle-timer nudge.** `backupNudgeDue()` is only re-evaluated on a data
  change (a `subscribe()` fire), so the ">3 days" nudge won't pop on its own
  if the app sits open and untouched. It fires on the next edit or reload,
  which is sufficient for a weekly tool.
- **Distinctive visual design.** 9.1 is a functional pass only (legibility,
  class hooks, safe-area). A real design system / brand treatment is a
  separate effort.
- **SMS group broadcast** and **file attachments via the Web Share API** —
  already deferred in Stage 8.5 for the same reasons (unreliable multi-
  recipient `sms:`; attachments are a different mechanism).
- **Backend swap (Firebase/Supabase) and parent-facing access** — a different
  product (Architecture §10). Only `loadData()`/`saveData()` + mutation
  persistence would move; schema and `export.js` stay put.

---

## Stop point

Once Stage 9's gate passes, the app is done. There is no Stage 10 in the
current plan — anything beyond here is on the deferral list above and is a
new, optional effort rather than a continuation of this build.
