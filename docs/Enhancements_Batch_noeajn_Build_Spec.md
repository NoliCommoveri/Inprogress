# Enhancements Batch — Build Spec (branch `claude/enhancements-batch-noeajn`)

Hand-off spec for implementing a batch of 11 UX/data enhancements. Written against
the as-built code, keyed to exact files/functions. Follow the architecture
non-negotiables in `CLAUDE.md` and the invariants in
`docs/Code_Orientation_Where_To_Fix.md`:

- Pages → repos → Dexie. Never call `db.*` from a page.
- Vocabularies live in `data/vocab.js`; badges/dropdowns read from there, so adding
  an enum value flows to every consumer automatically. **No schema/migration** for
  any item here — everything is either a vocab value, a plain field already carried,
  or pure UI. Do **not** add a `.version(2)` block.
- Soft/interactive prompts live in page JS (warn-don't-block posture). Hard blocks
  live in repos.
- Keep the current edit-in-place patterns; don't refactor unrelated code.

When an item changes an enum documented in the data model, also update that doc's
table + changelog (noted per item). Otherwise these are code-only.

---

## 1 + 8 + 9 — Dog Detail "Planned Tests" panel rework

All three touch `renderPlannedTestsSection()` in `KennelOS/pages/dog.js` (~L621–720).
Reconciled behavior (this is the intended combined result — see the DECISION note):

**Current state:** the panel lists every planned-test token with a Logged/Planned
badge and a text **"Remove"** button, then shows four always-visible controls: an
"Add a test" input, an "Add" button, a "Copy plan from…" select, and a "Copy" button.

**Target state:**
1. **(#8) Hide already-logged planned tests.** A planned token that matches a logged
   event (`matched === true`, i.e. it currently shows the green "Logged" badge) is
   already surfaced in the **Health-Test Summary** card above it — so drop those rows
   from this list. Only render planned tokens that are **not** yet matched (the amber
   "Planned — no matching event found, verify" ones). If none remain unlogged, show
   the existing quiet empty state ("No tests planned yet." / or a "All planned tests
   logged" message).
   - Keep the matching logic exactly as-is (`loggedTokens` set, case-insensitive
     trim). Just filter the rendered `planned` list to the unmatched subset.
   - The amber badge on the remaining rows is now redundant wording ("no matching
     event found") — keep it, or simplify to a small amber "Planned" pill. Minor.
2. **(#1) Replace the "Remove" text button with an "✕" icon button.** Same
   `data-act="pt-remove"` handler and `data-token`. Add `aria-label="Remove ${t}"`
   and `title="Remove"`. Use the existing `.btn .btn-sm` classes so it stays a small
   control; render the glyph `✕` as the button text.
3. **(#9) Collapse the add/copy controls behind a toggle.** The four controls (add
   input + Add button + copy select + Copy button) should be hidden by default behind
   a single affordance in the card header — e.g. a `+ Plan a test` / `Manage plan`
   button next to the `<h2>Planned Tests</h2>` (use the `row-between` header pattern
   used by other cards). Clicking it reveals the add/copy block; clicking again hides
   it. Simplest robust implementation: keep the block in the DOM wrapped in a
   `<div id="pt-controls" hidden>` and toggle `.hidden` from a header button (local
   boolean in `ctx`, e.g. `ctx.plannedTestsAddOpen`, so it survives re-render after an
   add). Re-rendering the section after an add/copy is fine — just respect the flag.

**DECISION (confirmed by user):** #8 means "hide the *logged* planned rows (they live in
the Health-Test Summary now)," NOT "delete the whole Planned Tests panel." The panel and
its add/copy control stay; only planned tokens that have a matching logged event drop out
of the list.

Nothing in `dogRepo` changes; `planned_tests` storage and `addPlannedTests()` stay.

---

## 2 — New Dog status "For Sale"

`KennelOS/data/vocab.js` → `DOG_STATUS` array (~L19). Add one entry:

```js
{ value: 'for_sale', label: 'For Sale', badge: 'badge-amber' },
```

Suggested placement: after `pet_home` (or wherever reads best). `badge-amber` reads as
an active/transitional state; pick another if a different color is preferred.

This is vocab-driven, so it automatically appears in: the Dog edit `Status` select
(`dog.js` `renderEdit`), the status badge on Dog Detail/list, and the Dogs list
**Status** filter (`dogs.js` uses `options: DOG_STATUS`). No other code required.

Optional (only if the user asks): add a Dogs-list bucket/tab for it in `dogs.js`
`BUCKETS`. Not required.

Doc update: `Data_Model_Architecture_Proposal_v3.md` Dog `status` enum (§5.1 area) +
changelog — additive value, zero migration.

---

## 3 — Litter Detail: litter-wide event entry (cascades one event per pup)

The user described this as the "breeding hub (pairing+litter)," but the screen that
actually has a litter timeline + a pup list is **Litter Detail** (`litter.html` /
`litter.js`). The Breeding hub (`breeding.js`) is a read-only overview and is not the
target. Build this on Litter Detail.

**3a. Reorder — timeline above pups.** In `KennelOS/pages/litter.html`, swap the order
of the two sections so Timeline comes first:

```html
<!-- Timeline (litter-subject events) -->
<section id="timeline-section"></section>
<!-- Puppy Roster (derived Dog records with this litter_id) -->
<section id="roster-section"></section>
```

(The `litter.js` render-call order doesn't matter; DOM order does.)

**3b. Litter-wide event button that cascades to one Event per pup.** Add a button that
*looks* like a single "Add event" but writes one `Event` per selected puppy
(`subject_type: 'dog'`, `subject_id: <pupId>`), with a checkbox list so the user can
de-select pups that shouldn't get it (all checked by default).

Placement: a `+ Log event for whole litter` button, e.g. in the Timeline card header
(alongside the existing per-litter timeline controls) or the Puppy Roster header.

Implementation approach (recommended — extend the existing modal, don't fork it):
`KennelOS/assets/eventForm.js` currently builds ONE payload from `subjectType` +
`subjectId`. Add an optional `cascadeTargets` param:

- `openEventForm({ cascadeTargets: [{ id, label }], subjectType: 'dog', onSaved })`.
- When `cascadeTargets` is present:
  - Use `eventTypesFor('dog')` for the type list (pups are Dogs).
  - Render an extra **"Apply to"** block near the top: one checkbox per target,
    `checked` by default, label = pup call name (+ sex letter is a nice touch).
  - On save, validate at least one target is checked; then build the shared payload
    (type/date/end/related_contact/title/details/reminder/cost/notes) once and
    `await HistoryEvent.create({...payload, subject_type:'dog', subject_id: target.id})`
    for each checked target (a simple loop or `Promise.all`). Call `onSaved()` after
    all succeed. Keep the single-subject path (no `cascadeTargets`) byte-for-byte
    unchanged.
- In `litter.js`: load the roster (`dogRepo.getByLitter(ctx.original.id)`), filter to
  non-archived pups, map to `{ id, label: call_name }`, and wire the new button to
  `openEventForm({ cascadeTargets, subjectType:'dog', onSaved: () => { renderRosterSection(); renderTimelineSection(); } })`.
  Disable/hide the button when the roster is empty.

Notes / invariants:
- Cascaded events are **dog-subject** events — they land on each pup's own Health
  Timeline (dog.html), which is exactly what "record vaccinations for all pups" means.
  They are NOT litter-subject events; the litter Timeline still shows only
  `subject_type:'litter'` events. That's correct — don't try to also write a litter
  event.
- No stored link between the cascaded events; each is an independent record. No schema
  change (Event already supports dog subjects).

---

## 4 — Kennels page: bottom card overflows off-screen on mobile

`KennelOS/pages/kennels.js` builds a raw `<table class="data">` (not the responsive
`listView` component), with a 4th cell holding up to four action buttons (Preferred
tests / Edit / Archive / Delete). On a phone the table is wider than the viewport and
the action cell runs off the right edge (see screenshot).

**Primary fix (guaranteed no page-level horizontal scroll):** wrap the table in a
horizontal-scroll container.
- In `kennels.html`, the table is injected into `<div id="kennel-list">`. Either wrap
  the generated `<table>` string in `kennels.js` `render()` with
  `<div class="table-scroll">…</div>`, or make `#kennel-list` itself the scroll box.
- Add to `KennelOS/assets/app.css` (near the `table.data` block ~L297):
  ```css
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  ```

**Recommended polish (so it actually *fits* a phone instead of needing scroll),** matching
the app's existing phone-first column-collapse pattern: hide the low-value **Prefix**
and **Location** columns under 640px for this table. Add `class="col-collapse"` to
those `<th>` and `<td>` cells in `kennels.js` (`render()` header row + `displayRow()`),
reusing the existing rule:
```css
@media (max-width: 640px) { table.data th.col-collapse, table.data td.col-collapse { display: none; } }
```
(Already in app.css ~L317.) With Name + actions only, the row fits. Keep the
`.table-scroll` wrapper too as a belt-and-suspenders guarantee for the edit/tests
expanded rows.

Do not convert kennels to `listView` — out of scope; the wrapper + col-collapse is the
minimal fix.

---

## 5 — Stud Service pickers: scope dogs + show M/F

`KennelOS/pages/stud-service.js`. Currently a single `dogOptions(current)` (~L72) feeds
both the "Our dog" and "Partner dog" selects (L137–138), listing **all** dogs with no
sex indicator. Split into two scoped builders and add a sex letter to both.

- **Sex letter in labels:** append ` (M)` / ` (F)` / ` (U)` from
  `descriptor(SEX, d.sex).label[0]`. Import `SEX` and `descriptor` from `vocab.js`
  (already importing from vocab; add `SEX, descriptor`). Apply to both builders.

- **`ourDogOptions(current)`** — owned **active breeders**, males first:
  - Filter: `['owned','co_owned'].includes(d.ownership_type)` AND
    `d.status === 'active_breeding'` (excludes puppies and everyone else).
  - **Always keep the current selection** in the list even if it no longer matches
    (edit safety), same guard the codebase uses elsewhere (`|| d.id === current`).
  - Respect the existing `ctx.pickerArchived` toggle (`|| !d.is_archived`).
  - **Sort males first**, then by call name: e.g. sort key
    `(d.sex === 'male' ? 0 : d.sex === 'female' ? 1 : 2)` then `call_name`.
  - The user said "males first," NOT "males only" — do not exclude females (an
    `incoming` service has our dam as our dog). Order only.

- **`partnerDogOptions(current)`** — external only:
  - Filter: `d.ownership_type === 'external'` (the outside dog), plus the
    `|| d.id === current` and archived-toggle guards.
  - Same sex letter in the label.

Wire `ourDogOptions` to `#f-our_dog_id` and `partnerDogOptions` to `#f-partner_dog_id`.
Leave the existing sex/direction warnings in `updateWarnings()` as-is.

---

## 6 — Stud Service: add a status + scope partner contact

Two changes.

**6a. New status.** `KennelOS/data/vocab.js` → `STUD_SERVICE_STATUS` (~L128). Currently
`arranged / completed / failed / cancelled`. Add an in-progress state after `arranged`:

```js
{ value: 'in_progress', label: 'In progress', badge: 'badge-amber' },
```

(Or `active` — user said "like active or in progress"; `in_progress` is clearer.)
Vocab-driven → flows to the Status select and badge on Stud Service Detail and the
stud-services list. Doc update: `Data_Model_Architecture_Proposal_v3.md` §5.8 status
enum + changelog (additive value, zero migration).

**6b. Partner contact scoping.** `stud-service.js` `contactOptions(current)` (~L80)
feeds the `#f-partner_contact_id` select — currently every contact. Scope it to
**other breeders**, never the user themselves:
- Import `getMyContactId` from `../data/kennelSetup.js`.
- Filter: `(c.contact_type || []).includes('breeder')` AND `c.id !== getMyContactId()`.
- Keep `|| c.id === current` (edit safety) and the archived-toggle guard.
- `contact_type` is a multi-select array on Contact (data model §5.9) — use `.includes`.

---

## 7 — Sale finalize (Delivered): prompt to update the dog's ownership

`KennelOS/pages/sale.js` `save()` (~L237). Today, on transitioning INTO
`paid_in_full`/`delivered` it soft-prompts a placement event (keep that). Add: when the
sale transitions **into `delivered`** (`prevStatus !== 'delivered'`), offer a small
modal to update the **sold dog's ownership** to reflect that it has left the program.

Clarify the vocabulary (important): in the screenshot the delivered/placed dog shows
**Ownership: External** and **Status: External reference**. "External" and "Co-own" are
`OWNERSHIP_TYPE` values (`external`, `co_owned`), NOT `DOG_STATUS` values. So the modal
edits `dog.ownership_type` (and, for External, may also set `status:'external_reference'`).

Behavior:
- Guard: only on the transition into `delivered` (compute like the existing
  `enteringPlacementPrompt`). Soft/optional — offered, never forced.
- `confirmAction` is yes/no only, so build a small inline modal (reuse the
  `.modal-overlay`/`.modal` pattern from `eventForm.js`, or a compact helper). Content:
  - Title e.g. "Sale delivered — update {dogName}'s ownership?"
  - A select: `— leave unchanged —` / `External` (`external`) / `Co-owned` (`co_owned`).
  - On confirm:
    - `external` → `dogRepo.update(dogId, { ownership_type:'external', status:'external_reference', status_date: todayYMD() })`.
      External ownership **requires an owner** (`dogRepo` hard-blocks `external` with no
      `owner_contact_id`) — default the owner to the sale's `buyer_contact_id` if the
      dog has none, so the update can't fail validation.
    - `co_owned` → `dogRepo.update(dogId, { ownership_type:'co_owned' })` and add the
      buyer to `co_owner_contact_ids` if absent. (Note: the existing co-own convenience
      already runs when `placement_type === 'co_own'`; make sure the two don't
      double-prompt for adding the co-owner — reuse/guard.)
    - `leave unchanged` → no-op.
- Ordering: do the ownership modal, then the existing placement-event prompt (or vice
  versa) — sequence them so both can run without clobbering the page navigation in the
  `finish()` flow. Keep the existing `finish()` re-render/redirect at the very end.
- Import `todayYMD` from `../assets/ui.js` (already exported there; `dog.js` uses it).

Keep it warn-don't-block: a failed/declined ownership change must never block saving the
sale (the sale is already saved before the prompt).

---

## 10 — Dog Detail: order all history cards newest-first

`KennelOS/pages/dog.js`. Audit each derived history card and ensure descending
(most-recent-first) order:
- **Health Timeline** — already newest-first (`eventRepo.getForSubject` sorts
  `event_date` desc; `timeline.js` preserves order). No change.
- **Health-Test Summary** (`renderHealthTestsSection`) — uses `getForSubject` order
  (desc). No change (confirm).
- **Pairings** (`renderPairingsSection` ~L736) — already sorts `planned_date` desc.
  No change.
- **Sales** (`renderSalesSection` ~L769) — already sorts `sale_date||created_at` desc.
  No change.
- **Stud Services** (`renderStudServicesSection` ~L797) — **NOT sorted.** Add a
  newest-first sort. StudService has **no date field** (see the Q&A note at the bottom
  of this doc), so sort by `created_at` desc:
  ```js
  studServices.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  ```
- **Planned Tests** is a checklist, not history — leave.

Net: the only real code change is the stud-services sort; verify the rest render desc.

---

## 11 — Dog Detail (view mode): hide empty optional fields

`KennelOS/pages/dog.js` `renderView()` (~L191) via the `row()` helper (~L187). Today
every field renders, showing `—` for blanks (see the "Nell" screenshot wall of dashes).
Hide any optional field that is empty; it reappears once filled (edit is unchanged).

Change the `row()` helper so an empty value renders nothing:
```js
function row(label, valueHtml) {
  return valueHtml ? `<dt>${esc(label)}</dt><dd>${valueHtml}</dd>` : '';
}
```
Because the required fields (Call name, Sex, Breed, Ownership, Status) always have a
value on a saved record — and their `badge(...)` calls always return non-empty markup —
they keep rendering. Optional fields whose callers pass `esc('')`/`''` (registered
name, date of death, color, registry, reg #, microchip, sire, dam, litter, owner,
co-owners, kennel, notes) collapse out. No per-field allow-list needed.

Scope: **`dog.js` only** (the user pointed at the Dog profile). Do not touch the other
detail pages' `row()` helpers in this batch.

Watch-outs:
- `Sex`/`Ownership`/`Status` use `badge(...)`, which returns a `<span>` even for an
  empty value — they'll always show, which is fine (all required).
- The `Kennel` row is already conditionally suppressed for external/leased-in via
  `KENNEL_FIELD_HIDDEN_FOR`; with the new `row()` it also drops when kennel is unset.
  Both behaviors are fine together.

---

## 12 — Stud Service: "Sent" and "Returned" date fields

Add two optional date fields to StudService so shipping/travel dates for the arrangement
(e.g. chilled/frozen semen shipped out and returned, or a dog sent to the partner and
back) live directly on the record. This is the dedicated home; the existing
`boarding`-event-on-the-dog prompt stays as-is for physical dog travel.

**Field keys:** `sent_date`, `returned_date`. Both plain nullable `YYYY-MM-DD` strings,
both **optional**.

- **No `db.js` change.** These are never queried/filtered/sorted at the DB level, so —
  exactly like the existing `result_notes` / `notes` fields — they are NOT added to the
  `stud_services` index string. Dexie persists arbitrary fields; they ride
  create/update and the JSON backup automatically. Do not add a `.version(2)` block.
- **`KennelOS/data/studServiceRepo.js`:** no change to `REQUIRED_FIELDS` (optional
  fields). The base repo passes them through. No validation.
- **`KennelOS/pages/stud-service.js`:**
  - `blankStudService()` — add `sent_date: '', returned_date: ''`.
  - `renderView()` — add two rows after `Status` (this page's `row()` still shows `—`
    for blanks, which is consistent with the rest of stud-service view; item #11's
    empty-hiding was scoped to `dog.js` only):
    ```js
    ${row('Sent', s.sent_date ? esc(fmtDate(s.sent_date)) : '')}
    ${row('Returned', s.returned_date ? esc(fmtDate(s.returned_date)) : '')}
    ```
  - `renderEdit()` — add two `type="date"` inputs (`#f-sent_date`, `#f-returned_date`),
    e.g. after the `Status` field. Suggested hint on Sent: "Date the dog/semen was sent
    out (optional)."
  - `readForm()` — read both: `sent_date: val('f-sent_date'), returned_date: val('f-returned_date')`.
  - `updateWarnings()` — optional soft warning (warn-don't-block, matches page posture):
    if both set and `returned_date < sent_date`, push "Returned date is before the sent
    date."
- **Doc update:** `Data_Model_Architecture_Proposal_v3.md` §5.8 table — add `sent_date`
  and `returned_date` (optional, date) rows + changelog entry (additive, unindexed,
  zero migration).
- **CSV import (optional, only if the user wants it):** the `stud_service` mapping in
  `data/importExport.js` could gain `sent_date` / `returned_date` columns. Not required
  for this batch.

Item #10's stud-services sort stays on `created_at` desc — `sent_date` is optional and
often blank, so `created_at` remains the reliable ordering key.

---

## Cross-cutting / testing

- Serve over HTTP (`python3 -m http.server` in `KennelOS/`), never `file://`.
- Smoke-test each: add a "For Sale" dog; open a litter with pups and cascade a
  vaccination, confirming one event lands on each selected pup's timeline and none on
  de-selected ones; a stud service with the scoped pickers + new status + M/F labels;
  a sale marked Delivered showing the ownership modal; a dog with mostly-empty optional
  fields showing no dashes; kennels page on a ~360px viewport with no horizontal page
  scroll.
- Doc updates for the two enum additions (#2 dog `for_sale`, #6 stud-service
  `in_progress`) and the two new StudService fields (#12 `sent_date`/`returned_date`) in
  `Data_Model_Architecture_Proposal_v3.md` + its changelog. These are the only spec
  divergences; everything else is UI-only.
- No `db.js`/`referenceRegistry.js` changes. No `.version(2)`.
```
