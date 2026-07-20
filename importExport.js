// importExport.js — JSON backup/restore (and, later, CSV import mappings).
// Lives in the data layer, so unlike pages it may use `db` directly for the
// cross-table bulk/transaction work that restore needs.
//
// The export iterates whatever tables exist in the schema, so it stays correct
// as later stages add tables — no hardcoded table list (Data Model doc §9).
import { db } from './db.js';
import { setLastBackupDate } from './settings.js';

// Bumped only when the on-disk backup shape changes in a way that needs a
// migration. Tied to the Dexie schema version so an older file can be detected.
export const BACKUP_FORMAT_VERSION = 1;

// Build the full backup object: { schema_version, exported_at, collections }.
export async function exportAll() {
  const collections = {};
  await db.transaction('r', db.tables, async () => {
    for (const table of db.tables) {
      collections[table.name] = await table.toArray();
    }
  });
  return {
    schema_version: db.verno,
    format_version: BACKUP_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    collections
  };
}

// Trigger a browser download of the backup and record the backup time.
export async function downloadBackup() {
  const data = await exportAll();
  const stamp = data.exported_at.slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kennelos-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setLastBackupDate(data.exported_at);
  return data;
}

// Basic shape validation of a parsed backup object. Returns a summary of counts
// so the UI can show what a restore would load before touching anything.
export function inspectBackup(obj) {
  if (!obj || typeof obj !== 'object' || !obj.collections || typeof obj.collections !== 'object') {
    throw new Error('This does not look like a valid backup file (missing "collections").');
  }
  const known = new Set(db.tables.map((t) => t.name));
  const counts = {};
  const unknownTables = [];
  for (const [name, rows] of Object.entries(obj.collections)) {
    if (!Array.isArray(rows)) throw new Error(`Collection "${name}" is not an array.`);
    if (!known.has(name)) unknownTables.push(name);
    counts[name] = rows.length;
  }
  return { schema_version: obj.schema_version, exported_at: obj.exported_at, counts, unknownTables };
}

// Restore a parsed backup.
//   mode 'replace' — wipe EVERY known table, then load the file's rows, so the
//                    result is exactly the backup's contents. A table the backup
//                    omits ends up empty (a full export always includes all
//                    tables; this only matters for a partial/hand-edited file).
//   mode 'merge'   — upsert the file's rows by id, leaving other records intact.
// Unknown collections (tables not in this schema version) are skipped, not an error.
export async function restoreBackup(obj, mode) {
  inspectBackup(obj);
  const known = new Set(db.tables.map((t) => t.name));
  const entries = Object.entries(obj.collections).filter(([name]) => known.has(name));

  await db.transaction('rw', db.tables, async () => {
    // Replace is a full swap: clear every known table first so tables the backup
    // doesn't mention are emptied too, not just the ones it carries.
    if (mode === 'replace') {
      for (const table of db.tables) await table.clear();
    }
    for (const [name, rows] of entries) {
      if (rows.length) await db.table(name).bulkPut(rows);
    }
  });
  return entries.map(([name, rows]) => ({ name, count: rows.length }));
}

// Read a File object as parsed JSON.
export async function readBackupFile(file) {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Could not parse the file as JSON.');
  }
}
