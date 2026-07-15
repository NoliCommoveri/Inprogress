# Football Manager

Single-admin static web app for managing one youth football team (roster,
schedule, snacks, fundraisers). No backend, no login, no build step.
Hosted on GitHub Pages. All data lives in the browser's `localStorage`.

## Reference docs
- `FootballManager_Architecture.md` — data model, schema, full workflows.
- `FootballManager_BuildPlan.md` — staged checklist with acceptance gates.

Check the relevant section of these before writing a file you haven't
touched yet. Don't re-derive schema or workflow details from scratch.

## Rules that never change, at any stage

1. **UI never touches `localStorage` directly.** Every read/write/delete
   goes through `js/data.js`.
2. **No build step.** Vanilla ES modules (`<script type="module">`), no
   bundler, no transpiler, no npm install for app code.
3. **No third-party network scripts.** No CDN, no analytics. The only
   external libraries (SheetJS, jsPDF) are vendored once into `js/vendor/`
   and loaded with a local `<script>` — never fetched at runtime.
4. **Money is integer cents everywhere.** Never floats.
5. **Every record has an `updatedAt` ISO string**, stamped only by
   `data.js` mutation helpers — never set by hand elsewhere.
6. **Dates are `"YYYY-MM-DD"` strings**, times `"HH:MM"` strings — not
   `Date` objects — in storage.
7. **Hash routing** (`#/roster`, `#/schedule`, …) — required to avoid
   GitHub Pages' deep-link 404 problem.
8. **No auth, no multi-user concepts.** `settings.myPlayerId` is a
   highlight preference, not an identity system.
9. **`localStorage` is cache, not a database.** Anything touching
   durability (backup/restore, the "last backup" nudge) is a first-class
   feature, not an afterthought.

## File layout

```
/index.html
/css/styles.css
/js/
  data.js       // the only file allowed to call localStorage
  export.js     // date-range .xlsx/.pdf + full backup/restore
  router.js     // hash-based view switching
  seed.js       // first-run defaults
  vendor/       // vendored SheetJS / jsPDF, pinned versions
  views/        // one file per screen: roster, parents, schedule, snacks,
                //   fundraisers, settings
```

## Storage contract

- localStorage key: `stm:v1`; `schemaVersion` starts at `1`.
- Any change to the stored shape requires bumping `schemaVersion` and
  extending `migrate()` — every load path (`loadData`, the cross-tab
  `storage` listener, `importBackup`) must route through it.
- `js/data.js` exposes `getData/loadData/saveData/subscribe`, plus typed
  `add*/update*/delete*` helpers per entity. New entities or fields follow
  that same pattern — no ad hoc storage access anywhere else.

## Testing

ES modules need a real origin, not `file://`. Serve locally with something
like `npx serve` or `python3 -m http.server`, then test in the browser
console before wiring up any UI on top.

## Workflow

- Follow the BuildPlan's stage order — don't build ahead of a stage's
  dependencies.
- Each stage has an acceptance gate in the BuildPlan. Confirm it passes
  before starting the next stage, and stop for a check-in if a stage's
  scope or gate is ambiguous rather than guessing.
- Before ending a build session, check off the BuildPlan items you
  completed and add a short verification note under the stage's gate
  (what you tested, how, and the result) — same pattern as Stages 0-3.
- Open a PR for the session's branch once its work is committed and
  pushed.
- Once the user confirms they've approved/merged that PR, pull the
  latest default branch and start the next session's branch from it
  before doing any new work, so each stage builds on merged history
  instead of stacking on an unmerged branch.
