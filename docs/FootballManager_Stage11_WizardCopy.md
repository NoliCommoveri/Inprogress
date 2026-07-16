# Football Manager — Getting Started Wizard: Copy

Companion to `FootballManager_ClaudeCode_Stage11-Wizard.md`. This is the
actual wording for each card — copy it verbatim into `js/wizard-content.js`.
Card numbers match the `id` field in that file.

Each body is kept to 2–3 short sentences so it fits a phone screen without
scrolling on most devices; the wizard's scroll cue handles the rare short
viewport where it doesn't.

---

### Card 1 — Welcome (`kind: standard`)

**Icon:** 🏈

**Title:** Welcome to FootballManager!

**Body:** FootballManager helps you run your team's whole season from your
phone — roster, schedule, snacks, fundraisers, and parent updates, all in
one place. Everything lives right here on your device, so it's fast,
private, and works even without a signal.

**Button:** Next

---

### Card 2 — Not a new user? (`kind: branch`)

**Icon:** 🔄

**Title:** Not a new user?

**Body:** If you've used FootballManager before and this looks like a fresh
start, your phone's browser may have quietly cleared its data — that can
happen after clearing browsing history, switching phones, or just going too
long without opening the app. If you've exported a backup before, you can
restore everything in seconds.

**Buttons:**
- Left: **I've used this before** → takes them to Settings to import a backup
- Right (primary): **I'm new here** → continues to Card 3

---

### Card 3 — Team page (`kind: standard`)

**Icon:** 🏠

**Title:** Your Team page

**Body:** This is home base — your season record, your next game, your
next practice, and a "Needs Attention" list for anything that slipped
through the cracks. It's the first thing you'll see every time you open the
app.

**Button:** Next

---

### Card 4 — Schedule (`kind: standard`)

**Icon:** 🗓️

**Title:** Schedule

**Body:** Add games and practices, track opponents, scores, and status.
Upcoming events stay sorted at the top; past ones move below automatically
so the list never gets cluttered.

**Button:** Next

---

### Card 5 — Roster (`kind: standard`)

**Icon:** 👕

**Title:** Roster

**Body:** Keep every player's jersey number, position, and any balance owed
in one list. Tap the star to follow your own player and see them
highlighted throughout the app.

**Button:** Next

---

### Card 6 — Parents (`kind: standard`)

**Icon:** 👪

**Title:** Parents

**Body:** Store contact info and link each parent to their kid — including
siblings on the same team. This is also where snack duty and fundraiser
assignments pull names from.

**Button:** Next

---

### Card 7 — Snacks (`kind: standard`)

**Icon:** 🍊

**Title:** Snack duty

**Body:** Assign a parent to bring snacks for each practice. Any unassigned
upcoming practice gets flagged automatically, so nothing gets missed.

**Button:** Next

---

### Card 8 — Fundraisers (`kind: standard`)

**Icon:** 💰

**Title:** Fundraisers

**Body:** Track goals and progress for team fundraisers, including
multi-date ones like a series of car washes. Link a platform like DoubleGood
or GoFundMe if you're using one.

**Button:** Next

---

### Card 9 — Communications (`kind: standard`)

**Icon:** 💬

**Title:** Weekly updates

**Body:** Send parents a ready-made weekly update by email or text —
upcoming games, practices, and snack assignments, pulled together for you
automatically.

**Button:** Next

---

### Card 10 — Set up your team (`kind: form`)

**Icon:** ⚙️

**Title:** Set up your team

**Body:** Let's get the basics in — you can always change these later in
Settings.

**Fields (live inputs, not just text):**
- Team name — placeholder: "e.g. Wildcats U10"
- Season — placeholder: "e.g. Fall 2026"

**Button:** Next

---

### Card 11 — Backups & reminders (`kind: closing`)

**Icon:** 🔒

**Title:** Make backups a habit

**Body:** Everything you enter lives only on this device — there's no cloud
copy. Export a backup regularly from Settings and keep the file somewhere
private. If it's been a few days, or you've made a lot of changes, a banner
will remind you automatically — you'll never have to remember on your own.

**Button:** Add your first player!

---

## Style notes for anyone editing this later

- Keep each body to 2–3 sentences. If a rewrite runs longer, that's a sign
  to cut, not a sign to rely on the scroll cue — the cue is a safety net for
  small screens, not a license to write long copy.
- Second person, plain language, no jargon — this reads like a friendly
  human explaining the app over their shoulder, not like marketing copy.
- Card 2 is the only card that should ever sound uncertain ("may have,"
  "can happen") — everywhere else, speak with confidence about what the app
  does.
