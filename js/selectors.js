// selectors.js — pure derived-state reads over getData(). No mutation, no
// persistence; data.js stays the only file that touches localStorage.
import { getData } from './data.js';

// Same 'today' expression already used in snacks.js/fundraisers.js. Dates are
// 'YYYY-MM-DD' strings compared lexicographically; toISOString() is UTC, so
// this can flip a few hours early/late vs. local midnight — a known, accepted
// caveat inherited from the existing code, not worth diverging from here.
export const todayStr = () => new Date().toISOString().slice(0, 10);

// --- Win / Loss / Tie record: completed games with both scores set ---
export function getTeamRecord() {
  const { events } = getData();
  let wins = 0, losses = 0, ties = 0;
  for (const e of events) {
    if (e.type !== 'game' || e.status !== 'completed') continue;
    if (e.finalScoreUs == null || e.finalScoreOpponent == null) continue;
    if (e.finalScoreUs > e.finalScoreOpponent) wins++;
    else if (e.finalScoreUs < e.finalScoreOpponent) losses++;
    else ties++;
  }
  return { wins, losses, ties };
}

// --- Next scheduled event of a given type ('game' | 'practice') ---
export function getNextEventOfType(type, today = todayStr()) {
  return getData().events
    .filter(e => e.type === type && e.status === 'scheduled' && e.date >= today)
    .sort((a, b) => a.date === b.date
      ? (a.startTime || '').localeCompare(b.startTime || '')
      : a.date.localeCompare(b.date))[0] || null;
}

// --- Stale events: date has passed, still marked 'scheduled' ---
export function getStaleEvents(today = todayStr()) {
  return getData().events
    .filter(e => e.status === 'scheduled' && e.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Stale fundraisers: still planned/active, but every occurrence has ended ---
// A fundraiser with no occurrences is skipped (there's no end date to judge).
export function getStaleFundraisers(today = todayStr()) {
  const { fundraisers, fundraiserOccurrences } = getData();
  return fundraisers.filter(f => {
    if (f.status !== 'planned' && f.status !== 'active') return false;
    const occ = fundraiserOccurrences.filter(o => o.fundraiserId === f.id);
    if (!occ.length) return false;
    return occ.every(o => o.endDate < today);
  });
}

// --- Convenience: is there anything needing attention at all? ---
export function hasHygieneItems(today = todayStr()) {
  return getStaleEvents(today).length > 0 || getStaleFundraisers(today).length > 0;
}
