// litterRepo.js — all Dexie access for the Litter table. A litter's own sire_id/
// dam_id are AUTHORITATIVE for the litter (Data Model §5.4); pairing_id is the
// canonical, nullable link to the pairing that produced it. The puppy roster is
// NOT stored here — it's derived (`Dog WHERE litter_id = this.id`).
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { LITTER_REFERENCES } from './referenceRegistry.js';

const base = makeRepo('litters', LITTER_REFERENCES);

// Required to save (Stage 3 Brief §3). Everything else is warn-only in the UI:
// sex mismatch, sync-and-warn against a linked pairing's parents, future whelp
// date past a whelped+ status, and born_alive+born_deceased > born_total.
const REQUIRED_FIELDS = ['dam_id', 'sire_id', 'status'];

function validateLitter(candidate) {
  for (const f of REQUIRED_FIELDS) {
    if (candidate[f] == null || candidate[f] === '') {
      throw new Error(`Litter: "${f}" is required.`);
    }
  }
  // No hard blocks beyond required fields — the pairing sync check and count
  // checks are deliberately warn-only so messy historical/imported litters stay
  // enterable (Stage 3 Brief §3). Status is not a locked state machine.
}

export const litterRepo = {
  ...base,

  async create(data) {
    validateLitter(data);
    return base.create(data);
  },

  async update(id, changes) {
    const existing = await db.litters.get(id);
    if (!existing) throw new Error(`litters: no record with id ${id}`);
    validateLitter({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // The litter produced by a pairing (Data Model §5.3: derived, never stored on
  // Pairing). Returns the first match or null — the workflow creates one litter
  // per pairing, but the query tolerates more.
  async getForPairing(pairingId) {
    const rows = await db.litters.where('pairing_id').equals(pairingId).toArray();
    return rows[0] || null;
  },

  getAllForPairing(pairingId) {
    return db.litters.where('pairing_id').equals(pairingId).toArray();
  }
};

export { ReferenceBlockedError } from './repoBase.js';
