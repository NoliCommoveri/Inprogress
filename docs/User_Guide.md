# KennelOS — User Guide

A guide to running your breeding program in KennelOS. No technical knowledge needed.
Read "Before you start" first — it explains where your data lives, which is the one thing
that will bite you if you skip it.

---

## Before you start

- **Your data lives in this web browser, on this device. Nothing is sent to a server.**
  There is no cloud account and no automatic sync.
- If you clear your browser history/site data, use a different browser, or switch devices,
  **the data does not come with you** unless you moved it yourself with a backup file.
- **Back up regularly.** More menu → Import/Export → **Download backup** saves a file you
  can restore later or move to another device. Do this often. See [Backups](#backups).
- The app works **offline** after the first time it loads. See [Offline use](#offline-use).

---

## Getting started

The first time you open KennelOS, a welcome box appears with two choices:

- **Explore with sample data** — loads a demo kennel ("Thornfield Kennels") so you can
  click around with realistic records. You can remove it later (Import/Export → **Clear
  Sample Data**).
- **Start with a blank kennel** — no records.

If you start blank (or after you clear the sample data), a second box offers **Set up your
kennel**:

1. Enter your **Kennel name** and **Your name (as owner)**. Kennel name is required.
2. Optional: tick **Prefill common health tests** to load a starter list of breed health
   tests you can pick from later.
3. Click the confirm button, or **Skip for now** to do it later.

You can run kennel setup any time from Import/Export → **Set up your kennel**.

---

## Finding your way around

The bar across the top has six sections. Everything you do lives under one of them:

| Section | What's inside |
|---|---|
| **Today** | Your home screen: suggestions, reminders, upcoming events, who's away, and active litters. |
| **Dogs** | Every dog — your breeding stock, puppies, and outside dogs. |
| **Breeding** | Pairings, litters, and the puppies they produce. |
| **People** | Contacts (buyers, vets, co-owners, other breeders) and kennels. |
| **Placements & Contracts** | Sales, stud services, and contracts. |
| **Financials** | Money in and out: expenses, income, and net. |

A **More** menu in the top corner holds three extra tools: **Reports**, **Companion**
(sharing with buyers and partners), and **Import/Export** (backups, CSV, reset).

**How records work everywhere:**
- A **list page** (e.g. Dogs) shows all records of one kind. Click a row to open it.
- A **detail page** shows one record. Click **Edit** to change its fields, then **Save**.
- Add a new record with the **+ Add …** button on the list page.
- Remove a record with **Archive** (see [Removing records](#removing-records)).

---

## Kennels

A kennel is your program's identity (name, prefix, location). You can have more than one,
and you can also record outside kennels that bred a dog you own.

**To add a kennel:** People → open the **Kennels** list → **New kennel**. Or, while adding
a contact or dog, use the inline **＋ New** button next to a kennel field.

**To edit a kennel or see its details:** Kennels list → **Open →** on the row. The detail
page holds that kennel's expenses and, for your own kennels, its program settings — the
preferred health-test list and the puppy "old enough to promote" reminder thresholds.

Mark a kennel as **your own** when it's part of your program (versus an outside breeder's
kennel you're just recording).

---

## Contacts (including buyers)

Everyone is a **Contact** — buyers, vets, groomers, co-owners, other breeders, referrers.
There is no separate "buyers" list; a buyer is a contact you attach to a sale.

**To add a contact:** People → **+ Add Contact**. Only **Name** is required. Fill in email,
phone, address, and one or more **contact types** (Buyer, Vet, Breeder, etc.) as needed.

**Waitlist:** set a contact's **waitlist status** to *Active* to mark a prospective family.
Active waitlisters are who the Companion "Prospective families" share targets (see
[Sharing with buyers and partners](#sharing-with-buyers-and-partners)).

**Companion note:** a per-contact message that shows on the share page you send *that*
person. It is separate from the private **Notes** field, which the contact never sees.

---

## Dogs

One record per dog, whether it's breeding stock, a puppy you bred, or an outside dog you
reference for pedigree. A dog does not get a new record when its life stage changes — you
update its **Status** instead.

**To add a dog:** Dogs → **+ Add Dog**. Required: **Call name, Sex, Breed, Ownership,
Status**. An **Owner** contact is also required when ownership is *External* or *Leased in*.
Everything else (registered name, dates, microchip, registration, links, notes) is optional.

**Status** is the life stage: Puppy, Active breeding, Retired breeding, Pet home, For sale,
Deceased, External reference. To change it, open the dog and use **Change status**.

**Disposition** (puppies only): your intent for a puppy before there's a sale — *Undecided,
Keeping, Available, Placed*. It drives the Today screen's active-litter list and the
selling reminders. The field only appears while a dog's status is *Puppy*.

**Parents and pedigree:** set **Sire** and **Dam** on the dog. The **Pedigree** view (from
the dog, or Dogs → Pedigree) draws the ancestor tree and lists the dog's offspring. You
cannot create a loop (a dog can't be its own ancestor).

**Health tests:** the dog page has a **Planned Tests** list (tests you intend to run) and a
**Recorded COI** value if you track inbreeding coefficients. Actual test *results* are
recorded as events on the dog's timeline — see [History and health](#history-and-health).

---

## Breeding: pairings and litters

### Pairings

A pairing is a planned or actual mating between a sire and a dam.

**To add a pairing:** Breeding → open **Pairings** → **+ Add Pairing**. Required: **Sire,
Dam, Type, Status**. The sire and dam must be different dogs. Set the **Planned first date**;
the **Expected due date** auto-fills to 63 days later (you can override it).

Record breeding progress (ties, progesterone tests, ultrasounds) as events on the pairing's
timeline.

### Litters

A litter is the outcome of a mating.

**To add a litter:** Breeding → open **Litters** → **+ Add Litter**. Required: **Dam, Sire,
Status**. You can create one directly, or from a pairing's page with **Create Litter from
this Pairing** (which fills in the parents). Record the **whelp date**; the **estimated
ready date** auto-fills to 8 weeks later (you can override it).

**To add puppies to a litter:** open the litter → **Add Puppy** (one) or **+ Add N Puppies**
(enter a count to add several rows at once). Each puppy becomes a Dog record with status
*Puppy*, already linked to the litter and its parents. The litter's puppy list is built from
these dogs automatically.

**Litter defaults:** you can set expected price and deposit per sex on the litter. When you
create a sale for one of its puppies, those amounts pre-fill based on the puppy's sex.

---

## Placements & Contracts

### Sales

A sale records placing one dog with one buyer. It's a separate record from the dog, so a
reservation, return, or re-placement each stays a distinct fact.

**To add a sale:** Placements & Contracts → open **Sales** → **+ Add Sale**. Required:
**Dog, Buyer, Placement type, Status**. Fill in price, deposit, dates, and fees as they
happen. If the buyer isn't a contact yet, use the **＋ New** button next to the buyer field
to create one on the spot.

- **Referred by:** the contact who referred this buyer (optional). They get tagged as a
  referrer automatically.
- **Fees:** transport fee and a deferred-pickup boarding rate (amount + period + count) can
  be recorded alongside the price.
- **Status** moves through Deposit pending → Deposit paid → Paid in full → Delivered (or
  Returned / Cancelled). Income figures update from this — see [Money](#money).

### Stud services

Records a stud arrangement, either direction: **Outgoing** (your dog is the stud) or
**Incoming** (your dog is the dam).

**To add a stud service:** Placements & Contracts → open **Stud Services** → **+ Add Stud
Service**. Required: **Direction, Our dog, Partner dog, Partner contact, Status**. Record the
fee structure, and — for in-person services — the ship/return dates, which feed the "away
from home" board on the Today screen.

From a completed stud service you can use **Create Pairing from this Stud Service** to record
the resulting mating.

### Contracts

A generic document record for a sale, stud service, co-ownership, or lease.

**To add a contract:** Placements & Contracts → open **Contracts** → **+ Add Contract**.
Required: **Contract type**. Link it to the related sale or stud service, or (for lease /
co-own / other types) directly to a dog and counterparty contact. Record the signed date and
a **Document link** — a share URL to the signed file kept elsewhere (e.g. a cloud drive). The
app stores the *link*, not the file.

---

## History and health (events)

Every dated thing that happens to a dog, pairing, or litter is an **event** on that record's
**timeline** — vaccinations, tests, heat cycles, medications, vet visits, boarding, whelping,
milestones, and more.

**To log an event:** open the dog, pairing, or litter → find its timeline → add an event →
pick the **type**, set the date(s), and fill in the type's fields.

- Some events are a **single date** (a vaccination); some are a **span** with a start and
  optional end (a medication course, a heat cycle, a boarding stay).
- **Test results** (genetic, breed-specific, OFA/PennHIP) recorded here feed the dog's test
  history and its Puppy Record.
- **Cost:** if you enter a **Cost** on an event, it's recorded in Financials as an expense
  automatically. Clearing the cost removes that expense. See [Money](#money).

**Log one event for a whole litter:** on a litter, use **Log event for whole litter**, tick
the puppies, and enter the details once — each puppy gets its own copy (weights are entered
per puppy).

### Reminders

An event can carry a **reminder date** — the app's way of flagging future to-dos (next
vaccination due, a follow-up).

- Set the reminder date on the event.
- It then appears on the **Today** screen, sorted into overdue / due soon / upcoming.
- From Today you can **dismiss** a reminder or **snooze** it to a later date.

---

## The Today screen

Your daily home base. It gathers, in one place:

- **Nudges** — smart suggestions based on your records (e.g. "this litter's puppies are all
  spoken for — mark it sold?", "this dog is old enough — promote to active breeding?"). Each
  nudge has a one-click action, or a **Dismiss** button. Nudges are suggestions only; nothing
  changes until you act.
- **Reminders** — the overdue / due-soon / upcoming list described above.
- **Due outs & upcoming** — scheduled placements and upcoming events.
- **Away from home** — dogs currently out (boarding stays and in-person stud services).
- **Active litters** — litters with puppies still available, with a sold/total tally.

---

## Money (Financials)

The Financials section has three views, switched by the toggle at the top:

- **Overview** — totals at a glance: earned income, anticipated income, total expenses, and
  **net** (earned minus spent), plus breakdowns.
- **Income** — money coming in, split into **Earned** (already received) and **Anticipated**
  (expected). This is calculated from your sales and outgoing stud services — you don't enter
  it here. Click any row to open a quick **Adjust** box to record a payment or change status.
- **Expenses** — money going out. This is the one place you record spending.

### Recording an expense

Two ways:

1. **Financials → Expenses view → + Add Expense.** Choose what it's against (a dog, litter,
   pairing, or your kennel), the amount, category, and date.
2. **From an event.** Entering a **Cost** on any event (a vet visit, a test) records the
   expense for you, linked to that event.

Kennel-wide costs (facility, bulk food, dues, marketing) go against your **kennel**. Buying a
new dog is an **expense** (category *New dog purchase*), not a sale — sales and stud services
are income only.

The dog, litter, pairing, and kennel detail pages each show their own running expense list.

### Invoices and receipts

**To make an invoice or receipt:** Financials → **Invoice / Receipt** button → pick the sale
or stud service → choose **Invoice** or **Receipt**, tick the lines to include and their
amounts → the document opens in a new tab → click **Print / Save as PDF**.

The document uses your kennel's name, logo, and owner details as the sender, and the buyer or
partner as the recipient. "Download" means your browser's own Print → **Save as PDF** — there
is no separate download button.

---

## Puppy Record (PDF)

A printable one-page health-and-pedigree record to hand to a puppy's new owner.

**To make one:** open a **Sale** → **Puppy Record (PDF)**. Or, from the **Sales** list, use
**Print Puppy Record**, pick the puppy from the dropdown, and print. Either way the record
opens and you use **Print / Save as PDF**.

It pulls the puppy's info, its parents' test results, its health history, and the buyer's
details automatically. Empty fields are left off rather than shown blank.

---

## Sharing with buyers and partners (Companion)

Companion creates a **read-only web link** you send to a buyer or partner. They open it with
no login and see only their own information — a snapshot as of the moment you make the link.
It is one-way: it does not update after you send it, and it can't be used to log in or change
anything.

Three kinds, one per tab under **More → Companion**:

- **Prospective families** — for active-waitlist contacts: your current available puppies,
  with prices.
- **Current families** — for a buyer with an open sale: their puppy's details, age, health
  history, sale figures and balance, and contract link.
- **Partners** — for a stud/lease/co-own partner: the relevant service and contract details.

**To send a link:**

1. More → Companion → pick the tab for the kind of recipient.
2. In the **template card**, set the shared message (kennel name, intro, announcement,
   sign-off) and tick, under **What to include**, which pieces of information to share.
3. In the **recipients list** below, click a person to expand their row. Optionally write a
   personal note and **Save note**.
4. **Preview** shows exactly what they'll see. **Prepare link** builds the shareable link and
   an email or text you tap to send.

Notes on sharing:
- A sensitive document (a signed contract) is **never** put inside the link — only a link to
  wherever you keep it, which you control separately.
- A link, once sent, stays working. There's no expiry or revoke. The snapshot date is shown
  clearly so an old link is obvious. To share updated information, send a new link.

---

## Reports

**More → Reports** holds read-only analytics tables you can filter and export to CSV:

- **Litters**, **Stud services**, **Placements**, **Health tests**, and **Litter P&L** (per-
  litter income versus cost and net).

Reports are for looking things up and exporting; you don't edit records from them.

---

## Backups

### Save a backup (do this regularly)

More → Import/Export → **JSON backup → Download backup**. This saves a single file
containing everything. Keep it somewhere safe (and off this device, if you want protection
against losing the device).

### Restore a backup

More → Import/Export → **JSON restore** → choose your backup file, then pick a mode:

- **Merge** — adds and updates records from the file, keeps everything else already present.
- **Replace** — wipes current records first, then loads the file. The result is exactly the
  backup.

Moving to a new device: install/open KennelOS there, then **Replace** from your backup file.

---

## Importing from a spreadsheet (CSV)

If you already track dogs, contacts, or other records in a spreadsheet, you can import them.

More → Import/Export → **CSV import** → pick the type (dogs, contacts, pairings, litters,
sales, events, stud services). For each:

1. Load your CSV file.
2. The app shows a **preview**: which rows it will **create**, **update**, or flag as
   **needs review**. Nothing is saved yet.
3. Adjust anything flagged, then commit.

Rows without a clear identifying key (e.g. a dog with no name) are always sent to "needs
review" rather than guessed. Parent/dog names in a row must already match an existing record.

There's also **Seed kennel test panel** to bulk-load breed health tests into your kennel's
preferred-test list.

---

## Removing records

- **Archive** is the normal "remove." It hides the record from lists but keeps it and its
  history. Lists have a **show archived** toggle to bring archived records back into view,
  where you can un-archive them.
- **Delete** permanently erases a record, and is **only allowed when nothing else points at
  it.** If a dog is a parent, has a sale, or has events, the app blocks the delete and tells
  you why. Archive it instead.

Removing a record never deletes related records — there is no cascade.

---

## Offline use

After the first successful load, KennelOS works with no internet connection. You can also
**install** it as an app: in a supported browser, use the address bar's install icon (or the
browser menu's "Install" / "Add to Home Screen"). It then opens in its own window and works
offline like any installed app. Your data is the same either way — it's tied to the browser
profile, not the internet.

---

## Reset

More → Import/Export → **Danger zone → Reset app to start** erases **all** records and
settings and returns the app to its first-run state. This cannot be undone. **Download a
backup first** if there's any chance you'll want the data back.

---

## Quick reference: where do I add…?

| To add / do this | Go here |
|---|---|
| A dog | Dogs → + Add Dog |
| A contact or buyer | People → + Add Contact |
| A kennel | People → Kennels → New kennel |
| A pairing | Breeding → Pairings → + Add Pairing |
| A litter | Breeding → Litters → + Add Litter |
| Puppies to a litter | Open the litter → Add Puppy / + Add N Puppies |
| A sale | Placements & Contracts → Sales → + Add Sale |
| A stud service | Placements & Contracts → Stud Services → + Add Stud Service |
| A contract | Placements & Contracts → Contracts → + Add Contract |
| A health event / test result | Open the dog/pairing/litter → its timeline |
| A reminder | Set a reminder date on an event |
| An expense | Financials → Expenses → + Add Expense (or a Cost on an event) |
| An invoice or receipt | Financials → Invoice / Receipt |
| A puppy record for a buyer | Open the sale → Puppy Record (PDF) |
| A share link for a buyer/partner | More → Companion |
| A backup | More → Import/Export → Download backup |
