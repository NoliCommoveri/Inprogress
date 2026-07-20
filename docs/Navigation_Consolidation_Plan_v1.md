# Navigation Consolidation Plan v1

**Status:** Built. Today and Breeding hubs, the five-item main bar, and the
Reports/Import-Export corner menu shipped first; the People buyer segment, the
Placements & Contracts segment tabs, and the Dogs CSV export + narrow-screen
column collapse followed (see Changelog).
**Scope:** Reshape the top nav and consolidate the 40 built pages into a small set of
job-oriented hubs. No schema change, no repo-layer change, no data migration. This is a
presentation/navigation reorganization only.

## 0. Why

Today's nav is 18 flat items and 40 pages, organized by *table* (Dogs, Pairings,
Litters, Sales, …). The breeding workflow in particular is split across five pages
(`pairings`, `litters`, `active-breeding`, `live-births`, `litters-report`), which forces
the user to remember to navigate between screens that are really one job. The same data is
also re-exposed as filtered views that duplicate nav entries (Roster ⊆ Dogs, Scheduled
Placements ⊆ Upcoming, Roster and Scheduled Placements appear in *both* the nav and the
Reports hub).

## 1. Principles

1. **A nav tab is a job, not a table.** Group by the work being done, not the entity stored.
2. **List/hub pages stay in nav; detail, edit, and import pages leave nav** and are reached
   only by a button or row-click from their hub. (Import pages already work this way behind
   Import/Export — this extends the same pattern to every detail/edit page.)
3. **Depth = frequency.** Daily → landing page. Weekly → a tab. Occasional → a button inside
   a tab. Rare → a toggle, a "show more", or a report.
4. **No data lost, no page necessarily deleted.** Every existing page can survive as a
   button-reachable destination; nav simply stops pointing at most of them. URLs are
   preserved so bookmarks and deep links keep working.

## 2. The consolidated nav

Main bar, ordered by how often the user is in it:

| Order | Tab | Consolidates | Landing? |
|------|-----|--------------|----------|
| 1 | **Today** | dashboard + reminders + upcoming + board | ✅ opens here |
| 2 | **Dogs** | dogs (+ roster) → drill to dog detail, pedigree, health summary | |
| 3 | **Breeding** | pairings + litters + puppy dog records (+ active-breeding) | |
| 4 | **People** | contacts + waitlist/buyers | |
| 5 | **Placements & Contracts** | sales + stud-services + contracts | |

Tucked in a corner (⚙ / secondary menu, not the main bar — rarely opened):

| Tab | Consolidates |
|-----|--------------|
| **Reports** | litters-report, live-births, placements-report, stud-services-report, health-tests-report, scheduled-placements (all analytics; none in main nav) |
| **Import/Export** | import-export hub + every `*-import` page |

**18 main-bar items → 5** (+2 back-of-house).

## 3. Page-by-page disposition (all 40 pages)

**Nav hubs (in the bar):**
- `dashboard.html` → becomes **Today** (reordered, see §4)
- `dogs.html` → **Dogs** hub
- `pairings.html` → **Breeding** hub (rebuilt, see §5)
- `contacts.html` → **People** hub
- `sales.html` → **Placements & Contracts** hub

**Folded into a hub as a panel/tab/segment (leave the bar):**
- `reminders.html`, `upcoming.html`, `board.html` → panels of **Today**
- `roster.html` → the default filtered state of **Dogs** (its CSV export moves onto Dogs)
- `litters.html`, `active-breeding.html`, `live-births.html` → **Breeding**
- `contacts.html?buyer=1` (Waitlist/Buyers) → a segment toggle inside **People**
- `stud-services.html`, `contracts.html` → segments inside **Placements & Contracts**

**Drill-down destinations (button/row-click only, never nav):**
- `dog.html`, `pedigree.html` → from a Dogs row / dog detail
- `pairing.html`, `litter.html` → from a Breeding row
- `contact.html` → from a People row
- `sale.html`, `stud-service.html`, `contract.html` → from a Placements row

**Reports (behind the Reports hub only):**
- `litters-report.html`, `live-births.html`, `placements-report.html`,
  `stud-services-report.html`, `health-tests-report.html`, `scheduled-placements.html`

**Import utilities (behind Import/Export only — already are):**
- `dog-import.html`, `contact-import.html`, `litter-import.html`, `pairing-import.html`,
  `sale-import.html`, `stud-service-import.html`, `event-import.html`,
  `kennel-tests-import.html`

**Other:**
- `kennels.html` → kennel setup / settings, reached from Import/Export or a settings corner
  (not a daily tab)
- `index.html` → redirect to Today

No page is deleted in v1. If the user later wants the clean version, `roster.html` and
`scheduled-placements.html` are the two safe removals (each is a strict filtered subset of
another page), but that is a follow-up, not this plan.

## 4. Today (landing page) — vertical order

Opens here. Ordered so the things that change and demand action are at the **top**, and the
slow-changing stock overview is at the **bottom**.

1. **Reminders** — overdue first; dismiss / snooze inline. (the action queue)
2. **Due outs / Upcoming** — everything scheduled from today onward: drop-offs, vet visits,
   surgeries. Puppy pickups are the "Placement / drop-off" slice.
3. **Location / Status Board** — who is currently away from home (boarding stays).
4. **Kennel overview** — the at-a-glance stock counts and totals. Rarely changes, so it sits
   **last**.

## 5. Breeding — one screen, pairing → litter → puppies

Replaces the pairings/litters/active-breeding split. One screen, so nothing has to be
remembered-across-tabs.

- **Unit = a pairing.** One card/row per pairing, **most recent first**.
- Each pairing **expands in place** to show its resulting **litter**, and the litter shows
  the **resulting puppy Dog records** inline (each puppy links to its `dog.html`).
- So the full chain — pairing → litter → puppies — is visible on one screen without leaving
  it.
- **Show only the most recent ~4–5 pairings** by default; the rest collapse behind a **"Show
  more"** control.
- Editing a single pairing or litter = a button → the existing `pairing.html` / `litter.html`
  detail pages (which are no longer in the nav).
- Historical analytics (litters over time, live-birth percentages) live in **Reports**, not
  here.

## 6. Other hubs (brief)

- **Dogs** — the roster is the default view (active dogs; archived behind a toggle). Row →
  `dog.html`; from there, buttons to Pedigree and the Health-test summary. Roster's CSV
  export lands on this page.
- **People** — Contacts by default, a **Waitlist / Buyers** segment toggle (preserves the
  `?buyer=1` URL). Row → `contact.html`.
- **Placements & Contracts** — three segments: Sales, Stud Services, Contracts. Row → the
  matching detail page.
- **Reports** — unchanged hub; it already links the analytics pages. It simply stops being
  duplicated in the main nav, and gains no new job here.
- **Import/Export** — unchanged; already the single door to every importer.

## 7. Architecture fit

- Stays multi-page static. The consolidations are **hub pages that compose existing
  repo/query calls** (e.g., Breeding reads pairings, then each pairing's litter, then that
  litter's puppies) — no SPA router, no new layer. Pages → repos → Dexie is untouched.
- `nav.js` `NAV_ITEMS` shrinks to the five main entries (+ the back-of-house menu). This is
  the single source of truth for the bar, so the bar change is one edit.
- **URL preservation:** every retired nav target keeps its file and URL, so existing links,
  bookmarks, and in-page hrefs keep resolving. Where a page becomes a segment (Waitlist,
  Stud/Contracts), the query-param entry point is kept.
- No `db.version(N)` change, no `referenceRegistry.js` change, no `schema_version` bump. This
  is nav + view composition only.

## 8. Not in scope (v1)

- Deleting any page (Roster / Scheduled Placements removal is a possible follow-up).
- Any new computed data, report, or field.
- Changing what the detail/edit pages themselves do.

## Changelog

- **v1** — Initial plan. Locked decisions from design discussion: (a) landing page is
  **Today**, reordered so reminders + due-outs are at the top and the stock overview is at
  the bottom; (b) **Breeding** is one screen showing pairing → attached litter → resulting
  puppy dog records, most-recent-first, ~4–5 shown with a "Show more" for the rest.
- **v1 build, part 2** — Closed the two gaps left after the initial Today/Breeding/nav-bar
  build: (a) **Placements & Contracts** gained a `seg-tabs` pill row (Sales / Stud Services /
  Contracts) on all three pages so the hub is actually reachable as one job, matching the
  Buyers toggle pattern already on People; (b) **Dogs** gained an "Export visible to CSV"
  button (`listView.js`'s new optional `csv` config, same column set as `roster.html`) —
  Roster itself is untouched and still reachable, per §8 (no page deleted in v1). Also added
  a `collapse` flag to `listView.js` columns: on narrow screens a column so marked drops out
  of the table and into a per-row "▸ more details" expando instead of forcing horizontal
  scroll. Dogs uses it (Registered name / Breed / DOB collapse; Call name, a compact M/F/U
  Sex badge, and Status stay pinned) — the mechanism is generic and available to any other
  `listView.js` page that needs it later. `sw.js` cache bumped to v8 (content-only change to
  already-precached files; the fetch handler is cache-first, so already-installed clients
  need the cache name to change to pick this up).
