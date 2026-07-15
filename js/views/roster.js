// roster.js — list/add/edit/deactivate players, "my player" toggle.
import {
  getPlayers, addPlayer, updatePlayer, deletePlayer,
  getSettings, updateSettings, subscribe
} from '../data.js';
import { escapeHtml, centsToDollarsStr } from '../util.js';

const COMMON_POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];

export function mount(container) {
  container.innerHTML = `
    <h2>Roster</h2>
    <datalist id="position-list">
      ${COMMON_POSITIONS.map(p => `<option value="${p}"></option>`).join('')}
    </datalist>
    <button type="button" id="add-toggle" class="add-toggle-btn" aria-expanded="false">+ Add Player</button>
    <form id="add-player-form" class="add-form" hidden>
      <input name="jerseyNumber" placeholder="#" size="3" />
      <input name="firstName" placeholder="First name" required />
      <input name="lastName" placeholder="Last name" required />
      <input name="position" placeholder="Position" list="position-list" />
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
  const expandedIds = new Set();
  const editingIds = new Set();

  addToggle.addEventListener('click', () => {
    const willShow = form.hidden;
    form.hidden = !willShow;
    addToggle.setAttribute('aria-expanded', String(willShow));
  });

  function render() {
    const players = getPlayers();
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
                ? `<input class="f-position" value="${escapeHtml(p.position)}" list="position-list" />`
                : `<span>${escapeHtml(p.position) || '—'}</span>`}</div>
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
    }).join('') || '<tr><td colspan="4">No players yet.</td></tr>';
  }

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
