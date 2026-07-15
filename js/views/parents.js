// parents.js — CRUD parents and playerParents links.
import {
  getParents, addParent, updateParent, deleteParent,
  getPlayers, getPlayerParentsForParent, addPlayerParent, deletePlayerParent,
  subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Parents</h2>
    <button type="button" id="add-toggle" class="add-toggle-btn" aria-expanded="false">+ Add Parent</button>
    <form id="add-parent-form" class="add-form" hidden>
      <input name="name" placeholder="Name" required />
      <input name="phone" placeholder="Phone" />
      <input name="email" placeholder="Email (optional)" />
      <button type="submit">Add Parent</button>
    </form>
    <div class="table-scroll">
      <table class="parents-table">
        <thead><tr><th>Name</th><th>Linked Child</th><th></th></tr></thead>
        <tbody id="parents-body"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#parents-body');
  const form = container.querySelector('#add-parent-form');
  const addToggle = container.querySelector('#add-toggle');
  const expandedIds = new Set();
  const editingIds = new Set();

  addToggle.addEventListener('click', () => {
    const willShow = form.hidden;
    form.hidden = !willShow;
    addToggle.setAttribute('aria-expanded', String(willShow));
  });

  function render() {
    const parents = getParents();
    const players = getPlayers();
    tbody.innerHTML = parents.map(p => {
      const links = getPlayerParentsForParent(p.id);
      const linkedNames = links.map(l => {
        const pl = players.find(x => x.id === l.playerId);
        return pl
          ? `<span class="linked-child">${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}
             <button class="unlink-btn" data-link="${l.id}">×</button></span>`
          : '';
      }).join(' ');
      const linkedIds = new Set(links.map(l => l.playerId));
      const options = players.filter(pl => !linkedIds.has(pl.id))
        .map(pl => `<option value="${pl.id}">${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}</option>`)
        .join('');
      const isExpanded = expandedIds.has(p.id);
      const isEditing = editingIds.has(p.id);
      return `
        <tr data-id="${p.id}">
          <td>${isEditing
            ? `<textarea class="f-name" rows="1">${escapeHtml(p.name)}</textarea>`
            : `<div class="name-display">${escapeHtml(p.name)}</div>`}</td>
          <td>${linkedNames}</td>
          <td><button class="expand-toggle" aria-expanded="${isExpanded}" title="More fields">${isExpanded ? '▾' : '▸'}</button></td>
        </tr>
        <tr class="expand-row" data-id="${p.id}" ${isExpanded ? '' : 'hidden'}>
          <td colspan="3">
            <div class="expand-grid">
              <div class="field-row"><label>Phone</label>
                ${isEditing ? `<input class="f-phone" value="${escapeHtml(p.phone)}" />` : `<span>${escapeHtml(p.phone) || '—'}</span>`}</div>
              <div class="field-row"><label>Email</label>
                ${isEditing ? `<input class="f-email" value="${escapeHtml(p.email)}" />` : `<span>${escapeHtml(p.email) || '—'}</span>`}</div>
              ${options ? `<div class="field-row"><label>Link child</label>
                <select class="link-select"><option value="">+ link player…</option>${options}</select></div>` : ''}
              <div class="field-row">
                <button class="edit-toggle">${isEditing ? 'Done' : 'Edit'}</button>
                <button class="delete-btn">Delete</button>
              </div>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="3">No parents yet.</td></tr>';
    tbody.querySelectorAll('.f-name').forEach(autoSizeName);
  }

  function autoSizeName(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this parent? Removes their snack assignments too.')) deleteParent(id);
    }
    if (e.target.classList.contains('unlink-btn')) {
      deletePlayerParent(e.target.dataset.link);
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

  tbody.addEventListener('input', (e) => {
    if (e.target.classList.contains('f-name')) autoSizeName(e.target);
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-name')) updateParent(id, { name: e.target.value });
    if (e.target.classList.contains('f-phone')) updateParent(id, { phone: e.target.value });
    if (e.target.classList.contains('f-email')) updateParent(id, { email: e.target.value });
    if (e.target.classList.contains('link-select') && e.target.value) {
      addPlayerParent({ playerId: e.target.value, parentId: id });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addParent({
      name: fd.get('name').trim(),
      phone: fd.get('phone').trim(),
      email: fd.get('email').trim()
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
