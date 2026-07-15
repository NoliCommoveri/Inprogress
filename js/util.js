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
