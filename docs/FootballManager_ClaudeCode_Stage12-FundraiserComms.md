# Football Manager — Claude Code Build Instructions (Stage 12)

You are continuing work on **Football Manager**, a static HTML/JS app. No
backend, no build step, hosted on GitHub Pages, single admin user, all data
in `localStorage`. Full context is in `FootballManager_Architecture.md` if
you have access to it — this document is self-contained.

**Where this fits:** run this after Stage 11 (Getting Started wizard). It
requires **no schema change**: no new fields, no `schemaVersion` bump, no
migration. Every value it needs already exists — fundraiser `status`
(`planned` / `active` / `completed` / `canceled`), `goalAmountCents` /
`raisedAmountCents`, `kind`, `platformId` → platform `url`, and occurrence
`startDate` / `endDate` / `location`. Read the existing `js/messaging.js`,
`js/export.js`, `js/selectors.js`, `js/views/communications.js`, and
`js/views/settings.js` before editing so this merges cleanly rather than
duplicating what's there.

Your job, two features:

1. **Fundraiser Update message** — a *second, separate* broadcast on the
   Communications view, deliberately not folded into the Weekly Update.
   The weekly digest is a passive reminder; this one is a call to action.
   Its copy is personalized (per-parent greeting) and urgency-driven
   (progress toward goal, amount left, days remaining, donation link).
2. **Fundraiser report export** — a fundraiser-centric `.xlsx`/`.pdf`
   export from Settings, *not* date-range-scoped (unlike the schedule
   export), covering all fundraisers with active ones first. Plus a small
   parity fix: the existing date-range **PDF** gains the fundraiser section
   the date-range **xlsx** has had since Stage 8.

## Hard rules (carry over from the base spec)

1. **UI code never touches `localStorage` directly.** This stage only
   reads through functions already exported by `js/data.js` and
   `js/selectors.js`.
2. **No build step, no third-party scripts.** Message links are native
   `mailto:`/`sms:` URIs; exports use the already-vendored SheetJS/jsPDF.
3. **Money is integer cents.** All arithmetic (`remaining = goal - raised`,
   percentages) happens in cents; format only at the edge with
   `centsToDollarsStr()` from `js/util.js`.
4. **Escape record-derived text before interpolating into `innerHTML`**
   with `escapeHtml()` — including platform URLs going into an `href`.
5. **Keep the two `mailto:` encoding rules already documented at the top
   of `mailtoLink()`** (literal commas in the recipient list;
   `encodeURIComponent`, never `URLSearchParams`, for subject/body).
6. **Bump `sw.js` `CACHE_NAME`** (`stm-shell-v8` → `v9`) in the same
   commit that ships this stage — every file this stage touches
   (`js/messaging.js`, `js/export.js`, `js/selectors.js`,
   `js/views/communications.js`, `js/views/settings.js`) is precached in
   `SHELL_FILES`. This convention has been missed twice before (see
   Stage 9.3/9.7 and the Stage 11 bug-fix note in the BuildPlan); don't
   make it three.

---

## Locked design decisions (from planning discussion)

- **Two messages, not one.** The Fundraiser Update is its own section and
  its own subject line; the Weekly Update text is untouched.
- **"Active" means `status !== 'completed' && status !== 'canceled'`** —
  i.e. `planned` and `active` both count. Export and messaging must use
  this same predicate so all surfaces agree with the Fundraisers view's
  grouping (`js/views/fundraisers.js` splits on `status !== 'completed'`;
  this stage's predicate is the stricter, correct one — a `canceled`
  fundraiser must never be asked for money).
- **Days remaining is derived, not stored.** Fundraisers have no end date
  of their own; occurrences do. `daysLeft` = calendar days from today to
  the **latest `endDate` ≥ today** across the fundraiser's occurrences
  (`endDate` is inclusive — ending today means "ends today", not ended).
  No occurrences → no days line, nothing else changes.

---

## 1) `js/selectors.js` — one new pure helper

```js
// Calendar-day difference between two 'YYYY-MM-DD' strings (b - a).
// Same DST-safety idea as addDaysStr: local-midnight Dates + Math.round
// so a 23/25-hour day can't produce an off-by-one.
export function daysBetweenStr(a, b) {
  return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000);
}
```

No storage access — selectors stay pure derived reads.

## 2) `js/messaging.js` — fundraiser text + subject builders

New exports (existing exports untouched):

### `getActiveFundraisersForUpdate(today = todayStr())`

Returns the fundraisers that belong in the message, each decorated with
derived fields the text builder needs:

- Filter: `status !== 'completed' && status !== 'canceled'`.
- **Exclude stale ones** — active status but every occurrence already
  ended (`getStaleFundraisers()` in `selectors.js` is the existing
  definition; reuse its logic or the function itself). Asking families to
  give to something that has ended is the opposite of driving action, and
  the hygiene banner already nags the admin to close those out.
- Fundraisers with **no occurrences at all stay in** (a `planned` online
  drive may legitimately have no dates yet) — they simply get no
  dates/urgency lines.
- Decorations per fundraiser: `remainingCents` (`max(0, goal - raised)`),
  `pct` (same formula the Fundraisers view uses: 0 when goal is 0, capped
  at 100), `daysLeft` (per the locked decision above; `null` when no
  current/upcoming occurrence), `startsInDays` (when the earliest
  not-yet-ended occurrence starts after today), `platform`
  (resolved record or `null`), and `upcomingOccurrences` (occurrences with
  `endDate >= today`, sorted by `startDate`).
- Sort: soonest deadline first (`daysLeft` ascending, `null`s last) —
  urgency leads the message.

### `buildFundraiserUpdateText({ parentName = null } = {})`

Plain-text body. Shape (not literal — write natural copy, this is the
structure and the required ingredients):

```
Hi {first name}!            ← or "Hi families!" when parentName is null

Our team fundraisers could use your help — here's where we stand:

{Fundraiser name} (helps pay for {purpose})
  $450.00 raised of $1,000.00 (45%) — $550.00 to go!
  Only 5 days left — ends Mon, Jul 21.
  Give online: https://…
  In person: Jul 18 – Jul 21 @ Field 3 snack stand

Every dollar goes straight to {purpose-of-first-fundraiser / the kids}.
Thank you for backing our players!
```

Rules for the per-fundraiser block:

- **Purpose phrase from `kind`:** `uniforms` → "new uniforms",
  `team_trip` → "the team trip", `general` → "the team". This is what
  makes the ask concrete instead of generic.
- **Progress line:** cents math, `centsToDollarsStr` at the edge. Goal of
  0 → just "$X raised so far" (no percent, no "to go"). Goal met or
  beaten → celebrate and keep the door open ("Goal reached — thank you!
  Every extra dollar still helps.") instead of "$0.00 to go".
- **Urgency line** from `daysLeft` / `startsInDays`:
  - `startsInDays > 0` → "Starts {weekday, Mon D}." (optionally "— N days
    away").
  - `daysLeft === 0` → "Last day — ends today!"
  - `daysLeft === 1` → "Only 1 day left — ends tomorrow."
  - `daysLeft <= 7` → "Only N days left — ends {weekday, Mon D}."
  - `daysLeft > 7` → "Runs through {weekday, Mon D}."
  - `daysLeft === null` → omit the line.
- **"Give online" line** only when the platform exists *and* has a
  non-empty `url`. **"In person" line(s)** from `upcomingOccurrences`
  (date range + location when set) — a fundraiser can have both.
- **Empty state:** no fundraisers survive the filter → return a short
  fallback string ("No active fundraisers right now.") — the view uses it
  for the preview and disables Email All, mirroring the Weekly Update's
  zero-events/zero-emails handling.

Personalization is **greeting-only** (first word of `parent.name`). The
body is identical for everyone — one shared cause, not per-family asks —
and a broadcast `mailto:` can't vary per recipient anyway.

### `buildFundraiserSubject()`

- Exactly one fundraiser in the update → `Help us reach our goal — {name}`.
- Otherwise → `{teamName} Fundraiser Update` (via `getSettings()`), falling
  back to `Team Fundraiser Update` when `teamName` is blank.

## 3) `js/views/communications.js` — new section + per-parent toggle

- **New "Fundraiser Update" section between Weekly Update and Parent
  Contacts**, mirroring the Weekly Update panel exactly: `<pre>` preview
  (`textContent`, never `innerHTML`), an Email All `btn-link` using
  `buildFundraiserSubject()` + the un-personalized body, a Copy button
  with the same 3-second feedback span pattern. Email All is disabled when
  there are no parent emails **or** the update has no fundraisers.
- **Parent Contacts gains a message toggle** instead of extra columns
  (the 2026-07-15 UX review's mobile feedback: don't widen tables). Two
  radio buttons above the table — "Weekly update" (default, current
  behavior, un-personalized) and "Fundraiser update". Selecting Fundraiser
  rebuilds each row's Email/Text hrefs with
  `buildFundraiserUpdateText({ parentName: p.name })` and the fundraiser
  subject — this is where the personalized greeting actually reaches a
  real recipient.
- Re-render on `subscribe()` as today; the toggle choice is transient view
  state (module-scope variable), not persisted — no settings field, no
  schema change.

## 4) `js/export.js` — fundraiser report + range-PDF parity

### `exportFundraisersToXlsx()`

Not range-scoped. Two sheets:

- **`Fundraisers`** — one row per fundraiser, *all* statuses (it's a
  report; history belongs in it), ordered active-first (same predicate),
  then `completed`, then `canceled`:
  `Name · Kind · Status · Platform · Platform URL · Goal · Raised ·
  Remaining · % of Goal · Days Left · Occurrences · Notes`.
  Money formatted like the Stage 8 sheet (`$` + `centsToDollarsStr`);
  `Days Left` only for active fundraisers with a current/upcoming
  occurrence, blank otherwise; `Occurrences` is the count.
- **`Occurrences`** — one row per occurrence:
  `Fundraiser · Start · End · Location · Notes`, sorted by fundraiser
  then `startDate`. Tolerate a dangling `fundraiserId` with
  `'(deleted)'`, same as the Stage 8 sheet does.

Filename: `fundraisers_{todayStr()}.xlsx`.

### `exportFundraisersToPdf(teamName = '')`

Title `{teamName} — Fundraiser Report {today}`. Reuse the `line()`
helper pattern from `exportRangeToPdf`. Active fundraisers as detail
blocks (name + kind, progress + remaining, days-left/starts line, platform
name + URL, occurrence lines, notes), then a compact **Completed** section
(one line each: name, raised/goal, %). `canceled` is omitted from the PDF
— it's a share-with-families document; canceled drives are xlsx-only
history. Filename: `fundraisers_{todayStr()}.pdf`.

Derivations (`daysLeft`, remaining, pct, sort) must come from the same
helper the message uses — export
`getActiveFundraisersForUpdate` from `messaging.js` and import it here (or
lift it into `selectors.js` if the import direction feels wrong), rather
than re-deriving in two places. One definition of "days left", everywhere.

### Range-PDF parity fix

`exportRangeToPdf` currently ignores fundraisers while
`exportRangeToXlsx` ships a Fundraisers sheet. Append a small
"Fundraisers" section to the range PDF listing occurrences overlapping the
range (same overlap filter the xlsx uses: `o.startDate <= endDate &&
o.endDate >= startDate`), one line each: fundraiser name, date range,
location, raised/goal. Skip the section header entirely when nothing
overlaps.

## 5) `js/views/settings.js` — report buttons

A small "Fundraiser Report" row under the existing date-range export
controls: two buttons ("Download .xlsx", "Download .pdf") calling the new
export functions (`.pdf` passes `getSettings().teamName`). No date inputs.

---

## Acceptance gate

Serve locally (`python3 -m http.server`), seed fixture data covering: a
fundraiser with platform+URL, one in-person-only, one with no occurrences,
one ending today, one starting in the future, one stale (occurrences all
past, still `active`), one `completed`, one `canceled`, one with goal 0,
one with raised ≥ goal. Then verify:

- [ ] Fundraiser Update preview: stale, completed, and canceled are
      absent; no-occurrence one appears without a dates line; ends-today
      says "ends today"; future one says "Starts …"; goal-0 shows no
      percent; goal-met celebrates; order is soonest-deadline-first.
- [ ] Broadcast greeting is "Hi families!"; switching the contacts toggle
      to Fundraiser gives each parent's links "Hi {first name}!" and the
      fundraiser subject; toggling back restores weekly links.
- [ ] Email All: correct subject, multi-recipient commas literal, spaces
      encoded as `%20` not `+`; disabled with no emails or no active
      fundraisers. Copy button works and shows feedback.
- [ ] `fundraisers_*.xlsx` opens with both sheets, all statuses present,
      cents formatted as dollars, Days Left correct for the fixtures.
- [ ] `fundraisers_*.pdf` renders active blocks + Completed section, no
      canceled entries. Range PDF now shows overlapping fundraiser
      occurrences; range xlsx output unchanged.
- [ ] `SCHEMA_VERSION` untouched; no direct `localStorage` access outside
      `data.js`; `sw.js` `CACHE_NAME` bumped to `stm-shell-v9`.
- [ ] No console/page errors across all of the above; Communications page
      has no horizontal overflow at 340px.

Record a verification note under the Stage 12 section of
`FootballManager_BuildPlan.md` (what you tested, how, result) before
closing the session, same pattern as Stages 0–11.
