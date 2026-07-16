// roster.js — list/add/edit/deactivate players, "my player" toggle.
import {
  getPlayers, addPlayer, updatePlayer, deletePlayer,
  getSettings, updateSettings, subscribe
} from '../data.js';
import { escapeHtml, centsToDollarsStr } from '../util.js';

// Ordered by roster prevalence (most to least common).
const POSITIONS = [
  { code: 'CB', label: 'Cornerback (CB)' },
  { code: 'S', label: 'Safety (S)' },
  { code: 'DL', label: 'Defensive Line (DL)' },
  { code: 'OL', label: 'Offensive Line (OL)' },
  { code: 'LB', label: 'Linebacker (LB)' },
  { code: 'WR', label: 'Wide Receiver (WR)' },
  { code: 'RB', label: 'Running Back (RB)' },
  { code: 'TE', label: 'Tight End (TE)' },
  { code: 'QB', label: 'Quarterback (QB)' },
  { code: 'K', label: 'Kicker (K)' },
  { code: 'P', label: 'Punter (P)' },
  { code: 'LS', label: 'Long Snapper (LS)' }
];
const POSITION_CODES = POSITIONS.map(p => p.code);
const POSITION_LABELS = Object.fromEntries(POSITIONS.map(p => [p.code, p.label]));

function positionOptionsHtml(selected) {
  // preserve any legacy/custom value already on the record so editing
  // doesn't silently clobber it if the admin doesn't touch the field
  const extra = selected && !POSITION_CODES.includes(selected)
    ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`
    : '';
  const opts = POSITIONS.map(p =>
    `<option value="${p.code}" ${p.code === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`
  ).join('');
  return `<option value=""></option>${extra}${opts}`;
}

const EXPAND_ADD_PLAYER_KEY = 'fm:expandAddPlayerOnce';

export function mount(container) {
  // One-time hand-off from the wizard's final card — expand the add-player
  // form on this mount only, then clear the flag so a later normal visit
  // to Roster starts collapsed as usual.
  let addFormOpen = sessionStorage.getItem(EXPAND_ADD_PLAYER_KEY) === '1';
  if (addFormOpen) sessionStorage.removeItem(EXPAND_ADD_PLAYER_KEY);

  // view-local UI state (UI prefs, not cached records — re-derived from
  // getPlayers() on every render)
  let filterStatus = 'active';   // 'all' | 'active' | 'inactive'
  let filterPosition = '';       // '' = any
  let sortKey = 'jersey';        // 'jersey' | 'last' | 'position' | 'balance'
  let sortDir = 'asc';           // 'asc' | 'desc'

  container.innerHTML = `
    <h2>Roster</h2>
    <div class="roster-controls">
      <label>Show:
        <select id="filter-status">
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>
      </label>
      <label>Position:
        <select id="filter-position"><option value="">Any</option></select>
      </label>
      <label>Sort by:
        <select id="sort-key">
          <option value="jersey">#</option>
          <option value="last">Last name</option>
          <option value="position">Position</option>
          <option value="balance">Balance</option>
        </select>
      </label>
      <button type="button" id="sort-dir" title="Toggle sort direction">▲</button>
    </div>
    <button type="button" id="add-toggle" class="add-toggle-btn" aria-expanded="${addFormOpen}">+ Add Player</button>
    <form id="add-player-form" class="add-form" ${addFormOpen ? '' : 'hidden'}>
      <input name="jerseyNumber" placeholder="#" size="3" />
      <input name="firstName" placeholder="First name" required />
      <input name="lastName" placeholder="Last name" required />
      <select name="position">${positionOptionsHtml('')}</select>
      <label class="check-label"><input type="checkbox" name="followPlayer" /> Follow this player</label>
      <button type="submit">Add Player</button>
    </form>
    <div class="table-scroll">
      <table class="roster-table">
        <thead>
          <tr><th>#</th><th>First</th><th>Last</th><th></th></tr>
        </thead>
        <tbody id="roster-body"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#roster-body');
  const form = container.querySelector('#add-player-form');
  const addToggle = container.querySelector('#add-toggle');
  const statusSel = container.querySelector('#filter-status');
  const posSel = container.querySelector('#filter-position');
  const sortKeySel = container.querySelector('#sort-key');
  const sortDirBtn = container.querySelector('#sort-dir');
  const expandedIds = new Set();
  const editingIds = new Set();

  addToggle.addEventListener('click', () => {
    const willShow = form.hidden;
    form.hidden = !willShow;
    addToggle.setAttribute('aria-expanded', String(willShow));
  });

  function jerseyCmp(a, b) {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b));
  }

  function visiblePlayers() {
    let list = getPlayers().slice();

    if (filterStatus === 'active') list = list.filter(p => p.active);
    else if (filterStatus === 'inactive') list = list.filter(p => !p.active);

    if (filterPosition) list = list.filter(p => p.position === filterPosition);

    list.sort((a, b) => {
      let r;
      if (sortKey === 'jersey') r = jerseyCmp(a.jerseyNumber, b.jerseyNumber);
      else if (sortKey === 'last') r = String(a.lastName).localeCompare(String(b.lastName));
      else if (sortKey === 'position') r = String(a.position).localeCompare(String(b.position));
      else if (sortKey === 'balance') r = (a.outstandingBalanceCents || 0) - (b.outstandingBalanceCents || 0);
      else r = 0;
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }

  function refreshPositionFilterOptions() {
    // union of standard positions + any legacy/custom positions actually in use
    const used = new Set(getPlayers().map(p => p.position).filter(Boolean));
    POSITION_CODES.forEach(p => used.add(p));
    const opts = [...used]
      .sort((a, b) => (POSITION_LABELS[a] || a).localeCompare(POSITION_LABELS[b] || b))
      .map(p => `<option value="${escapeHtml(p)}" ${p === filterPosition ? 'selected' : ''}>${escapeHtml(POSITION_LABELS[p] || p)}</option>`)
      .join('');
    posSel.innerHTML = `<option value="">Any</option>${opts}`;
  }

  function render() {
    statusSel.value = filterStatus;
    sortKeySel.value = sortKey;
    sortDirBtn.textContent = sortDir === 'asc' ? '▲' : '▼';
    refreshPositionFilterOptions();

    const players = visiblePlayers();
    const myId = getSettings().myPlayerId;
    tbody.innerHTML = players.map(p => {
      const isExpanded = expandedIds.has(p.id);
      const isEditing = editingIds.has(p.id);
      return `
      <tr data-id="${p.id}" class="${p.id === myId ? 'my-player' : ''} ${!p.active ? 'inactive' : ''}">
        ${isEditing ? `
          <td><input class="f-jersey" value="${escapeHtml(p.jerseyNumber)}" /></td>
          <td><input class="f-first" value="${escapeHtml(p.firstName)}" /></td>
          <td><input class="f-last" value="${escapeHtml(p.lastName)}" /></td>
        ` : `
          <td>${escapeHtml(p.jerseyNumber)}</td>
          <td>${escapeHtml(p.firstName)}</td>
          <td>${escapeHtml(p.lastName)}</td>
        `}
        <td><button class="expand-toggle" aria-expanded="${isExpanded}" title="More fields">${isExpanded ? '▾' : '▸'}</button></td>
      </tr>
      <tr class="expand-row" data-id="${p.id}" ${isExpanded ? '' : 'hidden'}>
        <td colspan="4">
          <div class="expand-grid">
            <div class="field-row"><label>Follow</label>
              <button class="star-btn" title="Mark as my player">${p.id === myId ? '★' : '☆'}</button></div>
            <div class="field-row"><label>Position</label>
              ${isEditing
                ? `<select class="f-position">${positionOptionsHtml(p.position)}</select>`
                : `<span>${escapeHtml(POSITION_LABELS[p.position] || p.position) || '—'}</span>`}</div>
            <div class="field-row"><label>Active</label>
              ${isEditing
                ? `<input type="checkbox" class="f-active" ${p.active ? 'checked' : ''} />`
                : `<span>${p.active ? 'Yes' : 'No'}</span>`}</div>
            <div class="field-row"><label>Balance</label>
              ${isEditing
                ? `<span>$</span><input class="f-balance" type="number" step="0.01" value="${centsToDollarsStr(p.outstandingBalanceCents)}" />`
                : `<span>$${centsToDollarsStr(p.outstandingBalanceCents)}</span>`}</div>
            <div class="field-row">
              <button class="edit-toggle">${isEditing ? 'Done' : 'Edit'}</button>
              <button class="delete-btn">Delete</button>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="4">No players match this filter.</td></tr>`;
  }

  statusSel.addEventListener('change', () => { filterStatus = statusSel.value; render(); });
  posSel.addEventListener('change', () => { filterPosition = posSel.value; render(); });
  sortKeySel.addEventListener('change', () => { sortKey = sortKeySel.value; render(); });
  sortDirBtn.addEventListener('click', () => {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    render();
  });

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('star-btn')) {
      const myId = getSettings().myPlayerId;
      updateSettings({ myPlayerId: myId === id ? null : id });
    }
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this player? This cannot be undone.')) deletePlayer(id);
    }
    if (e.target.classList.contains('expand-toggle')) {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
        editingIds.delete(id);
      } else {
        expandedIds.add(id);
      }
      render();
    }
    if (e.target.classList.contains('edit-toggle')) {
      if (editingIds.has(id)) editingIds.delete(id); else editingIds.add(id);
      render();
    }
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-jersey')) updatePlayer(id, { jerseyNumber: e.target.value });
    if (e.target.classList.contains('f-first')) updatePlayer(id, { firstName: e.target.value });
    if (e.target.classList.contains('f-last')) updatePlayer(id, { lastName: e.target.value });
    if (e.target.classList.contains('f-position')) updatePlayer(id, { position: e.target.value });
    if (e.target.classList.contains('f-active')) updatePlayer(id, { active: e.target.checked });
    if (e.target.classList.contains('f-balance')) {
      const cents = Math.round(parseFloat(e.target.value || '0') * 100);
      updatePlayer(id, { outstandingBalanceCents: cents });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const followPlayer = fd.get('followPlayer') === 'on';
    const player = addPlayer({
      jerseyNumber: fd.get('jerseyNumber').trim(),
      firstName: fd.get('firstName').trim(),
      lastName: fd.get('lastName').trim(),
      position: fd.get('position').trim()
    });
    if (followPlayer) updateSettings({ myPlayerId: player.id });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
