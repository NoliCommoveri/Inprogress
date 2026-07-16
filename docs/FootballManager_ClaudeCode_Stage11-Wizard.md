# Football Manager — Claude Code Build Instructions (Stage 11 — Getting Started Wizard)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained for Stage 11 and
repeats everything you need.

**Stages 0–10 are already implemented and pass their gates**: storage core,
integrity mutations, cross-tab sync, first-run seeding, router, all seven
views (Team, Schedule, Roster, Parents, Snacks, Fundraisers, Communications,
Settings), backup/durability, vendored export libs, date-range export, PWA
scaffolding, and the Team View dashboard / hygiene prompts. Do not redo that
work — **read the current `index.html`, `js/seed.js`, `js/data.js`,
`js/router.js`, `js/views/settings.js`, and `css/styles.css` before editing
them** so you extend what's there instead of duplicating or conflicting
with it.

Your job now: a first-launch **Getting Started wizard** — a modal, multi-card
tutorial that greets new users, offers an escape hatch for people who've lost
data and are actually returning users, walks new users through each view,
lets them **set their team name and season right there in the wizard**
(instead of describing Settings and hoping they find it later — that's the
kind of thing that's easy to skip past), and closes with the backup/reminder
message and a direct hand-off into adding their first player.

The actual card **wording lives in a companion document**,
`FootballManager_Stage11_WizardCopy.md`. Copy that text verbatim into the
content array below — do not paraphrase or invent your own copy. If that
document isn't available to you, stop and ask for it rather than writing
placeholder text, since the wording was deliberately written to match the
app's tone.

## Hard rules (carry over from the base spec — do not violate)

1. **UI code never touches `localStorage` directly.** Wizard state is read
   via `getSettings()` / written via `updateSettings()`, same as every other
   view.
2. **No build step, no third-party scripts.** Vanilla ES modules, native
   `<dialog>` (already used for the opponent-entry modal — match that
   pattern, don't invent a second modal system).
3. **No schema version bump.** Adding `settings.hasSeenWizard` is additive
   and read with a `?? false` fallback, the same way optional fields are
   handled elsewhere. `SCHEMA_VERSION` stays at **2**. Do **not** touch
   `migrate()`.
4. **Escape user-entered text before interpolating into `innerHTML`** —
   moot here since all wizard copy is static, but don't regress the pattern
   if you add any dynamic bits (e.g. don't interpolate team name unescaped
   if you add personalization later).
5. **Don't auto-show the wizard for existing users.** It must only appear
   automatically on a genuinely fresh store (see "First-run detection"
   below) — not every time `hasSeenWizard` happens to be false, or every
   admin who updates the app mid-season will get an unwanted popup.
6. **Stop after Stage 11's acceptance gate passes.**

---

## 1. First-run detection: `js/seed.js`

Read the current file first. `seedIfNeeded()` presumably already has an
`isFirstRun()` check (added in Stage 3) that gates the one-time platform
seeding. **Change it to return a boolean** indicating whether seeding
actually happened, without altering the seeding logic itself:

```js
export function seedIfNeeded() {
  if (!isFirstRun()) return false;
  // ...existing seeding logic, unchanged...
  return true;
}
```

This return value is what tells the wizard "this is a brand-new origin,"
as distinct from "hasSeenWizard happens to be false." A data-loss victim
whose localStorage got wiped looks identical to a new user at this layer —
both get a fresh `emptyData()` store — which is exactly the ambiguity Card 2
(below) is designed to resolve for them.

---

## 2. New settings field

### `js/data.js` — `emptyData()`

Add one field to the existing `settings` object:

```js
settings: { teamName: '', season: '', myPlayerId: null, hasSeenWizard: false },
```

No other change to `data.js`. Anywhere the wizard reads this, use
`getSettings().hasSeenWizard ?? false` so it degrades gracefully for stores
that predate this field.

The wizard's team-setup card (Card 10, below) writes to `teamName`/`season`
via the **existing** `updateSettings()` — those fields already exist from
Stage 5, nothing new to add for them. The wizard is just a second place
that can write to them, same as Settings does.

---

## 3. New file: `js/wizard-content.js`

Pure data, no logic. One entry per card, in display order. Copy the `title`/
`body` text exactly from `FootballManager_Stage11_WizardCopy.md` — each card
in that document is numbered to match the `id` below.

```js
export const WIZARD_STEPS = [
  {
    id: 1,
    icon: '🏈',
    title: '<<< copy from companion doc, Card 1 >>>',
    body: '<<< copy from companion doc, Card 1 >>>',
    kind: 'standard'          // standard | branch | closing
  },
  {
    id: 2,
    icon: '🔄',
    title: '<<< Card 2 >>>',
    body: '<<< Card 2 >>>',
    kind: 'branch'             // renders the two custom buttons, no Back/Next
  },
  { id: 3,  icon: '🏠', title: '<<< Card 3 >>>',  body: '<<< Card 3 >>>',  kind: 'standard' },
  { id: 4,  icon: '🗓️', title: '<<< Card 4 >>>',  body: '<<< Card 4 >>>',  kind: 'standard' },
  { id: 5,  icon: '👕', title: '<<< Card 5 >>>',  body: '<<< Card 5 >>>',  kind: 'standard' },
  { id: 6,  icon: '👪', title: '<<< Card 6 >>>',  body: '<<< Card 6 >>>',  kind: 'standard' },
  { id: 7,  icon: '🍊', title: '<<< Card 7 >>>',  body: '<<< Card 7 >>>',  kind: 'standard' },
  { id: 8,  icon: '💰', title: '<<< Card 8 >>>',  body: '<<< Card 8 >>>',  kind: 'standard' },
  { id: 9,  icon: '💬', title: '<<< Card 9 >>>',  body: '<<< Card 9 >>>',  kind: 'standard' },
  {
    id: 10,
    icon: '⚙️',
    title: '<<< Card 10 >>>',
    body: '<<< Card 10 >>>',
    kind: 'form'               // NEW — renders live Team name / Season inputs, not just prose
  },
  {
    id: 11,
    icon: '🔒',
    title: '<<< Card 11 >>>',
    body: '<<< Card 11 >>>',
    kind: 'closing',
    primaryLabel: 'Add your first player!'   // overrides the default "Let's go!" label
  }
];
```

Card 3 (Team) exists **because of Stage 10** — if for some reason Stage 10
hasn't landed in the checkout you're working from, stop and flag that rather
than silently dropping the card or pointing it at a nonexistent route.

Card 10's `kind: 'form'` is the one meaningful behavior change from earlier
drafts of this spec: it used to just *describe* Settings and trust the admin
to go find the team-name/season fields later. In practice that's exactly
the kind of setup step that's easy to skip and then forget — so it now
collects those two fields directly, in the wizard, before moving on.

---

## 4. New file: `js/wizard.js`

Mirrors the `initNudgeBanner`/`initHygieneBanner` pattern structurally, but
owns a `<dialog>` instead of a banner `<div>`, and has real internal state
(current step) since it's a multi-screen flow rather than a single render.

```js
import { getSettings, updateSettings } from './data.js';
import { WIZARD_STEPS } from './wizard-content.js';

// Session-only handshake with roster.js — see §8. Not persisted, not part
// of the data schema; it just tells the next `roster.js` mount to expand
// its "+ Add Player" form once.
const EXPAND_ADD_PLAYER_KEY = 'fm:expandAddPlayerOnce';

let _dialogEl = null;
let _stepIndex = 0;

export function initWizard(dialogEl, { autoShow } = {}) {
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

  if (autoShow && !(getSettings().hasSeenWizard ?? false)) {
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
        <input type="text" id="wizard-team-name" value="${escapeAttr(s.teamName)}" placeholder="e.g. Wildcats U10" />
      </label>
      <label>Season
        <input type="text" id="wizard-season" value="${escapeAttr(s.season)}" placeholder="e.g. Fall 2026" />
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

// Static wizard copy never contains user data, but these two inputs echo
// back whatever's already in settings.teamName/season, which the admin
// typed themselves elsewhere — escape it anyway, same rule as every other
// view that interpolates a stored field into innerHTML.
function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
    ? `<button class="btn-link" data-skip>Skip</button>`
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
```

Notes on the choices above, so they don't get "simplified" back out during
review:

- **`cancel` and backdrop-click both map to Skip**, not to a no-op. This is
  a personal single-admin tool, not an onboarding funnel with a conversion
  target — respect the person's choice to back out, same spirit as the
  dismissible hygiene banner. Every exit path sets `hasSeenWizard: true`
  except there isn't one that doesn't; there's no "remind me later."
- **The "Returning user" path still marks `hasSeenWizard: true`.** It's a
  one-time wizard, not a per-visit one — if they land on Settings and later
  come back to a still-empty Team page, that's what the existing empty-state
  messaging on each view is for, not this wizard's job to repeat.
- **The scroll cue is overflow-driven, not a fixed guess.** It only appears
  when `.wizard-body` actually overflows its own box, and hides once
  scrolled to the bottom — so it won't show on a card that fits, and won't
  nag once they've seen the rest.
- **Card 10's inputs write straight through `updateSettings()`, live, on
  `change`** — same as Settings does — rather than being staged and saved
  on "Next." If the admin closes the wizard early on this card (Skip,
  Escape, backdrop), whatever they'd already typed and blurred out of is
  kept; nothing is lost or requires a separate save step.
- **The final button hands off to Roster, not Team.** Team is where the
  admin lands on every *subsequent* visit anyway (it's the default route);
  showing it once more here would just be another screen to click past.
  Roster with the add-player form already open removes exactly one click
  right when it matters — the moment right after "I'm ready to use this."

---

## 5. `js/views/roster.js` — the hand-off

Read the current file first (it has the collapsible "+ Add Player" button
from the Stage 10 UX review — form-local `open`/`closed` state inside
`mount()`, per that doc's §6). Add a one-time check at the top of `mount()`
that expands the form if the wizard just sent someone here:

```js
const EXPAND_ADD_PLAYER_KEY = 'fm:expandAddPlayerOnce';

export function mount(container) {
  let addFormOpen = sessionStorage.getItem(EXPAND_ADD_PLAYER_KEY) === '1';
  if (addFormOpen) sessionStorage.removeItem(EXPAND_ADD_PLAYER_KEY);

  // ...rest of the existing mount() unchanged, except the "+ Add Player"
  // button's initial open/closed state should read from `addFormOpen`
  // instead of always starting closed...
}
```

The exact variable name doesn't need to match whatever the current file
calls its open/closed flag — the point is: **read the flag once, before the
first render, seed the existing toggle state with it, and clear the key
immediately** so navigating to Roster again later (normal use, not via the
wizard) doesn't keep re-expanding the form. `sessionStorage` (not
`localStorage`) is deliberate — it's UI-flow state, not app data, and
shouldn't survive a full browser restart or show up in a backup export.

If the current Roster implementation stores its open/closed state some
other way (e.g. a module-level variable instead of a `mount()`-local one),
adapt to that shape rather than restructuring it — this hand-off should be
a small addition, not a refactor.

---

## 6. `index.html` changes

Read the current file first. Add the dialog mount point (anywhere before
`</body>` is fine; suggested right after the existing banners) and wire the
new import into the boot sequence:

```html
<!-- after the existing #nudge-banner / #hygiene-banner divs -->
<dialog id="wizard-dialog" class="wizard-dialog"></dialog>
```

```js
// boot <script type="module">
import { seedIfNeeded } from './js/seed.js';
import { initRouter } from './js/router.js';
import { initNudgeBanner } from './js/nudge.js';
import { initHygieneBanner } from './js/hygiene.js';
import { initWizard } from './js/wizard.js';   // NEW

const wasFirstRun = seedIfNeeded();            // CHANGE: capture return value
initRouter(document.getElementById('outlet'), document.getElementById('main-nav'));
initNudgeBanner(document.getElementById('nudge-banner'));
initHygieneBanner(document.getElementById('hygiene-banner'));
initWizard(document.getElementById('wizard-dialog'), { autoShow: wasFirstRun });  // NEW
```

---

## 7. `js/views/settings.js` — replay entry point

Read the current file first. Add one line to the existing `help-section`
added in Stage 9.4, right after the durability `<details>` block — this is
the manual way back in for anyone who skipped it, dismissed it, or just
wants to see it again:

```html
<button id="replay-wizard-btn" class="btn-link">▶ Replay the Getting Started tour</button>
```

```js
import { openWizard } from '../wizard.js';
// ...inside mount(), alongside the other event listeners:
container.querySelector('#replay-wizard-btn').addEventListener('click', () => openWizard());
```

---

## 8. `css/styles.css` additions

Read the current file first — it already has `--color-primary`, the
`<dialog>`/`::backdrop` pattern from the opponent modal, and `.btn-link`.
**Reuse those tokens**; don't introduce a second color system. Add:

```css
.wizard-dialog {
  width: min(92vw, 420px);
  max-height: 80vh;
  padding: 0;
  border: none;
  border-radius: 16px;
  overflow: hidden;
}
.wizard-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
.wizard-card {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.wizard-progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 16px 0 0;
}
.wizard-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d9d9d9;
}
.wizard-dot.active {
  background: var(--color-primary);
}
.wizard-body {
  overflow-y: auto;
  padding: 16px 24px;
  text-align: center;
}
.wizard-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: 8px;
}
.wizard-body h2 {
  margin: 0 0 8px;
  font-size: 1.15rem;
}
.wizard-body p {
  margin: 0;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
}
.wizard-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  text-align: left;
}
.wizard-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: #555;
}
.wizard-form input {
  font-size: 1rem;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
}
.wizard-scroll-cue {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-primary);
  padding-bottom: 4px;
}
.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px calc(env(safe-area-inset-bottom) + 12px);
  border-top: 1px solid #eee;
  flex-wrap: wrap;
}
.wizard-actions .btn-secondary {
  margin-right: auto;
}
```

`.btn-primary` should already resolve sensibly if the codebase has a
primary-button convention from other forms — if it doesn't yet exist as a
named class anywhere, add a minimal one here rather than leaving the
primary action unstyled:

```css
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.95rem;
}
.btn-secondary {
  background: none;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.95rem;
}
```

---

## Stage 11 acceptance gate

- On a genuinely fresh origin (no `stm:v1` key), the wizard opens
  automatically on load, on Card 1.
- Reloading a second time on that same origin **without** completing the
  wizard (e.g. closing the tab mid-flow) — since `hasSeenWizard` is only set
  on an explicit exit — re-opens the wizard from Card 1 on the next load.
  This is intended: nothing marks it seen except an actual exit action.
- Card 2's two buttons behave differently: "I've used this before" closes
  the wizard, sets `hasSeenWizard: true`, and navigates to `#/settings`;
  "I'm new here" advances to Card 3 and leaves the wizard open.
- Cards 3–10 each show Back, Skip, and Next; Back is absent on Card 1, Skip
  is absent on Card 1 and Card 11.
- Card 10 shows live **Team name** and **Season** inputs seeded with
  whatever's already in `settings`; typing a value and blurring the field
  (or clicking Back to Card 9 and forward again) persists it via
  `updateSettings()` — confirm by checking Settings afterward and seeing
  the same value there.
- Card 11's primary button reads **"Add your first player!"**, not "Let's
  go!". Clicking it closes the wizard, sets `hasSeenWizard: true`, and
  navigates to `#/roster` with the "+ Add Player" form already expanded —
  not collapsed as it would be on a normal Roster visit.
- Navigating to Roster a second time afterward (via the nav link, not the
  wizard) shows the add-player form in its normal default (collapsed)
  state — confirms the session flag was consumed once and cleared, not
  left sticky.
- Skip, Escape, and clicking the dimmed backdrop all close the wizard from
  any standard card and set `hasSeenWizard: true` — verify by reloading
  afterward and confirming the wizard does **not** reopen.
- On an **existing** store that already has real data (players, events,
  etc.) but predates this field (`settings.hasSeenWizard` is `undefined`),
  reloading the app does **not** auto-open the wizard — because
  `seedIfNeeded()` returns `false` on that load, not because of the
  `hasSeenWizard` value. This is the case that must not regress: an
  in-season admin updating the app must never be interrupted by this.
- On that same existing store, clicking "▶ Replay the Getting Started tour"
  in Settings opens the wizard manually from Card 1, and it can be exited
  the same three ways as above.
- At 320–390px viewport widths, no card overflows the screen horizontally;
  on an artificially short viewport height (e.g. 480px landscape), the
  scroll cue appears on any card whose text doesn't fit, and disappears
  once scrolled to the bottom.
- `SCHEMA_VERSION` is unchanged at 2; a Stage 6-era backup `.json` (no
  `hasSeenWizard` key) still imports cleanly.

---

## Stop point

Once Stage 11's gate passes, **stop**.
