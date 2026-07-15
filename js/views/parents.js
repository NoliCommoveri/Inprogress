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
    <table class="parents-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Players</th><th></th></tr></thead>
      <tbody id="parents-body"></tbody>
    </table>
    <h3>Add Parent</h3>
    <form id="add-parent-form">
      <input name="name" placeholder="Name" required />
      <input name="phone" placeholder="Phone" />
      <input name="email" placeholder="Email (optional)" />
      <button type="submit">Add Parent</button>
    </form>
  `;

  const tbody = container.querySelector('#parents-body');
  const form = container.querySelector('#add-parent-form');

  function render() {
    const parents = getParents();
    const players = getPlayers();
    tbody.innerHTML = parents.map(p => {
      const links = getPlayerParentsForParent(p.id);
      const linkedNames = links.map(l => {
        const pl = players.find(x => x.id === l.playerId);
        return pl
          ? `${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}
             <button class="unlink-btn" data-link="${l.id}">×</button>`
          : '';
      }).join(', ');
      const linkedIds = new Set(links.map(l => l.playerId));
      const options = players.filter(pl => !linkedIds.has(pl.id))
        .map(pl => `<option value="${pl.id}">${escapeHtml(pl.firstName)} ${escapeHtml(pl.lastName)}</option>`)
        .join('');
      return `
        <tr data-id="${p.id}">
          <td><input class="f-name" value="${escapeHtml(p.name)}" /></td>
          <td><input class="f-phone" value="${escapeHtml(p.phone)}" /></td>
          <td><input class="f-email" value="${escapeHtml(p.email)}" /></td>
          <td>${linkedNames}
            ${options ? `<select class="link-select"><option value="">+ link player…</option>${options}</select>` : ''}
          </td>
          <td><button class="delete-btn">Delete</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">No parents yet.</td></tr>';
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
