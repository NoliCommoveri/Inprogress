// snacks.js — snack schedule view, flags unassigned upcoming practices.
// Per architecture §7, this view filters to practices only — it isn't a
// general snack-assignment view for every event type.
import {
  getEvents, getSnackAssignmentsForEvent, addSnackAssignment, deleteSnackAssignment,
  getParents, getParentById, subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';
import { todayStr } from '../selectors.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Snack Schedule</h2>
    <div class="table-scroll">
      <table class="snacks-table">
        <thead><tr><th>Date</th><th>Time</th><th>Snack Parent(s)</th><th></th></tr></thead>
        <tbody id="snacks-body"></tbody>
      </table>
    </div>
  `;
  const tbody = container.querySelector('#snacks-body');
  const expandedIds = new Set();

  function render() {
    const today = todayStr();
    const practices = getEvents()
      .filter(e => e.type === 'practice')
      .sort((a, b) => a.date === b.date
        ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));
    const parents = getParents();

    tbody.innerHTML = practices.map(e => {
      const assignments = getSnackAssignmentsForEvent(e.id);
      const isUpcoming = e.date >= today && e.status === 'scheduled';
      const unassigned = isUpcoming && assignments.length === 0;
      const assignedList = assignments.map(sa => {
        const p = getParentById(sa.parentId);
        return `${p ? escapeHtml(p.name) : '(deleted parent)'}
          <button class="unassign-btn" data-sa="${sa.id}">×</button>`;
      }).join(', ');
      const assignedIds = new Set(assignments.map(sa => sa.parentId));
      const options = parents.filter(p => !assignedIds.has(p.id))
        .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      const isExpanded = expandedIds.has(e.id);

      return `
        <tr data-id="${e.id}" class="${unassigned ? 'unassigned-flag' : ''}">
          <td class="col-date">${e.date}</td>
          <td class="col-time">${e.startTime}</td>
          <td>${assignedList || (unassigned ? '⚠️ Unassigned' : '—')}</td>
          <td><button class="expand-toggle" aria-expanded="${isExpanded}" title="More fields">${isExpanded ? '▾' : '▸'}</button></td>
        </tr>
        <tr class="expand-row" data-id="${e.id}" ${isExpanded ? '' : 'hidden'}>
          <td colspan="4">
            <div class="expand-grid">
              <div class="field-row"><label>Location</label><span>${escapeHtml(e.location) || '—'}</span></div>
              <div class="field-row"><label>Assign</label>${options ? `<select class="assign-select">
                  <option value="">+ assign parent…</option>${options}</select>` : '<span>(no parents)</span>'}</div>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">No practices scheduled.</td></tr>';
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (row) {
      const id = row.dataset.id;
      if (e.target.classList.contains('expand-toggle')) {
        if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
        render();
      }
    }
    if (e.target.classList.contains('unassign-btn')) {
      deleteSnackAssignment(e.target.dataset.sa);
    }
  });

  tbody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    if (e.target.classList.contains('assign-select') && e.target.value) {
      addSnackAssignment({ eventId: row.dataset.id, parentId: e.target.value });
    }
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
