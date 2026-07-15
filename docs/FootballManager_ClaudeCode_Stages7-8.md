# Football Manager — Claude Code Build Instructions (Stages 7–8)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained for Stages 7–8 and
repeats everything you need.

**Stages 0–6 are already implemented**: storage core, integrity-enforcing
mutations, cross-tab sync, first-run seeding, the router, all six CRUD
views, and backup/restore all exist and pass their gates. (PWA scaffolding —
manifest, service worker, icons — has also landed and may have modified
`index.html` further; that work is independent of this stage.) **Read the
current `index.html`, `js/data.js`, and `js/util.js` before editing them** so
you extend what's there instead of duplicating or conflicting with it.

Your job now: vendor the two export libraries, then build `js/export.js` and
wire a date-range export panel into Settings.

## Hard rules (do not violate these)

1. **UI code never touches `localStorage` directly.** `export.js` reads only
   through the getters already exported by `js/data.js`.
2. **No build step.** Plain files, no bundler, no npm install for app code.
3. **Vendor once, load locally, never call out at runtime.** Both libraries
   get downloaded a single time to `js/vendor/`, committed to the repo, and
   loaded via a local `<script>` tag. After this stage, opening the Network
   tab must show **zero** requests to `cdn.sheetjs.com`, `unpkg.com`,
   `cdn.jsdelivr.net`, `github.com`, or any other non-repo origin — this is
   the same "no third-party scripts" rule that's been in force since Stage 0,
   now extended to cover these two files.
4. **Pin exact versions, and record them.** Don't reference a `-latest`
   alias or an unpinned tag anywhere in the committed code. Resolve to a
   concrete version number before downloading, and write that version (plus
   the date vendored) into `FootballManager_Architecture.md` §2, replacing
   the "Pin the versions; record them in this file when you vendor them"
   placeholder note.
5. **Money is still integer cents in storage.** `export.js` converts to
   dollar strings only at the point of writing a cell/line — never stores or
   passes around a float internally.
6. **`Player.outstandingBalanceCents` is intentionally excluded** from both
   export formats (it's a static per-player fact, not tied to a date range —
   see architecture §8). Don't add it as a column or line anywhere in this
   stage's output.
7. **Tolerate missing foreign keys.** A deleted parent or opponent must
   render as a placeholder string (`(deleted parent)`, `(unknown)`), never
   throw.
8. **Stop after Stage 8's acceptance gate passes.** Final hardening and
   deploy verification is a separate follow-up stage, out of scope here.

---

## Stage 7 — Vendored export libraries

### Step 1 — Resolve pinned versions

Before downloading anything, resolve each library to a specific version
number (do this at build time, since "latest" will have moved on from
whatever's written here):

- **SheetJS Community Edition** — check the current stable release at
  `https://cdn.sheetjs.com/` or the `xlsx` npm package page. As of this
  writing the 0.20.x line (e.g. `0.20.3`) is current; confirm rather than
  assume.
- **jsPDF** — check the current stable release at
  `https://github.com/parallax/jsPDF/releases` or the `jspdf` npm package
  page.

Whatever you resolve, write it down — it goes in the download URL, a
comment, and the architecture doc.

### Step 2 — Download each file once

```bash
# SheetJS — replace <XLSX_VERSION> with the resolved version, e.g. 0.20.3
mkdir -p js/vendor
curl -L -o js/vendor/xlsx.full.min.js \
  "https://cdn.sheetjs.com/xlsx-<XLSX_VERSION>/package/dist/xlsx.full.min.js"

# jsPDF — replace <JSPDF_VERSION> with the resolved version
curl -L -o js/vendor/jspdf.umd.min.js \
  "https://unpkg.com/jspdf@<JSPDF_VERSION>/dist/jspdf.umd.min.js"
```

Sanity-check both downloads before committing:
- Neither file is empty or an HTML error page (`head -c 200
  js/vendor/xlsx.full.min.js` should show minified JS, not `<!DOCTYPE
  html>`).
- `js/vendor/xlsx.full.min.js` exposes a global `XLSX` object when loaded in
  a page.
- `js/vendor/jspdf.umd.min.js` exposes `window.jspdf.jsPDF` when loaded in a
  page.

### Step 3 — Record the versions

Edit `FootballManager_Architecture.md` §2's vendor bullet list to state the
exact versions and the date vendored, e.g.:

```
- `js/vendor/xlsx.full.min.js` — SheetJS Community Edition v<XLSX_VERSION>,
  vendored <date>.
- `js/vendor/jspdf.umd.min.js` — jsPDF v<JSPDF_VERSION>, vendored <date>.
```

### Step 4 — Load both scripts locally

Open the current `index.html` (it's been modified by Stages 4–6 and PWA
scaffolding — read it first). Add two **plain, non-module** `<script>` tags
immediately **before** the existing `<script type="module">` boot block, so
`window.XLSX` and `window.jspdf` both exist before any view's module code
could reference them:

```html
<script src="./js/vendor/xlsx.full.min.js"></script>
<script src="./js/vendor/jspdf.umd.min.js"></script>
<script type="module">
  ...existing boot code (seedIfNeeded, initRouter, initNudgeBanner, sw
  registration)...
</script>
```

Plain `<script>` tags run in document order, immediately; `type="module"`
scripts are deferred until after parsing — so this ordering guarantees both
globals are populated first regardless of load timing.

### Optional — precache the vendor files for offline export

The PWA service worker's `SHELL_FILES` list intentionally excludes
`js/*.js` because app code changes often during development. These two
vendor files are the opposite — large, static, and effectively frozen once
pinned. If you want export to work while offline (not required by this
stage's gate, but cheap to add), append both paths to `SHELL_FILES` in
`sw.js` and bump `CACHE_NAME` so the new list actually gets cached:

```js
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/vendor/xlsx.full.min.js',
  './js/vendor/jspdf.umd.min.js'
];
```

### Stage 7 acceptance gate

- Console: `window.XLSX` and `window.jspdf.jsPDF` are both defined on every
  page load, with no import statements needed to get them.
- DevTools Network tab, on a full reload: **zero** requests to any origin
  other than the repo's own Pages origin — confirm the vendor files are
  served from `js/vendor/`, not fetched remotely.
- Both files are committed to the repo, and
  `FootballManager_Architecture.md` §2 states the exact pinned versions and
  the date vendored (no `-latest` references anywhere).

---

## Stage 8 — Date-range export (`js/export.js`)

### `js/export.js`

Reuses the cents→dollars formatter already added to `js/util.js` in Stage
4–6 rather than duplicating it.

```js
// js/export.js
import {
  getData, getOpponentById,
  getParentById, getSnackAssignmentsForEvent
} from './data.js';
import { centsToDollarsStr } from './util.js';

const centsToStr = c => `$${centsToDollarsStr(c)}`;

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

// ---------- Excel — requires vendored SheetJS on window.XLSX ----------
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

// ---------- PDF — requires vendored jsPDF on window.jspdf ----------
export function exportRangeToPdf(startDate, endDate, teamName = '') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const M = 48;
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

  line(`${teamName ? teamName + ' — ' : ''}Schedule ${startDate} to ${endDate}`,
       { size: 15, bold: true, gap: 22 });

  const events = getEventsInRange(startDate, endDate);
  if (!events.length) { line('No events in this range.'); }

  events.forEach(e => {
    const r = resolveEvent(e);
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

    y += 8;                                    // gap between blocks
    doc.setDrawColor(220).line(M, y, W - M, y); // divider
    y += 14;
  });

  doc.save(`schedule_${fileStamp(startDate, endDate)}.pdf`);
}
```

> Note: `export.js` references the bare globals `XLSX` and `window.jspdf`
> rather than importing them — that's correct and expected. Both vendor
> files are classic (non-module) UMD scripts that attach to `window`;
> there's nothing to `import` from them.

### Where the export UI lives

Architecture §8.4 allows either Settings or a small panel on Schedule.
**This build puts it in Settings**, alongside the existing backup section —
Settings is already the "data operations" home (team name, backup/restore),
and keeping Schedule focused on the event list/calendar avoids cluttering
the view that gets used most often for day-to-day entry. Flagging this as a
deliberate placement choice, not an ambiguity left unresolved.

### `js/views/settings.js` — extend with the export section

Replace the Stage 6 version of this file with the full version below (team
name/season and backup logic are unchanged; the export section is new):

```js
import {
  getSettings, updateSettings, subscribe,
  exportBackup, importBackup, getData, backupNudgeDue
} from '../data.js';
import { exportRangeToXlsx, exportRangeToPdf, getEventsInRange } from '../export.js';

function isoDate(d) { return d.toISOString().slice(0, 10); }

export function mount(container) {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);

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

    <section class="export-section">
      <h3>Export Schedule</h3>
      <label>From <input type="date" id="export-start" value="${isoDate(today)}" /></label>
      <label>To <input type="date" id="export-end" value="${isoDate(in30)}" /></label>
      <br/>
      <button id="export-xlsx-btn">Download Excel</button>
      <button id="export-pdf-btn">Download PDF</button>
      <p id="export-empty-msg" class="warning" hidden>No events in range.</p>
    </section>
  `;

  const teamInput = container.querySelector('#team-name');
  const seasonInput = container.querySelector('#season');
  const statusEl = container.querySelector('#last-backup-status');
  const exportBtn = container.querySelector('#export-backup-btn');
  const importInput = container.querySelector('#import-backup-input');

  const startInput = container.querySelector('#export-start');
  const endInput = container.querySelector('#export-end');
  const xlsxBtn = container.querySelector('#export-xlsx-btn');
  const pdfBtn = container.querySelector('#export-pdf-btn');
  const emptyMsg = container.querySelector('#export-empty-msg');

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

    updateExportButtons();
  }

  function updateExportButtons() {
    const hasEvents = getEventsInRange(startInput.value, endInput.value).length > 0;
    xlsxBtn.disabled = !hasEvents;
    pdfBtn.disabled = !hasEvents;
    emptyMsg.hidden = hasEvents;
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

  startInput.addEventListener('change', updateExportButtons);
  endInput.addEventListener('change', updateExportButtons);
  xlsxBtn.addEventListener('click', () => exportRangeToXlsx(startInput.value, endInput.value));
  pdfBtn.addEventListener('click', () =>
    exportRangeToPdf(startInput.value, endInput.value, getSettings().teamName));

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
```

`render()` (triggered by every `subscribe()` callback, i.e. any data change
anywhere in the app) only touches the export section's disabled/hidden
state — it never overwrites `startInput`/`endInput`'s values, so an
in-progress date selection can't get clobbered by an unrelated edit in
another tab, the same concern the `document.activeElement` guard already
handles for team name/season.

### Stage 8 acceptance gate

- `getEventsInRange` is inclusive on both ends (an event dated exactly on
  `startDate` or `endDate` is included) and returns results sorted by
  date then `startTime`.
- Create an event with a snack assignment, then delete that parent and
  that event's opponent (if a game). Exporting a range covering that event
  shows `(deleted parent)` / `(unknown)` in both the `.xlsx` and `.pdf`
  output instead of throwing.
- A populated range produces a valid `.xlsx` with one row per event and,
  only when a fundraiser occurrence overlaps the range, a second
  `Fundraisers` sheet.
- A range with enough events to overflow one PDF page produces a second
  page, with no block split across the page break (verify via the
  page-break check before each event's header).
- An empty range disables **both** buttons and shows "No events in range";
  changing either date input re-evaluates and re-enables them the moment
  the range becomes non-empty.
- Confirm `outstandingBalanceCents` does not appear anywhere in either
  export format.
- DevTools Network tab during an export shows no third-party requests —
  everything runs off the vendored libraries.

---

## Stop point

Once Stage 8's gate passes, **stop**. Final hardening (durability
walkthrough documentation, cross-browser/Safari-iOS smoke test, empty-state
pass on every view, final deploy verification) is Stage 9 and is a separate
follow-up handoff, out of scope here.
