// util.js — shared render/input-boundary helpers for views.
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function centsToDollarsStr(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export function dollarsToCents(str) {
  return Math.round(parseFloat(str || '0') * 100) || 0;
}

// Ask for a final score via a blocking prompt (format "yours-opponent", e.g.
// "3-1"). Returns { finalScoreUs, finalScoreOpponent } or null if the user
// canceled or entered something unparsable — callers should treat null as
// "don't complete the action yet."
export function promptGameScore(opponentLabel = '') {
  const raw = window.prompt(
    `Final score${opponentLabel ? ` vs ${opponentLabel}` : ''}? (format: yours-opponent, e.g. 3-1)`
  );
  if (raw === null) return null;
  const m = raw.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) {
    window.alert('Enter the score as "yours-opponent", e.g. 3-1.');
    return null;
  }
  return { finalScoreUs: Number(m[1]), finalScoreOpponent: Number(m[2]) };
}

// Ask for a raised amount in dollars via a blocking prompt. Returns integer
// cents, or null if the user canceled.
export function promptRaisedAmountCents(fundraiserName = '') {
  const raw = window.prompt(`Amount raised${fundraiserName ? ` for "${fundraiserName}"` : ''}? ($)`);
  if (raw === null) return null;
  return dollarsToCents(raw);
}
