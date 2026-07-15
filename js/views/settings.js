// settings.js — team name/season, backup/restore, date-range export.
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
