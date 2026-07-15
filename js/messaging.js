// messaging.js — mailto:/sms: link builders + weekly digest text. No localStorage access.
import {
  getEvents, getSnackAssignmentsForEvent, getParentById,
  getOpponentById, getParents
} from './data.js';

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Plain-text digest of upcoming events + snack assignments, default 7 days out.
export function buildWeeklyUpdateText(daysAhead = 7) {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + daysAhead * 864e5).toISOString().slice(0, 10);

  const upcoming = getEvents()
    .filter(e => e.date >= today && e.date <= endDate && e.status !== 'canceled')
    .sort((a, b) => a.date === b.date
      ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  if (upcoming.length === 0) {
    return `No practices or games scheduled in the next ${daysAhead} days.`;
  }

  const lines = upcoming.map(e => {
    const opp = e.opponentId ? getOpponentById(e.opponentId)?.name : null;
    const snackNames = getSnackAssignmentsForEvent(e.id)
      .map(sa => getParentById(sa.parentId)?.name)
      .filter(Boolean);

    let line = `${fmtDate(e.date)} ${e.startTime}`;
    line += e.type === 'game' ? ` — Game vs ${opp || 'TBD'}` : ' — Practice';
    if (e.location) line += ` @ ${e.location}`;
    if (snackNames.length) line += ` (Snacks: ${snackNames.join(', ')})`;
    else if (e.type === 'practice') line += ' (Snacks: unassigned)';
    return line;
  });

  return `Please see the following info for the upcoming week's practice and snack schedule:\n\n${lines.join('\n')}`;
}

export function getAllParentEmails() {
  return getParents().map(p => p.email).filter(Boolean);
}

// NOTE: commas in the "to" portion of a mailto: URI must stay LITERAL for
// multi-recipient support — do not encodeURIComponent the address list,
// only the subject/body. Encoding the comma breaks multi-recipient parsing
// in most clients.
export function mailtoLink(emails, subject, body) {
  const to = Array.isArray(emails) ? emails.join(',') : emails;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to}?${params.toString()}`;
}

// iOS wants `&` before body, Android/most others want `?` — this covers both.
export function smsLink(phone, body) {
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}

// Returns true/false rather than throwing — caller shows its own fallback UI.
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
