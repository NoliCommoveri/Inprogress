// settings.js — team name/season, backup/restore, date-range export.
import {
  getSettings, updateSettings, subscribe,
  exportBackup, importBackup, getData, backupNudgeDue
} from '../data.js';
import { exportRangeToXlsx, exportRangeToPdf, getEventsInRange } from '../export.js';
import { todayStr, addDaysStr } from '../selectors.js';

export function mount(container) {
  const today = todayStr();
  const in30 = addDaysStr(today, 30);

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
      <label>From <input type="date" id="export-start" value="${today}" /></label>
      <label>To <input type="date" id="export-end" value="${in30}" /></label>
      <br/>
      <button id="export-xlsx-btn">Download Excel</button>
      <button id="export-pdf-btn">Download PDF</button>
      <p id="export-empty-msg" class="warning" hidden>No events in range.</p>
    </section>

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
      try {
        await importBackup(file);
        alert('Backup imported.');
      } catch (err) {
        alert('Import failed. ' + err.message);   // store left untouched
      }
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
