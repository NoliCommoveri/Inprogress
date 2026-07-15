# Football Manager — UX Review Outcomes (2026-07-15)

Live-usage feedback from the admin, gathered in one session, covering the
opponent-entry flow and mobile layout across Roster, Parents, Schedule, and
Snacks. Shipped in PR [#7](https://github.com/NoliCommoveri/Inprogress/pull/7)
on branch `claude/opponent-modal-styling-12yx1v`.

Verification method throughout: served locally
(`python3 -m http.server`), driven with headless Chromium via Playwright at
320/360/375/390px viewport widths — the common phone-width range — checking
`document.documentElement.scrollWidth - clientWidth` for page-level
horizontal overflow, plus visual screenshots at each step.

---

## 1. Opponent entry used the native browser `prompt()`

**Observed:** "Adding new opponent brings up a grey box with my github url
asking for the opposing team name." `window.prompt()` renders as a plain OS
dialog that shows the page origin — jarring next to the app's own styling.

**Change:** Replaced both `prompt()` calls in the "+ New opponent" flow
(`js/views/schedule.js`) with a native `<dialog>` modal — white card,
rounded corners, dimmed backdrop, Cancel/Add buttons — styled to match the
rest of the app (`css/styles.css`).

**Verified:** opened the dialog, submitted a new opponent end-to-end,
confirmed it appears selected in the event form's opponent dropdown.

---

## 2. Tables overflowed the screen on phones

**Observed:** "Most screens have objects extending offscreen to the right.
… since the banner is scoped to screen size it looks horrible." Roster and
Parents tables had too many always-visible columns to fit a phone viewport,
and the overflow dragged the fixed-width header/nav along with it.

**Change, Roster** (`js/views/roster.js`): collapsed the visible columns to
jersey #, first name, last name, and an expand toggle. Position, Active,
Balance, and Delete moved behind a per-row expand/collapse panel that opens
new lines downward. Jersey sized to 3 characters, first/last name sized to
11 characters — tight enough to fit a 360px-wide screen with the toggle
still visible.

**Change, Parents** (`js/views/parents.js`): reordered to Name + Linked
Child up front; Phone, Email, Delete, and "link a child" moved behind the
same expand pattern.

**Change, all tables**: wrapped every table (`roster-table`, `parents-table`,
`schedule-table`, `snacks-table`) in a `.table-scroll` container with
`overflow-x: auto`, so if a table is ever wider than the viewport it scrolls
on its own — the header, nav, and banner never move.

**Verified:** zero page-level horizontal overflow at 360/375/390px on both
views; the rare 320px width falls back to a contained internal table
scroll rather than an overflowing page.

---

## 3. Roster polish: jersey width, follow-on-create, name wrapping

**Observed:** three follow-up notes after round 2 — "roster # field is too
compact now, move the star down too," a request to set a player as
"followed" (starred) at creation time, and to make the Parents name field
wrap the way the linked-child names already did instead of getting cut off.

**Changes:**
- Moved the star ("Follow"/`myPlayerId`) toggle out of the always-visible
  row and into the expand panel, freeing space to widen the jersey field
  from 3 to 4 characters.
- Added a "Follow this player" checkbox to the Add Player form; checking it
  calls `updateSettings({ myPlayerId })` with the newly created player's id.
- Converted the Parents name field from a single-line `<input>` to an
  auto-resizing `<textarea>` that wraps at word boundaries, matching the
  `linked-child` span's wrapping behavior.

**Verified:** confirmed via Playwright that a player created with the
checkbox checked comes back starred and row-highlighted; confirmed a long
parent name wraps across multiple lines with zero page overflow.

---

## 4. Schedule table needed the same treatment

**Observed:** "Schedule table needs similar treatment, see if you can
compact date and time a tiny bit to make practice/game fit and then hide
the rest."

**Change** (`js/views/schedule.js`): visible columns reduced to Date, Start
Time, and Type (practice/game), sized to 128px / 92px / 88px respectively.
End time, opponent, location, status, score, and delete moved behind the
same expand-row pattern used on Roster/Parents.

**Verified:** zero overflow at 320/360/375px, collapsed and expanded, with
the toggle chevron always reachable without scrolling.

---

## 5. Snacks table reorder

**Observed:** "Snacks is yes, but reorder a bit. Let location fall below
(usually practice is same place) so you have more room for parent and can
remove the wrap. Then location and assign new parent can go in
expandable."

**Change** (`js/views/snacks.js`): visible columns reduced to Date, Time,
and Snack Parent(s) — the assignment list no longer competes with Location
for space. Location (read-only display) and the "assign parent" dropdown
moved behind the expand toggle.

**Verified:** zero overflow on an unassigned practice and on a practice
with two long-named parents assigned; unassign buttons and the
unassigned-flag styling still work from the collapsed row.

---

## 6. Edit-lock and collapsible "Add New"

**Observed:** "Lock changes to existing behind an edit in the expansion, as
well all moving add new (where applicable) to a button under the header
that expands down." Clarified via follow-up questions:
- Edit-lock should cover the **whole row**, including the always-visible
  summary fields, not just the fields already hidden in the expansion.
- "Add New" should live **only** under the header, collapsible — not also
  pinned at the bottom.
- A separate archived/completed-vs-active view (flagged as "especially for
  schedule") was deferred as a follow-up task rather than built in the same
  pass — see **Deferred** below.

**Change, Roster/Parents/Schedule:** rows render read-only by default, one
`editingIds` Set per view tracking which row is unlocked. Expanding a row
reveals an **Edit** button; clicking it unlocks the whole row (summary +
expanded fields) for editing at once. Clicking **Done** — or collapsing the
row — locks it back to read-only. Delete, unlink/link-child, assign/
unassign, and the follow-star stay immediately actionable in every state,
since they're relationship or one-off actions rather than field edits that
can drift by accident.

**Change, Add forms:** the permanent "Add Player / Add Parent / Add Event"
form below each table was replaced with a "+ Add X" button directly under
the page header. Clicking it expands the form downward; the form stays
open after a successful submit so multiple records can be added without
re-opening it. (Snacks has no add form — snack rows are derived from
scheduled practices, not created directly.)

**Incidental bug fix:** the global `form { display: flex }` rule in
`css/styles.css` was silently defeating the `hidden` attribute on every
`<form>` — author-stylesheet declarations override user-agent defaults at
equal specificity/origin, so `[hidden] { display: none }` never took
effect. Added an explicit `form[hidden] { display: none; }` rule. Caught
via Playwright screenshot (the "collapsed" Add form was rendering open)
before it shipped.

**Verified:** for each of the three views — confirmed the add form starts
hidden, opens on toggle click, and stays open after submit; confirmed a
newly added row renders as plain text (not inputs); confirmed Edit unlocks
inputs across the summary and expanded fields simultaneously; confirmed
Done (with an explicit blur, matching real click behavior) saves the edit
and locks the row back to read-only; confirmed collapsing a row implicitly
exits edit mode.

---

## Deferred / follow-up

**Archived vs. active view split** — flagged as "especially for schedule"
but not scoped or built in this session, per explicit confirmation to
treat it as separate follow-up work. Needs its own design pass: what
counts as archived (event `status`, past-dated events, inactive players?),
whether it's a separate route/tab or a filter within the existing view, and
whether it extends beyond Schedule to Roster (inactive players) or other
views.
