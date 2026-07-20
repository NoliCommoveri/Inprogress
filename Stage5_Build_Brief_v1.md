# Stage 5 — Advanced Breeder Tools — Build Brief — v1
### Recorded COI, reminder engine, dashboard, analytics — and the doors left open

**How to use this doc:** hand this to Claude Code alongside `Data_Model_Architecture_Proposal_v3.md`, `Stage4_5_As_Built_v1.md`, `Stage4_5_Reconciliation_and_Logistics_Addendum_v1.md`, `Code_Orientation_Where_To_Fix.md`, and (if/when it lands) `Test_Planning_and_Vocabulary_Addendum_v1.md`. This is a **new feature stage**, not a reconciliation pass. Where it diverges from the canonical model, §1 records the delta plainly; the rest is the logic the build should follow. The architecture doc remains canonical for everything §1 does not override.

**Premise (unchanged, still load-bearing):** nothing has shipped; one user (the owner); all local records are disposable sample/test data. Stage 5 adds **one** index change and otherwise only plain fields and derived read-views. So it stays inside the single `db.version(1).stores({...})` block, reconciled by **Reset App + re-seed**, no `.version(2)`, no migration, `schema_version` stays **1**. This is the last stage that gets to add an index for free; the next index after a real release is an additive `.version(2)` block.

---

## 0. Scope

**In:**
- **Recorded COI** — an optional, user-attested COI recorded per dog. (Replaces app-computed COI.)
- **Reminder engine** — derived from `Event.reminder_date`; a pending-reminders view with overdue/due-soon/upcoming buckets, dismissal, snooze, and recurrence-by-chaining.
- **Dashboard** — a derived at-a-glance surface aggregating existing reads; no stored counters.
- **Analytics reports** — new reports on the existing Stage-1 reporting framework (litters, births, placements, stud services).
- **Health-test summary** — a read-only per-dog view of recorded genetic/health-test events.

**Explicitly deferred (doors cut in §11, not built):**
- App-computed COI, shared-ancestor intersection, pairing/offspring COI, any relatedness math.
- Mendelian / per-locus / carrier-risk genetic analysis.
- A recurrence-rule engine or any second future-dated mechanism.
- A financial module (reports may sum `Event.cost` read-only; a ledger is future).
- Kennel-wide COI/pedigree analytics (all-pairs matrices).
- The test-planning feature itself (§5.11) — its own brief; a Stage 5 audit report *depends* on it (§7).

---

## 1. Changes From the Architecture Doc (the recorded delta)

Each line is a change to what `Data_Model_Architecture_Proposal_v3.md` currently says. Logic and detail follow in later sections.

1. **§7 (Pedigree/COI) — COI is no longer computed.** Do **not** build Wright's path-counting, shared-ancestor intersection, or any offspring/pairing COI. Replace with an optional per-dog **recorded COI** (§2). Ancestor/descendant lookup and the pedigree render (§7/§14) are untouched and stay.
2. **§5.1 (Dog) — new plain field `recorded_coi`.** Nullable object `{ value, method, source, as_of_date }`, unindexed. Not an FK; never enters the reference registry.
3. **§5.2 (Event) — `reminder_date` becomes indexed**, and two new plain fields are added: `reminder_dismissed` (boolean, unindexed) and nothing else. `reminder_date` is the single future-dated mechanism (reaffirms the Test-Planning §7 wall).
4. **§8 (CSV) — Dog mapping gains COI columns; Event mapping gains `reminder_date`.** Dog import maps `coi_value, coi_method, coi_source, coi_as_of` into `recorded_coi`; Event import adds a `reminder_date` column. Warn-don't-block on unparseable values, same posture as every other importer.
5. **§5.2 catalog / `vocab.js` — new suggest-not-enforce list `COI_METHOD_SUGGESTIONS`** (`genomic / pedigree / registry / other`). No new event types. No forced enum.
6. **§11 (modules) — new derived read-owner methods and pages.** `eventRepo` owns reminder reads (`getReminders`), mirroring how it owns board/upcoming/placements. New pages: `reminders`, `dashboard`, and analytics reports. `nav.js` and landing tiles extended.

Everything else in the architecture doc holds unchanged. No new table. No `.version(2)`. No `referenceRegistry.js` change. No `format_version` change.

---

## 2. Recorded COI

### 2.1 Field
On `Dog`, add nullable, unindexed:

```
recorded_coi: {
  value:       number,   // percent, e.g. 6.25 — soft-warn on non-numeric, never block
  method:      string,   // suggest from COI_METHOD_SUGGESTIONS, free-text allowed
  source:      string,   // free text — lab/registry name, e.g. "Embark", "AKC 5-gen"
  as_of_date:  YYYY-MM-DD // when the value was attested
}
```

- **Named `recorded_coi`, not `coi`**, so a future computed value can sit beside it without a rename.
- Any subset may be null. "Is a COI recorded?" is a single null check on `recorded_coi`.
- `value` is the only field the UI treats as a number; the rest are strings/date. No field is required. No field is validated hard.
- Not an FK, not indexed, no registry entry — rides the JSON backup as part of the Dog record.

### 2.2 Display (Dog Detail)
- Render under a **"Recorded COI"** panel, always labeled as **user-recorded / attested**, never as computed or app-verified.
- Show `value` with its `method`, `source`, and `as_of_date` beside it — a bare percentage is never shown alone.
- If empty: a quiet "No COI recorded" with an add affordance. No badge, no fraction, no traffic-light.

### 2.3 CSV
Extend the Dog mapping (do not touch the engine): columns `coi_value, coi_method, coi_source, coi_as_of` populate `recorded_coi`. A row with only `coi_value` stores the value with the rest null. A row with no `coi_value` stores no COI. Non-numeric `coi_value` → soft-warn, keep the row, drop the stray value (same as the end-date-on-instant warn).

### 2.4 Product gap (state it, don't paper over it)
With no computed COI and no relatedness, the app offers **nothing** for "should I make this cross." That analysis happens in the breeder's lab/registry tools; the app records the result. This is a deliberate scope line, not an unfinished feature.

---

## 3. Reminder Engine

### 3.1 What a reminder is
A reminder is **any Event with a non-null `reminder_date`**, not dismissed, not archived. It is not a new entity and not tied to event type or `duration`. `reminder_date` is the one future-dated mechanism in the app.

### 3.2 Schema touch (the one index change)
Add `reminder_date` to the `events` index string in the single `version(1)` block:

```js
events: 'id, [subject_type+subject_id], event_type, event_date, reminder_date, related_dog_id, related_contact_id, is_archived'
```

Add plain field `reminder_dismissed: boolean` (unindexed; absent/false = pending). Reconcile locally via **Reset App + re-seed** — no `.version(2)`.

### 3.3 The reminder read (owned by `eventRepo`)
`getReminders()` — a derived read, a **sibling** to board/upcoming, never fused with them:
- `reminder_date != null`, index range probe
- exclude `is_archived`
- exclude `reminder_dismissed`
- return all pending, sorted by `reminder_date` ascending

Bucketing is a **display concern**, computed from the returned rows:
- **Overdue:** `reminder_date < today`
- **Due soon:** `today <= reminder_date <= today + N` (N a UI constant, e.g. 30 days)
- **Upcoming:** `reminder_date > today + N`

### 3.4 Acting on a reminder
- **Dismiss:** set `reminder_dismissed = true`. Drops off the view; the event stays on its timeline. (Dismissal is not archiving and not a status — same discipline as archive ≠ status.)
- **Snooze:** edit `reminder_date` to a later date. No separate snooze field — reuse the one date.
- **Complete + chain (recurrence without a recurrence engine):** acting on a due reminder may prompt "log the follow-up event," which creates the *next* Event, and that new event may itself carry a new `reminder_date`. Recurrence is a **workflow (log-the-next), not stored recurrence data.** There is no recurrence rule, no interval field, no Reminder table.

### 3.5 Reminder view (new page)
`pages/reminders.html/.js` over `eventRepo.getReminders()`. One row per pending reminder: subject (dog/pairing/litter) name → its detail, event title/type, `reminder_date`, bucket label. Sorted soonest-first, overdue surfaced first. Dismiss and snooze inline. Archive toggle to reveal dismissed. No search required in v1.

### 3.6 CSV
Add a `reminder_date` column to the Event mapping. Unparseable date → soft-warn, drop the value, keep the row.

---

## 4. Dashboard

### 4.1 Discipline (load-bearing)
The dashboard is **pure derived reads over existing repos, computed on load.** Do **not** add denormalized counter fields, cached summaries, or any stored aggregate — that breaks the one-canonical-direction and derived-not-stored invariants. If a count is slow, memoize in-page for the session, never in the schema.

### 4.2 Archive ≠ status (the classic dashboard bug)
Every count must state which question it answers. "Active dogs" (status-based, not archived), "deceased dogs" (status), and "archived records" (archive flag) are **three different reads** — never conflate deceased with archived. Active-list reads exclude archived by default; a count that means to include archived says so.

### 4.3 What it shows (all derived)
- **Dogs by status** — active_breeding / retired / puppy / pet_home / deceased counts.
- **This year:** litters whelped, pairings, sales — date-filtered reads.
- **Reminders:** overdue count + due-soon count (from `getReminders`).
- **Upcoming placements** — reuse `eventRepo.getUpcoming()` filtered to `placement`.
- **Location board count** — reuse `eventRepo.getBoardRows()` (dogs currently away).
- **Waitlist** — active-waitlist Contact count (the filtered Contact read).

### 4.4 Placement
A `pages/dashboard.html/.js` page plus a landing tile. Do not overload `index.html`'s tile grid with live computation; keep the dashboard its own surface and leave the landing tiles as navigation.

---

## 5. Analytics Reports

Reuse the **Stage-1 reporting framework** (list + column config + filters + CSV export), exactly as Active Roster / Scheduled Placements do. Each report is a derived read; **no new schema, no stored aggregates.**

- **Litters over time** — whelp counts by year/period; columns from Litter (`whelp_date`, `puppies_born_total/alive/deceased`), filterable.
- **Live-birth summary** — derived from Litter birth fields; a per-litter table, not a stored rate.
- **Placements** — Sales by `status` / `placement_type` / period; buyer resolves to Contact.
- **Stud services** — outgoing/incoming, by `status`, with partner and pairing links.
- **Health-test events** — genetic/OFA/breed-specific events across dogs, filterable (feeds §6).

**Recorded-COI caveat (display rule, not a feature):** if any report or dashboard surfaces `recorded_coi`, it **must not average across dogs** silently — the values mix methods/sources and aren't comparable. Show them per-dog with method/source, or if a summary is unavoidable, group by `method` and label it as mixed-provenance.

---

## 6. Health-Test Summary (read-only)

A per-dog summary that **presents existing data; it computes nothing new.** On Dog Detail, list the dog's `genetic_test` / `ofa_pennhip` / `breed_specific_test` events with their `details` (panel/result/rating). This is the "genetic analysis" of Stage 5: surfacing what was recorded, not inferring from it.

**Scope wall:** no carrier-risk math, no locus/genotype interpretation, no "clear/carrier/affected → offspring risk." Genetic results are free-text; interpreting them needs structured genotype data the app does not model (door in §11).

---

## 7. Test-Planning Dependency (sequencing decision)

The completeness/audit angle of "data quality auditing" **depends on the unbuilt test-planning feature (§5.11)**:
- The **health-test summary (§6)** needs only existing events → build it in Stage 5 regardless.
- A **"planned vs. logged" completeness view or a kennel-wide "dogs missing test X" audit** needs `Dog.planned_tests` / `Kennel.preferred_tests` → **build test-planning first, or defer the audit.** Do not half-build a completeness view against fields that don't exist.

Keep the two decoupled so §6 ships whether or not test-planning lands.

---

## 8. Schema-Version Posture

- **One index change** (`events` gains `reminder_date`) — edit the single `version(1)` string, Reset App + re-seed. No `.version(2)`.
- **Plain fields** (`Dog.recorded_coi`, `Event.reminder_dismissed`) — no index, no version touch, ride the backup for free.
- **No `referenceRegistry.js` change** — nothing added points at another entity (recorded_coi is data; reminder fields are on the event itself).
- **`schema_version` stays 1; `format_version` stays 1.** The JSON exporter iterates existing tables and carries the new plain fields with no code change.
- This is the **last free index.** After the first real release, `reminder_date` (already indexed here) is settled, and any further index goes in an additive `.version(2)` block that is never edited again.

---

## 9. Sample Data

Attributes on already-manifested records — **no new manifest arrays**, cleared with their Dog/Event owners (same posture as Test-Planning §8):
- **Recorded COI** on two sample dogs, with differing `method`/`source` (e.g. one `genomic`/"Embark", one `pedigree`/"AKC 5-gen") so mixed-provenance display is exercised. Leave at least one owned dog with **no** recorded COI so the empty state shows.
- **Reminders:** at least one **overdue** event (past `reminder_date`, not dismissed), one **due-soon**, one **upcoming**, and one **dismissed** (so the dismissed/archive toggle is exercised). A vaccination with a future `reminder_date` is the natural fit — it also demonstrates complete-and-chain.
- Confirm the **dashboard and reminder view are non-empty on first run** after Reset + re-seed.

---

## 10. Build Order

Console-testable data/repo work first, UI after — same shape as every prior stage.

1. **Schema:** add `reminder_date` to the `events` index; add `Event.reminder_dismissed` and `Dog.recorded_coi` plain-field handling in `eventRepo`/`dogRepo`. Reset App + re-seed. (§2.1, §3.2)
2. **Vocab:** add `COI_METHOD_SUGGESTIONS`. (§1.5)
3. **Reminder read:** `eventRepo.getReminders()` + dismiss/snooze/chain repo paths. Verify buckets in console. (§3.3–3.4)
4. **CSV:** Dog COI columns → `recorded_coi`; Event `reminder_date` column. (§2.3, §3.6)
5. **Dog Detail:** Recorded COI panel; health-test summary. (§2.2, §6)
6. **Reminder view** page + nav + tile. (§3.5)
7. **Dashboard** page + tile (pure derived reads). (§4)
8. **Analytics reports** on the reporting framework. (§5)
9. **Sample data:** recorded COIs + the four reminder states; confirm non-empty views. (§9)
10. **Nav + landing tiles + docs:** Reminders and Dashboard entries; point CLAUDE.md and the data-model changelog at this brief.

Steps 1–4 make the data usable; 5–8 deliver the surfaces; 9–10 leave the tree consistent.

---

## 11. Doors Left Open (future, not built)

Each is a clean additive re-entry, not a rework:

- **Computed COI** returns as a `computed_coi` value **beside** `recorded_coi` (name already reserved). It brings back the §7 ancestor walk (cycle-safe against imported/cyclic data via a visited-set) and must ship with a stated depth and a pedigree-completeness metric so it can't silently underestimate.
- **Pairing / offspring prediction** is **parent relatedness (coancestry), never parent COIs** — a value keyed on a dog *pair*, effectively a matrix, not a per-dog field. If built, it needs ancestor-memoization; the "walks are cheap" note covers single pedigrees only.
- **Mendelian / genotype analysis** needs **structured per-locus result data** — a new `details` shape on `genetic_test` (or a genotype sub-structure) plus a locus vocabulary. It stays strings-not-FKs to preserve import resilience. Deferred whole.
- **Recurrence rule** — only if log-the-next chaining proves insufficient. It **extends the reminder mechanism** (interval on the event, or a generator), and must remain the single future-dated mechanism — never a `Reminder` table.
- **Financial module** — `Event.cost` already rides records; reports may sum it read-only. A real income/expense ledger is a future entity, not a Stage 5 aggregate.
- **Kennel-wide COI/pedigree analytics** (all-pairs matrix, line-breeding finder) — deferred; returns only with a memoized ancestor cache.
- **Test-completeness audit** — unlocks once test-planning (§5.11) ships; §6's summary is the decoupled part that ships now.

---

## 12. Acceptance Checklist

**Recorded COI**
- [ ] `Dog.recorded_coi` stores `{value, method, source, as_of_date}`; any subset may be null; not in any registry.
- [ ] Dog Detail shows it labeled **recorded/attested**, never bare, never as computed; empty state reads "No COI recorded."
- [ ] Dog CSV maps the four columns; non-numeric `coi_value` soft-warns and drops the value, row kept.
- [ ] No app-computed COI, shared-ancestor intersection, or pairing/offspring COI exists anywhere.

**Reminder engine**
- [ ] `events` index includes `reminder_date`; reconciled via Reset App, no `.version(2)`.
- [ ] `getReminders()` is a separate read (non-null `reminder_date`, not dismissed, not archived); board/upcoming queries unchanged.
- [ ] Overdue/due-soon/upcoming buckets compute from the returned rows (display-side).
- [ ] Dismiss sets `reminder_dismissed` (not archive, not status); snooze edits `reminder_date`; complete-and-chain creates the next event with no recurrence field.
- [ ] Event CSV imports `reminder_date`; unparseable → soft-warn.
- [ ] `reminder_date` is confirmed the only future-dated mechanism (no Reminder table, no recurrence rule).

**Dashboard & analytics**
- [ ] Dashboard is all derived reads; no stored counter/summary field was added.
- [ ] Every count states active vs. archived vs. status; deceased is never conflated with archived.
- [ ] Analytics reports reuse the reporting framework; no new schema, no stored aggregate.
- [ ] No report averages `recorded_coi` across mixed methods without labeling provenance.

**Health-test summary & sequencing**
- [ ] §6 summary presents existing test events only; no carrier-risk/genotype inference.
- [ ] No completeness/audit view was built against `planned_tests`/`preferred_tests` unless test-planning shipped first.

**Docs & sample**
- [ ] Sample data yields non-empty dashboard and reminder views (four reminder states + ≥2 recorded COIs + one empty) after Reset + re-seed.
- [ ] CLAUDE.md and the data-model changelog point at this brief; `schema_version`/`format_version` still 1.

---

## 13. What This Doc Does *Not* Change

No new table. One index (`reminder_date`); otherwise plain fields only. No `.version(2)`, no migration, no `format_version` change. No new two-way pointers — reminders and COI are on their owning record; every reverse stays a derived query. No change to Dog/Event/Pairing/Litter/Sale/Contract/StudService relationships. Pedigree render, ancestor/descendant lookup, the reference registry, archive ≠ status, date-only strings, one-canonical-direction, and pages-call-repos all hold unchanged. `reminder_date` remains the single future-dated mechanism.

---

## Changelog
- **v1** — Initial Stage 5 brief. Records the delta from `Data_Model_Architecture_Proposal_v3.md`: app-computed COI dropped in favor of an optional recorded COI on Dog; `reminder_date` indexed with a dismissal field and recurrence-by-chaining; dashboard and analytics as derived reads; health-test summary as read-only presentation. Doors left open for computed COI, relatedness-based pairing prediction, genotype analysis, recurrence rules, financials, and the test-completeness audit.
