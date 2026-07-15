// data.js — the only file allowed to call localStorage.
// Stage 2 adds integrity-enforcing add/update/delete helpers per entity.
// Stage 3 adds the cross-tab `storage` event listener.

const STORAGE_KEY = 'stm:v1';
const SCHEMA_VERSION = 1;

let _cache = null;
const _subs = new Set(); // () => void, called after an external (cross-tab) change

// ---------- UUID ----------
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // fallback for insecure contexts (e.g. opened via file://)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- Empty shape ----------
function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { lastModifiedAt: null, lastBackupAt: null },
    settings: { teamName: '', season: '', myPlayerId: null },
    players: [], parents: [], playerParents: [], opponents: [],
    events: [], snackAssignments: [],
    fundraiserPlatforms: [], fundraisers: [], fundraiserOccurrences: []
  };
}

// ---------- Migration ----------
function migrate(data) {
  // Pass-through at schemaVersion 1. When a future change requires a
  // migration: branch on data.schemaVersion, mutate `data` in place, bump
  // data.schemaVersion, return it. Every load path (loadData, the storage
  // listener, and the future importBackup) must route through this.
  return data;
}

// ---------- Boot / cache / persistence ----------
export function getData() {          // always returns the live in-memory copy
  if (!_cache) loadData();
  return _cache;
}

export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  _cache = raw ? migrate(JSON.parse(raw)) : emptyData();
  return _cache;
}

export function saveData() {
  _cache.meta.lastModifiedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
}

export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }
