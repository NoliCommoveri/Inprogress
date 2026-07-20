// sampleDataUI.js — first-run "explore vs. blank" prompt and the persistent
// sample-data banner (Sample Data & Reset brief v1, §4). Shared by app.js
// (every page) and pages/import-export.js (the "Clear Sample Data" control).
import {
  shouldOfferFirstRunPrompt, hasSampleData, seedSampleData, declineSampleData, clearSampleData
} from '../data/sampleData.js';
import { alertModal, confirmModal } from './ui.js';

// Shown after maybeOfferTourFirst() (wizardUI.js) is declined or finds nothing
// to offer — never before it, so a genuinely fresh browser sees the tour offer
// first (see app.js's firstRunFlow()). Resolves 'seeded' | 'blank' | null
// (null = prompt wasn't offered at all) so callers can chain the kennel-setup
// wizard onto the "blank" branch.
export async function maybeShowFirstRunPrompt() {
  if (!(await shouldOfferFirstRunPrompt())) return null;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:480px; text-align:center;">
        <h2 style="margin-top:0;">How would you like to start?</h2>
        <p class="muted">Explore with a small sample kennel (dogs, contacts, a pedigree, and a
          health timeline already filled in), or start blank with your own records?</p>
        <div class="form-actions" style="justify-content:center;">
          <button class="btn btn-primary" data-act="seed">Explore with sample data</button>
          <button class="btn" data-act="blank">Start with a blank kennel</button>
        </div>
        <p class="faint" style="margin-bottom:0;">Sample data can be cleared any time from Import / Export.</p>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-act="blank"]').addEventListener('click', () => {
      declineSampleData();
      overlay.remove();
      resolve('blank');
    });
    overlay.querySelector('[data-act="seed"]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Setting up…';
      await seedSampleData();
      location.reload(); // never resolves — the reload takes over
    });
  });
}

// Persistent small banner, injected right after the nav on every page, shown
// only while sample data is loaded.
export async function renderSampleBanner() {
  if (!hasSampleData()) return;
  const nav = document.getElementById('app-nav');
  if (!nav) return;

  const banner = document.createElement('div');
  banner.className = 'sample-banner';
  banner.innerHTML = `
    <span>Viewing sample data</span>
    <button class="btn btn-sm" id="sample-banner-clear">Clear Sample Data</button>`;
  nav.insertAdjacentElement('afterend', banner);

  banner.querySelector('#sample-banner-clear').addEventListener('click', async () => {
    const result = await promptClearSampleData();
    if (result?.cleared) location.reload();
  });
}

// The clear flow itself — shared by the banner button and the Import/Export
// page's own "Clear Sample Data" control. Returns the clearSampleData() result,
// or undefined if the user backed out.
export async function promptClearSampleData() {
  if (!hasSampleData()) {
    await alertModal({ title: 'No sample data', message: 'There is no sample data loaded.' });
    return;
  }
  if (!(await confirmModal({
    title: 'Clear sample data?',
    message: 'Remove all sample data (Thornfield Kennels demo dogs, pairings, litters, contacts, kennels, and events)? This cannot be undone.',
    confirmLabel: 'Clear', danger: true
  }))) {
    return;
  }

  let result = await clearSampleData();

  if (!result.cleared && result.reason === 'contaminated') {
    const list = result.conflicts.map((c) => `• ${c}`).join('\n');
    const archive = await confirmModal({
      title: 'Archive sample dogs instead?',
      message: `Some of your own records now depend on sample dogs:\n\n${list}\n\n` +
        `These sample dogs can't be deleted while that's true. Archive them instead ` +
        `(hides them from active lists, keeps history intact) and clear the rest?`,
      confirmLabel: 'Archive & clear', cancelLabel: 'Cancel'
    });
    if (!archive) return result;
    result = await clearSampleData({ archiveConflicting: true });
  }

  if (result.cleared) {
    const parts = [`${result.counts.dogs} dog(s)`, `${result.counts.pairings} pairing(s)`,
      `${result.counts.litters} litter(s)`, `${result.counts.stud_services} stud service(s)`,
      `${result.counts.sales} sale(s)`, `${result.counts.contracts} contract(s)`,
      `${result.counts.events} event(s)`, `${result.counts.contacts} contact(s)`, `${result.counts.kennels} kennel(s)`];
    if (result.counts.archived) parts.push(`${result.counts.archived} archived instead of deleted`);
    await alertModal({ title: 'Sample data cleared', message: `Removed ${parts.join(', ')}.` });
  }
  return result;
}
