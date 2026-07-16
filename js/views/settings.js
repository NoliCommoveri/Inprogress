// settings.js — team name/season, backup/restore, date-range export.
import {
  getSettings, updateSettings, subscribe,
  exportBackup, importBackup, getData, backupNudgeDue, hardResetAllData
} from '../data.js';
import { exportRangeToXlsx, exportRangeToPdf, getEventsInRange } from '../export.js';
import { todayStr, addDaysStr } from '../selectors.js';
import { openWizard } from '../wizard.js';

const RESET_CONFIRM_WORD = 'RESET';

export function mount(container) {
  const today = todayStr();
  const in30 = addDaysStr(today, 30);

  container.innerHTML = `
    <h2>Settings</h2>
    <button type="button" id="get-app-btn" class="btn-secondary get-app-btn">📲 Get as App</button>

    <dialog id="get-app-dialog" class="get-app-dialog">
      <div id="get-app-content"></div>
    </dialog>

    <section class="team-info-section">
      <div class="field-row">
        <label for="team-name">Team name:</label>
        <input id="team-name" />
      </div>
      <div class="field-row">
        <label for="season">Season:</label>
        <input id="season" />
      </div>
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
      <button type="button" id="replay-wizard-btn" class="btn-link">▶ Replay the Getting Started tour</button>
    </section>

    <section class="danger-zone">
      <h3>⚠️ Danger Zone</h3>
      <p>Permanently erase <strong>all</strong> data on this device — every
         player, parent, event, snack assignment, and fundraiser. This
         cannot be undone, and there is no cloud copy to recover from.
         Export a backup first if there's any chance you'll want this data
         again.</p>
      <button type="button" id="reveal-reset-btn" class="btn-secondary">Reset All Data…</button>
      <div id="reset-confirm-panel" hidden>
        <p>Type <strong>${RESET_CONFIRM_WORD}</strong> below to confirm. The
           app will reload completely empty right after.</p>
        <input type="text" id="reset-confirm-input" autocomplete="off"
               placeholder="Type ${RESET_CONFIRM_WORD} to confirm" />
        <div class="danger-zone-actions">
          <button type="button" id="cancel-reset-btn" class="btn-secondary">Cancel</button>
          <button type="button" id="confirm-reset-btn" class="btn-danger" disabled>Erase everything</button>
        </div>
      </div>
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
  const replayWizardBtn = container.querySelector('#replay-wizard-btn');

  const getAppBtn = container.querySelector('#get-app-btn');
  const getAppDialog = container.querySelector('#get-app-dialog');
  const getAppContent = container.querySelector('#get-app-content');

  const revealResetBtn = container.querySelector('#reveal-reset-btn');
  const resetPanel = container.querySelector('#reset-confirm-panel');
  const resetInput = container.querySelector('#reset-confirm-input');
  const cancelResetBtn = container.querySelector('#cancel-reset-btn');
  const confirmResetBtn = container.querySelector('#confirm-reset-btn');

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

  replayWizardBtn.addEventListener('click', () => openWizard());

  function renderGetAppStep(step) {
    if (step === 'choose') {
      getAppContent.innerHTML = `
        <h3>Get as App</h3>
        <p>Which phone are you using?</p>
        <div class="modal-actions get-app-choices">
          <button type="button" class="btn-primary" data-step="iphone">📱 iPhone</button>
          <button type="button" class="btn-primary" data-step="android">🤖 Android</button>
        </div>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" data-action="close">Cancel</button>
        </div>
      `;
    } else if (step === 'iphone') {
      getAppContent.innerHTML = `
        <h3>Install on iPhone</h3>
        <ol>
          <li>Open this page in <strong>Safari</strong> — Chrome and other browsers on
              iPhone can't install it.</li>
          <li>Tap the <strong>Share</strong> icon (square with an arrow up) in the
              toolbar.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> in the top right.</li>
        </ol>
        <p>The app icon appears on your Home Screen. Open it from there — it runs
           full-screen, with no browser address bar.</p>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" data-step="choose">← Back</button>
          <button type="button" data-action="close">Done</button>
        </div>
      `;
    } else if (step === 'android') {
      getAppContent.innerHTML = `
        <h3>Install on Android</h3>
        <ol>
          <li>Open this page in <strong>Chrome</strong>.</li>
          <li>Tap the <strong>⋮</strong> menu in the top right.</li>
          <li>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>,
              if Chrome offers that directly).</li>
          <li>Tap <strong>Add</strong> / <strong>Install</strong> to confirm.</li>
        </ol>
        <p>The app icon appears on your Home Screen / app drawer and opens
           full-screen.</p>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" data-step="choose">← Back</button>
          <button type="button" data-action="close">Done</button>
        </div>
      `;
    }
  }

  getAppBtn.addEventListener('click', () => {
    renderGetAppStep('choose');
    getAppDialog.showModal();
  });

  getAppDialog.addEventListener('click', (e) => {
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { renderGetAppStep(stepBtn.dataset.step); return; }
    if (e.target.closest('[data-action="close"]')) getAppDialog.close();
  });

  revealResetBtn.addEventListener('click', () => {
    revealResetBtn.hidden = true;
    resetPanel.hidden = false;
    resetInput.value = '';
    confirmResetBtn.disabled = true;
    resetInput.focus();
  });
  cancelResetBtn.addEventListener('click', () => {
    resetPanel.hidden = true;
    revealResetBtn.hidden = false;
  });
  resetInput.addEventListener('input', () => {
    confirmResetBtn.disabled = resetInput.value !== RESET_CONFIRM_WORD;
  });
  resetInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirmResetBtn.disabled) confirmResetBtn.click();
  });
  confirmResetBtn.addEventListener('click', () => {
    if (resetInput.value !== RESET_CONFIRM_WORD) return;
    hardResetAllData();
    window.location.reload();
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
