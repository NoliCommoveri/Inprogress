# Football Manager — Claude Code Build Instructions (Stage 8.5)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained.

**Where this fits:** run this after Stage 8 (date-range export) and before
Stage 9 (hardening & deploy). It has **no technical dependency** on Stage
7/8's vendored libraries — it never attaches files, only prefills message
text — it's just sequenced here to match the current build order. It also
requires **no schema change**: no new fields, no `schemaVersion` bump, no
migration. Read the existing `js/data.js`, `js/views/schedule.js`, and
`js/views/parents.js` before editing so this merges cleanly rather than
duplicating what's there.

Your job: a new `js/messaging.js` module, a "Weekly Update" panel on the
Schedule view, and per-parent quick-contact links on the Parents view.

## Hard rules (carry over from the base spec)

1. **UI code never touches `localStorage` directly.** This stage only reads
   through functions already exported by `js/data.js`.
2. **No build step, no third-party scripts.** Everything here is native
   `mailto:`/`sms:` URI schemes and the `Clipboard` API — both built into
   the browser, no library, no CDN.
3. **Escape record-derived text before interpolating into `innerHTML`.**
   Use the existing `escapeHtml()` from `js/util.js` for anything (parent
   name, email, phone) going into a template string — including inside an
   `href` attribute.
4. **This stage does not attach files.** It only prefills the *body text*
   of an email/text message. If a "share the exported PDF as an attachment"
   feature is wanted later, that's a separate, optional follow-up using the
   Web Share API (`navigator.share` with a `files` array) — out of scope
   here. Flagging this now so it's a deliberate omission, not a missed
   requirement.

---

## Terminology note (carried from planning discussion)

An **attachment** is a separate file bundled with a message. What this
stage builds is different and simpler: the message **body itself** is
autofilled with plain text pulled from app data (e.g. "Please see the
following info for the upcoming week's practice and snack schedule: ...").
Both `mailto:` and `sms:` URI schemes support a `body` parameter natively —
no library needed for that part.

---

## New file: `js/messaging.js`

```js
import {
  getEvents, getSnackAssignmentsForEvent, getParentById,
  getOpponentById, getParents
} from './data.js';

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Plain-text digest of upcoming events + snack assignments, default 7 days out.
export function buildWeeklyUpdateText(daysAhead = 7) {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + daysAhead * 864e5).toISOString().slice(0, 10);

  const upcoming = getEvents()
    .filter(e => e.date >= today && e.date <= endDate && e.status !== 'canceled')
    .sort((a, b) => a.date === b.date
      ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  if (upcoming.length === 0) {
    return `No practices or games scheduled in the next ${daysAhead} days.`;
  }

  const lines = upcoming.map(e => {
    const opp = e.opponentId ? getOpponentById(e.opponentId)?.name : null;
    const snackNames = getSnackAssignmentsForEvent(e.id)
      .map(sa => getParentById(sa.parentId)?.name)
      .filter(Boolean);

    let line = `${fmtDate(e.date)} ${e.startTime}`;
    line += e.type === 'game' ? ` — Game vs ${opp || 'TBD'}` : ' — Practice';
    if (e.location) line += ` @ ${e.location}`;
    if (snackNames.length) line += ` (Snacks: ${snackNames.join(', ')})`;
    else if (e.type === 'practice') line += ' (Snacks: unassigned)';
    return line;
  });

  return `Please see the following info for the upcoming week's practice and snack schedule:\n\n${lines.join('\n')}`;
}

export function getAllParentEmails() {
  return getParents().map(p => p.email).filter(Boolean);
}

// NOTE: commas in the "to" portion of a mailto: URI must stay LITERAL for
// multi-recipient support — do not encodeURIComponent the address list,
// only the subject/body. Encoding the comma breaks multi-recipient parsing
// in most clients.
export function mailtoLink(emails, subject, body) {
  const to = Array.isArray(emails) ? emails.join(',') : emails;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to}?${params.toString()}`;
}

// iOS wants `&` before body, Android/most others want `?` — this covers both.
export function smsLink(phone, body) {
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}

// Returns true/false rather than throwing — caller shows its own fallback UI.
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

---

## Extend `js/views/schedule.js` — Weekly Update panel

Add this markup inside the existing `mount()`'s initial `container.innerHTML`,
after the `<form id="add-event-form">` block:

```html
<section class="weekly-update">
  <h3>Weekly Update</h3>
  <pre id="weekly-update-preview"></pre>
  <a id="email-all-btn" class="btn">Email All Parents</a>
  <button type="button" id="copy-update-btn">Copy Message</button>
  <span id="copy-feedback"></span>
</section>
```

Add to imports:
```js
import { buildWeeklyUpdateText, getAllParentEmails, mailtoLink, copyToClipboard } from '../messaging.js';
```

Add these element refs near the existing ones (`tbody`, `form`, `oppSelect`):
```js
const preview = container.querySelector('#weekly-update-preview');
const emailAllBtn = container.querySelector('#email-all-btn');
const copyBtn = container.querySelector('#copy-update-btn');
const feedback = container.querySelector('#copy-feedback');
```

Add a `renderWeeklyUpdate()` function and call it at the end of the existing
`render()` function (so it re-runs on every `subscribe()` fire, same as the
rest of the view):

```js
function renderWeeklyUpdate() {
  const text = buildWeeklyUpdateText();
  preview.textContent = text;              // textContent — no escaping needed, no injection risk

  const emails = getAllParentEmails();
  emailAllBtn.href = mailtoLink(emails, 'Weekly Practice & Snack Schedule', text);
  emailAllBtn.classList.toggle('disabled', emails.length === 0);
  emailAllBtn.textContent = emails.length
    ? `Email All Parents (${emails.length})`
    : 'Email All Parents (no parent emails on file)';
}
```

Wire the copy button once, outside `render()` (it's a static handler, not
something that needs re-registering per render):

```js
copyBtn.addEventListener('click', async () => {
  const ok = await copyToClipboard(buildWeeklyUpdateText());
  feedback.textContent = ok ? 'Copied!' : 'Copy failed — select the text above and copy manually.';
  setTimeout(() => { feedback.textContent = ''; }, 3000);
});
```

Finally, inside the existing `render()` function body, add a call to
`renderWeeklyUpdate();` (anywhere after the table re-render is fine — the
two sections are independent).

---

## Extend `js/views/parents.js` — per-parent quick contact

Add to imports:
```js
import { mailtoLink, smsLink } from '../messaging.js';
```

In the existing per-row template inside `render()`, add a new `<td>` after
the existing "Players" column, before the delete button's `<td>`:

```html
<td>
  ${p.email ? `<a href="${escapeHtml(mailtoLink(p.email, '', ''))}">Email</a>` : ''}
  ${p.phone ? `<a href="${escapeHtml(smsLink(p.phone, ''))}">Text</a>` : ''}
</td>
```

(Also add the matching `<th></th>` to the table's header row.) These are
deliberately blank-subject/blank-body — this is the one-off "I need to
reach this specific parent right now" path, distinct from the Schedule
view's broadcast digest above. `escapeHtml()` wraps the constructed URL
even though `URLSearchParams`/`encodeURIComponent` already percent-encode
most special characters — a defensive habit worth keeping since these
strings still originate from user-entered record fields.

---

## Stage 8.5 acceptance gate

- **Schedule view**: the Weekly Update panel shows a live plain-text digest
  of the next 7 days of practices/games, including opponent names, location,
  and assigned snack parent(s); it updates immediately when an event or
  snack assignment changes elsewhere in the app (via the existing
  `subscribe()` mechanism — no manual refresh).
- With zero parent emails on file, "Email All Parents" is visibly disabled
  and says so, rather than opening a blank/broken `mailto:`.
- With zero upcoming events, the preview shows the "No practices or games
  scheduled..." fallback text instead of an empty block or a crash.
- Clicking **Email All Parents** opens the default mail client with every
  parent email in "To" (comma-separated, not broken into separate encoded
  tokens), a filled subject, and the same text shown in the preview.
- Clicking **Copy Message** copies the current digest to the clipboard and
  shows "Copied!" feedback that clears after a few seconds; test by pasting
  elsewhere. If clipboard permission is denied, the fallback message shows
  instead of a silent failure or thrown error.
- **Parents view**: each row with an email shows a working "Email" link
  (opens mail client, blank subject/body, correct recipient); each row with
  a phone shows a working "Text" link. A parent with neither field shows
  neither link, no broken `href`.
- No new entries in `localStorage` — confirm via DevTools that `stm:v1`'s
  shape and `schemaVersion` are unchanged after using every feature in this
  stage.
- DevTools Network tab still shows zero requests to any non-repo origin.

---

## Stop point / explicitly deferred

- **File attachments** (e.g. sharing the Stage 8 exported `.xlsx`/`.pdf` via
  the native share sheet) are **not** part of this stage. If wanted later,
  that's an additive follow-up using `navigator.share({ files, title, text })`
  with a download-fallback for unsupported browsers — a different mechanism
  from the `mailto:`/`sms:` links here, and it hands off to the OS share
  sheet rather than prefilling a specific recipient.
- **SMS group broadcast** (texting all parents at once) is intentionally
  **not** implemented — multi-recipient `sms:` links are unreliable across
  carriers/OSes. The "Copy Message" button is the deliberate workaround:
  the admin pastes the digest into whatever group thread they already use.
- **Per-parent personalization** (e.g. "Hi Jane," salutations in the
  broadcast digest) is deferred — the digest is written as a neutral
  team-wide announcement by design.
