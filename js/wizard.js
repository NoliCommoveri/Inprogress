// wizard.js — first-launch Getting Started wizard. Mirrors the
// initNudgeBanner/initHygieneBanner pattern structurally, but owns a
// <dialog> instead of a banner <div>, and tracks a current-step index since
// it's a multi-screen flow rather than a single render.
import { getSettings, updateSettings } from './data.js';
import { escapeHtml } from './util.js';
import { WIZARD_STEPS } from './wizard-content.js';

// Session-only handshake with roster.js — not persisted, not part of the
// data schema; it just tells the next roster.js mount to expand its
// "+ Add Player" form once.
const EXPAND_ADD_PLAYER_KEY = 'fm:expandAddPlayerOnce';

let _dialogEl = null;
let _stepIndex = 0;

export function initWizard(dialogEl) {
  _dialogEl = dialogEl;

  dialogEl.addEventListener('cancel', (e) => {
    // ESC key / native dismiss — treat exactly like Skip.
    e.preventDefault();
    closeWizard();
  });
  dialogEl.addEventListener('click', (e) => {
    // Click on the ::backdrop lands directly on the <dialog> element itself.
    if (e.target === dialogEl) closeWizard();
  });

  // Strict === false (not `?? false`) is deliberate: emptyData() stamps
  // every store created from here on with hasSeenWizard: false, so this
  // distinguishes "wizard genuinely never completed on this store" (auto-
  // show, including every reload of an abandoned mid-flow session) from a
  // pre-Stage-11 store where the key is simply absent (undefined) — that
  // one must never auto-open. seedIfNeeded()'s return value can't do this
  // job: it's only true on the literal first-ever load, so gating on it
  // would stop the wizard from reopening on the very next reload of a
  // session someone closed mid-flow, contradicting the requirement that
  // nothing but an explicit exit marks it seen.
  if (getSettings().hasSeenWizard === false) {
    openWizard();
  }
}

export function openWizard() {
  if (!_dialogEl) return;
  _stepIndex = 0;
  render();
  if (!_dialogEl.open) _dialogEl.showModal();
}

function closeWizard() {
  if (!_dialogEl) return;
  _dialogEl.close();
  updateSettings({ hasSeenWizard: true });
}

function goTo(index) {
  _stepIndex = Math.max(0, Math.min(WIZARD_STEPS.length - 1, index));
  render();
}

function render() {
  const step = WIZARD_STEPS[_stepIndex];
  const isFirst = _stepIndex === 0;
  const isLast = _stepIndex === WIZARD_STEPS.length - 1;

  _dialogEl.innerHTML = `
    <div class="wizard-card">
      <div class="wizard-progress" role="presentation">
        ${WIZARD_STEPS.map((_, i) =>
          `<span class="wizard-dot${i === _stepIndex ? ' active' : ''}"></span>`
        ).join('')}
      </div>
      <div class="wizard-body">
        <div class="wizard-icon" aria-hidden="true">${step.icon}</div>
        <h2>${step.title}</h2>
        <p>${step.body}</p>
        ${step.kind === 'form' ? renderFormFields() : ''}
      </div>
      <div class="wizard-scroll-cue" hidden>▾ scroll for more</div>
      <div class="wizard-actions">
        ${renderActions(step, isFirst, isLast)}
      </div>
    </div>
  `;

  wireActions(step, isFirst, isLast);
  if (step.kind === 'form') wireFormFields();
  wireScrollCue();
  _dialogEl.querySelector('.wizard-actions [data-primary]')?.focus();
}

// Card 10 only. Reads current values so a returning-to-this-card admin
// (via Back) doesn't see their own entry blanked out.
function renderFormFields() {
  const s = getSettings();
  return `
    <div class="wizard-form">
      <label>Team name
        <input type="text" id="wizard-team-name" value="${escapeHtml(s.teamName)}" placeholder="e.g. Wildcats U10" />
      </label>
      <label>Season
        <input type="text" id="wizard-season" value="${escapeHtml(s.season)}" placeholder="e.g. Fall 2026" />
      </label>
    </div>
  `;
}

function wireFormFields() {
  const teamInput = _dialogEl.querySelector('#wizard-team-name');
  const seasonInput = _dialogEl.querySelector('#wizard-season');
  teamInput.addEventListener('change', () => updateSettings({ teamName: teamInput.value }));
  seasonInput.addEventListener('change', () => updateSettings({ season: seasonInput.value }));
}

function renderActions(step, isFirst, isLast) {
  if (step.kind === 'branch') {
    // Card 2 — no Back/Next, no Skip; two deliberate exits instead.
    return `
      <button class="btn-secondary" data-returning>I've used this before</button>
      <button class="btn-primary" data-primary data-new-user>I'm new here</button>
    `;
  }
  const backBtn = isFirst
    ? ''
    : `<button class="btn-secondary" data-back>Back</button>`;
  const skipBtn = (!isFirst && !isLast)
    ? `<button class="btn-tertiary" data-skip>Skip</button>`
    : '';
  const nextLabel = isLast ? (step.primaryLabel || "Let's go!") : 'Next';
  return `
    ${backBtn}
    ${skipBtn}
    <button class="btn-primary" data-primary data-next>${nextLabel}</button>
  `;
}

function wireActions(step, isFirst, isLast) {
  _dialogEl.querySelector('[data-back]')?.addEventListener('click', () => goTo(_stepIndex - 1));
  _dialogEl.querySelector('[data-skip]')?.addEventListener('click', () => closeWizard());
  _dialogEl.querySelector('[data-returning]')?.addEventListener('click', () => {
    closeWizard();
    window.location.hash = '#/settings';
  });
  _dialogEl.querySelector('[data-new-user]')?.addEventListener('click', () => goTo(_stepIndex + 1));
  _dialogEl.querySelector('[data-next]')?.addEventListener('click', () => {
    if (isLast) {
      closeWizard();
      sessionStorage.setItem(EXPAND_ADD_PLAYER_KEY, '1');
      window.location.hash = '#/roster';
    } else {
      goTo(_stepIndex + 1);
    }
  });
}

function wireScrollCue() {
  const body = _dialogEl.querySelector('.wizard-body');
  const cue = _dialogEl.querySelector('.wizard-scroll-cue');
  function update() {
    const hasOverflow = body.scrollHeight > body.clientHeight + 2;
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
    cue.hidden = !hasOverflow || atBottom;
  }
  body.addEventListener('scroll', update);
  update();
}
