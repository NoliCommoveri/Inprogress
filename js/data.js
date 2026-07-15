// data.js — the only file allowed to call localStorage.
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

// ---------- Generic mutation helpers ----------
function touch(rec) { rec.updatedAt = new Date().toISOString(); return rec; }

function addRecord(arr, fields) {
  const rec = touch({ id: uuid(), ...fields });
  arr.push(rec);
  saveData();
  return rec;
}

function updateRecord(arr, id, patch) {
  const rec = arr.find(r => r.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  touch(rec);
  saveData();
  return rec;
}

function removeRecord(arr, id) {
  const idx = arr.findIndex(r => r.id === id);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  saveData();
  return true;
}

// ---------- Settings (singleton, not a collection) ----------
export function getSettings() { return getData().settings; }
export function updateSettings(patch) {
  Object.assign(getData().settings, patch);
  saveData();
  return getData().settings;
}

// ---------- Player ----------
export function addPlayer({ firstName = '', lastName = '', jerseyNumber = '',
    position = '', active = true, outstandingBalanceCents = 0 } = {}) {
  return addRecord(getData().players,
    { firstName, lastName, jerseyNumber, position, active, outstandingBalanceCents });
}
export function updatePlayer(id, patch) { return updateRecord(getData().players, id, patch); }
export function getPlayers() { return getData().players; }
export function getPlayerById(id) { return getData().players.find(p => p.id === id) || null; }

// ---------- Parent ----------
export function addParent({ name = '', phone = '', email = '' } = {}) {
  return addRecord(getData().parents, { name, phone, email });
}
export function updateParent(id, patch) { return updateRecord(getData().parents, id, patch); }
export function getParents() { return getData().parents; }
export function getParentById(id) { return getData().parents.find(p => p.id === id) || null; }

// ---------- PlayerParent (join, many-to-many) ----------
export function addPlayerParent({ playerId, parentId, relationship = '' }) {
  return addRecord(getData().playerParents, { playerId, parentId, relationship });
}
export function updatePlayerParent(id, patch) { return updateRecord(getData().playerParents, id, patch); }
export function deletePlayerParent(id) { return removeRecord(getData().playerParents, id); }
export function getPlayerParentsForPlayer(playerId) {
  return getData().playerParents.filter(pp => pp.playerId === playerId);
}
export function getPlayerParentsForParent(parentId) {
  return getData().playerParents.filter(pp => pp.parentId === parentId);
}

// ---------- Opponent ----------
export function addOpponent({ name = '', homeLocation = '' } = {}) {
  return addRecord(getData().opponents, { name, homeLocation });
}
export function updateOpponent(id, patch) { return updateRecord(getData().opponents, id, patch); }
export function getOpponents() { return getData().opponents; }
export function getOpponentById(id) { return getData().opponents.find(o => o.id === id) || null; }

// ---------- Event (games + practices, unified) ----------
export function addEvent({ type, date, startTime, endTime = '', location = '',
    opponentId = null, status = 'scheduled', finalScoreUs = null,
    finalScoreOpponent = null, notes = '' }) {
  return addRecord(getData().events,
    { type, date, startTime, endTime, location, opponentId, status,
      finalScoreUs, finalScoreOpponent, notes });
}
export function updateEvent(id, patch) { return updateRecord(getData().events, id, patch); }
export function getEvents() { return getData().events; }
export function getEventById(id) { return getData().events.find(e => e.id === id) || null; }

// ---------- SnackAssignment ----------
export function addSnackAssignment({ eventId, parentId, notes = '' }) {
  return addRecord(getData().snackAssignments, { eventId, parentId, notes });
}
export function updateSnackAssignment(id, patch) { return updateRecord(getData().snackAssignments, id, patch); }
export function deleteSnackAssignment(id) { return removeRecord(getData().snackAssignments, id); }
export function getSnackAssignmentsForEvent(eventId) {
  return getData().snackAssignments.filter(sa => sa.eventId === eventId);
}

// ---------- FundraiserPlatform ----------
export function addFundraiserPlatform({ name = '', url = '' } = {}) {
  return addRecord(getData().fundraiserPlatforms, { name, url });
}
export function updateFundraiserPlatform(id, patch) { return updateRecord(getData().fundraiserPlatforms, id, patch); }
export function getFundraiserPlatforms() { return getData().fundraiserPlatforms; }
export function getFundraiserPlatformById(id) {
  return getData().fundraiserPlatforms.find(p => p.id === id) || null;
}

// ---------- Fundraiser ----------
export function addFundraiser({ kind = 'general', name = '', platformId = null,
    goalAmountCents = 0, raisedAmountCents = 0, status = 'planned', notes = '' } = {}) {
  return addRecord(getData().fundraisers,
    { kind, name, platformId, goalAmountCents, raisedAmountCents, status, notes });
}
export function updateFundraiser(id, patch) { return updateRecord(getData().fundraisers, id, patch); }
export function getFundraisers() { return getData().fundraisers; }
export function getFundraiserById(id) { return getData().fundraisers.find(f => f.id === id) || null; }

// ---------- FundraiserOccurrence ----------
export function addFundraiserOccurrence({ fundraiserId, startDate, endDate, location = '', notes = '' }) {
  return addRecord(getData().fundraiserOccurrences, { fundraiserId, startDate, endDate, location, notes });
}
export function updateFundraiserOccurrence(id, patch) {
  return updateRecord(getData().fundraiserOccurrences, id, patch);
}
export function deleteFundraiserOccurrence(id) {
  return removeRecord(getData().fundraiserOccurrences, id);
}
export function getFundraiserOccurrencesForFundraiser(fundraiserId) {
  return getData().fundraiserOccurrences.filter(o => o.fundraiserId === fundraiserId);
}

// ---------- Delete helpers with cascade/nullify strategy ----------

// --- Parent: cascade join rows, DROP snack assignments (meaningless without a parent) ---
export function deleteParent(parentId) {
  const d = getData();
  d.playerParents = d.playerParents.filter(pp => pp.parentId !== parentId);
  d.snackAssignments = d.snackAssignments.filter(sa => sa.parentId !== parentId);
  d.parents = d.parents.filter(p => p.id !== parentId);
  saveData();
}

// --- Player: cascade its join rows, clear "my player" if it matched ---
export function deletePlayer(playerId) {
  const d = getData();
  d.playerParents = d.playerParents.filter(pp => pp.playerId !== playerId);
  if (d.settings.myPlayerId === playerId) d.settings.myPlayerId = null;
  d.players = d.players.filter(p => p.id !== playerId);
  saveData();
}

// --- Event: cascade its snack assignments ---
export function deleteEvent(eventId) {
  const d = getData();
  d.snackAssignments = d.snackAssignments.filter(sa => sa.eventId !== eventId);
  d.events = d.events.filter(e => e.id !== eventId);
  saveData();
}

// --- Opponent: NULLIFY from games — keep the game, just drop the opponent link ---
export function deleteOpponent(opponentId) {
  const d = getData();
  d.events.forEach(e => { if (e.opponentId === opponentId) { e.opponentId = null; touch(e); } });
  d.opponents = d.opponents.filter(o => o.id !== opponentId);
  saveData();
}

// --- Fundraiser: cascade its occurrences ---
export function deleteFundraiser(fundraiserId) {
  const d = getData();
  d.fundraiserOccurrences = d.fundraiserOccurrences.filter(o => o.fundraiserId !== fundraiserId);
  d.fundraisers = d.fundraisers.filter(f => f.id !== fundraiserId);
  saveData();
}

// --- Platform: NULLIFY from fundraisers — keep the fundraiser ---
export function deletePlatform(platformId) {
  const d = getData();
  d.fundraisers.forEach(f => { if (f.platformId === platformId) { f.platformId = null; touch(f); } });
  d.fundraiserPlatforms = d.fundraiserPlatforms.filter(p => p.id !== platformId);
  saveData();
}
