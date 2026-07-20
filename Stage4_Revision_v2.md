# Stage 4 Revision — v2
### Schema, Reference Registry, and Linking Rules

**How to use this doc:** this **supersedes the schema, registry, and relationship decisions in §1–§3 and §2.1 of `Stage4_Build_Brief_v1.md`**, and supersedes the data model's two-way-pointer language for the Stage 4 entities. The brief's §3 field-level *validation postures* (required fields, warn-don't-block rules, the confirmation-dialog cases) still stand — apply them with the field renames from this doc (`buyer_id` → `buyer_contact_id`, no `buyers` table), plus the new Contract lifecycle rule in §7. Everything in the brief's §4 (screens), §5 (CSV), §6 (sample data follow-up), and §7 (build order) also stands, similarly renamed. Hand this to Claude Code alongside the four existing docs.

Three decisions drive this revision, all made because **nothing has shipped and there is no data to protect:**

1. **Buyer is merged into Contact.** A buyer is a person; Contact is already the person table. One record per person, per the app's own #1 design principle.
2. **Two-way pointers are removed.** Every relationship has one canonical stored side; the reverse is a derived query. This is the rule the data model already applied when it deleted `Pairing.resulting_litter_id` in v2 — Stage 4 now applies it consistently instead of carving out three exceptions.
3. **One `version(1)` schema block.** The `version(1)/(2)/(3)` ladder only exists to protect real-data migrations. There is no real data. Collapse it now; begin additive versioning at the first real release.

---

## 1. What Changed and Why It Deletes Work

| Original Stage 4 plan | Revised | What this removes |
|---|---|---|
| `buyers` table; `Sale.buyer_id` | No `buyers` table. `Sale.buyer_contact_id` → Contact. `waitlist_status` on Contact. "Buyers" is a filtered Contact view. | A whole table, a repo, a page, and the co-owner seam (a co-owning buyer is now already a Contact, drops straight into `Dog.co_owner_contact_ids`). |
| `Sale.contract_id` ↔ `Contract.related_sale_id` (synced pair) | Contract owns `related_sale_id`. Drop `Sale.contract_id`. Reverse is `contracts.where('related_sale_id').equals(saleId)`. | Sync-in-a-transaction, unlink/re-link handling, drift detection, warn-on-disagreement. |
| `StudService.contract_id` ↔ `Contract.related_stud_service_id` (synced pair) | Contract owns `related_stud_service_id`. Drop `StudService.contract_id`. | Same as above. |
| `Pairing.stud_service_id` ↔ `StudService.pairing_id` (synced pair) | `StudService.pairing_id` canonical (mirrors `Litter.pairing_id`). Drop `Pairing.stud_service_id`. | Same as above. Pairing Detail's "Linked Stud Service" line becomes a derived query. |
| `version(1)/(2)/(3)` blocks | Single `version(1)` with all nine tables. | The `dogs.kennel_id` "exception to additive versioning" comment, and the "can't re-declare `pairings` to index it" trap. |

**Net effect on the registry:** every reverse lookup now lands on an **indexed** canonical field, so the unindexed-FK crash risk is gone entirely. `CONTRACT_REFERENCES` becomes **empty** — a Contract is a leaf, nothing points at it, so it's always hard-deletable, exactly matching data model §5.7's "stand alone" description. `BUYER_REFERENCES` disappears with the table.

**One consequence to accept deliberately:** deriving contracts-for-a-sale by query permits *multiple* contracts on one sale (sale + addendum), where the old `Sale.contract_id` structurally forced one. This is arguably more correct. If you want strict 1:1, enforce it in the "Attach Contract" UI flow, not the schema.

---

## 2. Corrected Schema — single `version(1)` block

Nine tables. All ten original entities minus `buyers` (merged into `contacts`).

```js
// db.js — all tables defined in one version. Begin additive .version(2)
// blocks only after the first real release, when migrations start to matter.
db.version(1).stores({
  dogs:          'id, sire_id, dam_id, litter_id, owner_contact_id, *co_owner_contact_ids, status, ownership_type, sex, breed, kennel_id, is_archived',
  events:        'id, [subject_type+subject_id], event_type, event_date, related_dog_id, is_archived',
  contacts:      'id, kennel_id, waitlist_status, is_archived',
  kennels:       'id, is_archived',
  pairings:      'id, sire_id, dam_id, status, pairing_type, is_archived',
  litters:       'id, pairing_id, sire_id, dam_id, status, whelp_date, is_archived',
  sales:         'id, dog_id, buyer_contact_id, status, placement_type, is_archived',
  contracts:     'id, contract_type, status, related_sale_id, related_stud_service_id, is_archived',
  stud_services: 'id, our_dog_id, partner_dog_id, partner_contact_id, direction, status, pairing_id, is_archived'
});
```

**Fields that exist but are intentionally not indexed** (stored on the object, absent from the `stores()` string — Dexie only lists indexed fields):

- `contacts.first_contact_source` — how this relationship started (see §3). Not indexed; reports scan-and-group, and autocomplete pulls distinct prior values, both fine at kennel scale.
- `contacts.waitlist_status` — indexed above because the Buyer-view filter queries on it directly (`none` / `active` / `fulfilled`).
- `contracts.status` — indexed, matching every other transactional entity's status field. Powers the status badge and any "contracts by status" filter. See §7.
- `sales.lead_source` — how *this* sale came in (see §3). Not indexed, same reasoning as `first_contact_source`.

**Dropped fields** (do not appear anywhere): `Sale.contract_id`, `StudService.contract_id`, `Pairing.stud_service_id`, and the entire `buyers` table with `Sale.buyer_id`.

---

## 3. Lead-Source / First-Contact-Source Fields

Two fields, both **free text with `<datalist>` autocomplete from existing values, no enforcement** — built exactly like `breed` already is (autocomplete-suggested, not standardized). They answer different questions and are allowed to disagree, so this is not the forbidden dual-storage:

- **`Contact.first_contact_source`** — first-touch / acquisition channel for the *person*. "How did this relationship start." Exists even for an inquiry that never becomes a sale (a waitlisted contact with no Sale record yet).
- **`Sale.lead_source`** — how *this specific sale* came in. Prefills from the contact's `first_contact_source` but is free to differ, because the same buyer can buy two dogs through two different channels — which is exactly why it can't live only on the person.

**Known deferred debt (don't fix now):** these fragment the same way `breed` does — "Facebook" / "FB" / "fb listing" become three buckets. For `breed` that's cosmetic; for these it corrupts the "% of pups from Facebook" aggregate. When the breed-standardization enhancement happens, these two fields ride the same fix. One enhancement, three fields — do not build separate normalization for them now.

**The proper model, for later, not now:** an inquiry is really a dated event-with-a-channel on a Contact (data model §5.9 already frames Events-on-Contact). If a real lead pipeline is ever wanted — multiple inquiries over time, which litter each was about, inquired → waitlisted → purchased — that's where it goes. One field today doesn't justify it; the door is already cut.

---

## 4. Simplified Reference Registry

One canonical direction per relationship; the reverse is always a derived query, never a stored back-pointer. Every field below is indexed in §2's schema.

```js
// referenceRegistry.js — full replacement for the Stage 4 version.
// Each entry: a table/field that can point AT the guarded entity.
// The delete-guard executor skips any entry whose table isn't in the
// current schema (harmless now that all nine tables exist from v1).

export const DOG_REFERENCES = [
  { table: 'dogs',          field: 'sire_id',          label: 'sire of another dog' },
  { table: 'dogs',          field: 'dam_id',           label: 'dam of another dog' },
  { table: 'events',        field: 'subject_id',       label: 'subject of an event',
    compoundIndex: '[subject_type+subject_id]', discriminatorValue: 'dog' },
  { table: 'events',        field: 'related_dog_id',   label: 'partner on an event' },
  { table: 'pairings',      field: 'sire_id',          label: 'sire in a pairing' },
  { table: 'pairings',      field: 'dam_id',           label: 'dam in a pairing' },
  { table: 'litters',       field: 'sire_id',          label: 'sire of a litter' },
  { table: 'litters',       field: 'dam_id',           label: 'dam of a litter' },
  { table: 'sales',         field: 'dog_id',           label: 'placed via a sale' },
  { table: 'stud_services', field: 'our_dog_id',       label: 'our dog in a stud service' },
  { table: 'stud_services', field: 'partner_dog_id',   label: 'partner dog in a stud service' },
];

// Now includes the merged-in buyer role via sales.buyer_contact_id.
export const CONTACT_REFERENCES = [
  { table: 'dogs',          field: 'owner_contact_id',     label: 'owner of a dog' },
  { table: 'dogs',          field: 'co_owner_contact_ids', label: 'co-owner of a dog', multiEntry: true },
  { table: 'sales',         field: 'buyer_contact_id',     label: 'buyer on a sale' },
  { table: 'stud_services', field: 'partner_contact_id',   label: 'partner contact in a stud service' },
];

export const KENNEL_REFERENCES = [
  { table: 'contacts', field: 'kennel_id', label: 'affiliated contact' },
  { table: 'dogs',     field: 'kennel_id', label: 'own-kennel dog' },
];

export const LITTER_REFERENCES = [
  { table: 'dogs', field: 'litter_id', label: 'puppy roster member' },
];

export const PAIRING_REFERENCES = [
  { table: 'litters',       field: 'pairing_id',  label: 'linked litter' },
  { table: 'events',        field: 'subject_id',  label: 'subject of an event',
    compoundIndex: '[subject_type+subject_id]', discriminatorValue: 'pairing' },
  { table: 'stud_services', field: 'pairing_id',  label: 'linked stud service' },
];

export const SALE_REFERENCES = [
  { table: 'contracts', field: 'related_sale_id', label: 'documented by a contract' },
];

export const STUD_SERVICE_REFERENCES = [
  { table: 'contracts', field: 'related_stud_service_id', label: 'documented by a contract' },
];

// Leaf — nothing points at a contract. Always hard-deletable.
export const CONTRACT_REFERENCES = [];

// BUYER_REFERENCES removed — no Buyer entity.
```

**Executor notes** (two entry shapes, one uniform loop):

- Standard entry → `db[table].where(field).equals(id)` (`.count()` or `.first()` to test existence). `co_owner_contact_ids` is a multi-entry index, so `.where('co_owner_contact_ids').equals(id)` works unchanged.
- `compoundIndex` entry (the two polymorphic Event rows) → `db.events.where('[subject_type+subject_id]').equals([discriminatorValue, id])`. Do **not** scan `subject_id` alone; it would match a pairing whose id collides with a dog's — use the compound index so the discriminator is part of the match.
- Every reverse lookup here is on an indexed field, so none needs a `.filter()` fallback. If a future field is ever added unindexed, the executor should fall back to `.filter()` rather than throw.

---

## 5. Linking Without Sync (replaces the two-way-sync rule)

Because each relationship has one canonical side, "linking" is a **single-table write owned by the repo that owns the canonical field** — no cross-table transaction, no repo writing another repo's table, so §11's ownership rule holds automatically.

| Action | Canonical write | Owning repo |
|---|---|---|
| Attach contract to a sale | set `contract.related_sale_id` | `contractRepo.update()` |
| Attach contract to a stud service | set `contract.related_stud_service_id` | `contractRepo.update()` |
| Link a stud service to a pairing | set `studService.pairing_id` | `studServiceRepo.update()` |
| "Create Pairing from this Stud Service" | `pairingRepo.create()`, then `studServiceRepo.update()` to set `pairing_id` | each repo touches only its own table |

Reverse displays are all derived queries: Sale Detail's contract panel is `contractRepo.getBySale(id)`; Pairing Detail's "Linked Stud Service" line is `studServiceRepo.getByPairing(id)`. No `Pairing`-side field to keep in sync.

**Deleting a link** is just clearing the one canonical FK — no second side to also clear. This is the whole reason the sync/unlink/drift machinery disappears.

### "Create Pairing from Stud Service" — direction mapping (state it, don't guess)

Per data model §5.8 (`outgoing` = our dog is the stud; `incoming` = our dog is the dam):

- **`direction: outgoing`** → `pairing.sire_id = studService.our_dog_id`, `pairing.dam_id = studService.partner_dog_id`
- **`direction: incoming`** → `pairing.sire_id = studService.partner_dog_id`, `pairing.dam_id = studService.our_dog_id`

Sex-mismatch stays warn-don't-block on the resulting pairing, same as everywhere else.

---

## 6. Downstream Adjustments (small, mechanical)

- **Screens (§4 of the brief):** everywhere it says `buyer_id`, read `buyer_contact_id`. "Buyer List" / "Buyer Detail" become a **typed Contact view** (Contacts filtered to those with a buyer role and/or a `waitlist_status`), not new pages — same pattern as the waitlist-is-a-filter and Kennel-is-not-a-screen decisions. Sale Detail's Contract panel and Stud Service Detail's Pairing/Contract panels read from the derived queries in §5.
- **CSV (§5 of the brief):** the Sale mapping's `buyer_name` column resolves against **Contacts**, creating a Contact (not a Buyer) inline when unmatched. Sale natural key `dog + buyer + sale_date` — a dateless sale routes to needs-review by design (`sale_date` is optional on the entity); that's expected, document it.
- **Sample data (§6 follow-up):** unchanged in intent; the manifest gains `sales`, `contracts`, `stud_services` (no `buyers` array). The sample "Buyer" for Hazel's placement is a **Contact** with `waitlist_status: fulfilled`; the empty-waitlist demo is a **Contact** with `waitlist_status: active` and no Sale.
- **JSON backup:** with one `version(1)`, `schema_version` is just `1` again from a fresh start — no v2/v3 tolerance code needed, since nothing was ever exported under the old ladder.

---

## 7. Contract Lifecycle (`Contract.status`)

Contract was the only transactional entity with no lifecycle — just `is_archived`. That's the wrong tool for "the buyer backed out": archiving *hides* a record, but a fallen-through contract is a fact you want to stay **visible** on the sale, the same way a returned Sale stays on a dog's record. So Contract gets a `status`, consistent with Sale / Pairing / StudService.

**Enum:** `draft / sent / signed / declined / cancelled / void`

- **Not a locked state machine.** Moves in any direction, no confirmation dialogs — same posture as Pairing/Litter/StudService status. Contracts get redrafted and re-sent often enough that friction would be counterproductive.
- **Default on create:** `draft`.
- Archiving stays available and orthogonal: `is_archived` still means "hide from active lists" (old cleanup), `status` means "where this deal stands." A `cancelled` contract normally stays **un-archived** so it remains visible in the sale's history.

**Multiple contracts per sale = a plain list, no distinguished "active" one *stored*.** Because contracts-for-a-sale is a derived query (§5), a sale can carry several. Sale Detail's Contract panel lists them all, newest first, each with its status badge — so "reserved → contract sent → buyer backed out (`cancelled`) → re-sent → `signed`" reads as visible history. Nothing *stores* "the current governing contract," deliberately: a stored active-flag would re-introduce the same 1:1-ish constraint this revision just removed, in a new disguise.

**Decided default for "the live contract of a sale" (a derived rule, not a stored flag):** the **most recent `signed` contract** (by `signed_date`, falling back to `created_at`), or **none** if no contract is `signed`. Any report or rule that needs "the governing contract" computes this over the list — it is not persisted. This is settled for now so build work doesn't stall on it; revisit only if a real workflow needs something richer (e.g. explicit supersede chains), which would still be a query change, never a schema flag.

No other field changes. `contract_type` still discriminates sale/stud_service/co_own/lease/other; `status` is orthogonal to it (any type can be `draft` or `cancelled`).
