// selectors.js — pure derived-state reads over getData(). No mutation, no
// persistence; data.js stays the only file that touches localStorage.
import { getData } from './data.js';

// Dates are 'YYYY-MM-DD' strings compared lexicographically. Build these from
// a Date object's *local* calendar fields, not toISOString() (which is UTC):
// for any timezone west of UTC, toISOString() rolls over to tomorrow's date
// once local time passes ~evening, which wrongly flagged today's still-
// upcoming events as past/stale. This is the one shared source for "today" —
// other modules should import todayStr()/addDaysStr() rather than keep their
// own inline copy.
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayStr = () => formatLocalDate(new Date());

// Add N days to a 'YYYY-MM-DD' string, using calendar (not millisecond) math
// so it can't land on the wrong date across a DST transition.
export function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00');
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

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
