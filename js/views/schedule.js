// schedule.js — unified games + practices, shared list/calendar.
import {
  getEvents, addEvent, updateEvent, deleteEvent,
  getOpponents, addOpponent, getOpponentById,
  subscribe
} from '../data.js';
import { todayStr } from '../selectors.js';
import { escapeHtml } from '../util.js';

const STATUS_LABEL = { scheduled: 'Scheduled', canceled: 'Canceled', completed: 'Completed' };
const TYPE_LABEL = { practice: 'Practice', game: 'Game' };

export function mount(container) {
  container.innerHTML = `
    <h2>Schedule</h2>
    <button type="button" id="add-toggle" class="add-toggle-btn" aria-expanded="false">+ Add Event</button>
    <form id="add-event-form" class="add-form" hidden>
      <select name="type"><option value="practice">Practice</option><option value="game">Game</option></select>
      <input type="date" name="date" required />
      <input type="time" name="startTime" required />
      <input type="time" name="endTime" />
      <input name="location" placeholder="Location" />
      <select name="opponentId" id="opponent-select"><option value="">— No opponent —</option></select>
      <button type="button" id="new-opponent-btn">+ New opponent</button>
      <button type="submit">Add Event</button>
    </form>

    <dialog id="opponent-dialog">
      <h3>New Opponent</h3>
      <form id="opponent-form">
        <input name="name" placeholder="Opponent name" required />
        <input name="homeLocation" placeholder="Home location (optional)" />
        <div class="modal-actions">
          <button type="button" class="cancel-btn" id="opponent-cancel-btn">Cancel</button>
          <button type="submit">Add Opponent</button>
        </div>
      </form>
    </dialog>

    <section class="schedule-group">
      <h3>Upcoming</h3>
      <div class="table-scroll">
        <table class="schedule-table">
          <thead><tr><th>Date</th><th>Time</th><th>Type</th><th></th></tr></thead>
          <tbody id="schedule-upcoming"></tbody>
        </table>
      </div>
    </section>
    <section class="schedule-group">
      <h3>Past</h3>
      <div class="table-scroll">
        <table class="schedule-table">
          <thead><tr><th>Date</th><th>Time</th><th>Type</th><th></th></tr></thead>
          <tbody id="schedule-past"></tbody>
        </table>
      </div>
    </section>
  `;

  const upcomingBody = container.querySelector('#schedule-upcoming');
  const pastBody = container.querySelector('#schedule-past');
  const form = container.querySelector('#add-event-form');
  const addToggle = container.querySelector('#add-toggle');
  const oppSelect = container.querySelector('#opponent-select');
  const expandedIds = new Set();
  const editingIds = new Set();

  addToggle.addEventListener('click', () => {
    const willShow = form.hidden;
    form.hidden = !willShow;
    addToggle.setAttribute('aria-expanded', String(willShow));
  });

  function renderOpponentOptions(select, selectedId = '') {
    const opts = getOpponents().map(o =>
      `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
    select.innerHTML = `<option value="">— No opponent —</option>${opts}`;
  }

  function rowHtml(e) {
      const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
      const isGame = e.type === 'game';
      const isExpanded = expandedIds.has(e.id);
      const isEditing = editingIds.has(e.id);
      const stale = e.status === 'scheduled' && e.date < todayStr();
      return `
        <tr data-id="${e.id}" class="${stale ? 'stale-event' : ''}">
          ${isEditing ? `
            <td><input type="date" class="f-date" value="${e.date}" /></td>
            <td><input type="time" class="f-start" value="${e.startTime}" /></td>
            <td>
              <select class="f-type">
                <option value="practice" ${!isGame ? 'selected' : ''}>Practice</option>
                <option value="game" ${isGame ? 'selected' : ''}>Game</option>
              </select>
            </td>
          ` : `
            <td>${stale ? '⚠️ ' : ''}${escapeHtml(e.date)}</td>
            <td>${escapeHtml(e.startTime)}</td>
            <td>${TYPE_LABEL[e.type] || e.type}</td>
          `}
          <td><button class="expand-toggle" aria-expanded="${isExpanded}" title="More fields">${isExpanded ? '▾' : '▸'}</button></td>
        </tr>
        <tr class="expand-row" data-id="${e.id}" ${isExpanded ? '' : 'hidden'}>
          <td colspan="4">
            <div class="expand-grid">
              <div class="field-row"><label>End time</label>
                ${isEditing
                  ? `<input type="time" class="f-end" value="${e.endTime || ''}" />`
                  : `<span>${escapeHtml(e.endTime) || '—'}</span>`}</div>
              ${isGame ? `<div class="field-row"><label>Opponent</label>
                ${isEditing ? `<select class="f-opponent">
                  <option value="">— No opponent —</option>${
                    getOpponents().map(o => `<option value="${o.id}" ${o.id === e.opponentId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')
                  }</select>` : `<span>${opp ? escapeHtml(opp.name) : '—'}</span>`}</div>` : ''}
              <div class="field-row"><label>Location</label>
                ${isEditing
                  ? `<input class="f-location" value="${escapeHtml(e.location)}"
                      placeholder="${opp ? escapeHtml(opp.homeLocation || '') : ''}" />`
                  : `<span>${escapeHtml(e.location) || (opp ? escapeHtml(opp.homeLocation || '') : '') || '—'}</span>`}</div>
              <div class="field-row"><label>Status</label>
                ${isEditing ? `<select class="f-status">
                  <option value="scheduled" ${e.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                  <option value="canceled" ${e.status === 'canceled' ? 'selected' : ''}>Canceled</option>
                  <option value="completed" ${e.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>` : `<span>${STATUS_LABEL[e.status] || e.status}</span>`}</div>
              ${isGame && e.status === 'completed' ? `
                <div class="field-row"><label>Score</label>
                  ${isEditing ? `
                    <input type="number" class="f-score-us" value="${e.finalScoreUs ?? ''}" /> -
                    <input type="number" class="f-score-opp" value="${e.finalScoreOpponent ?? ''}" />
                  ` : `<span>${e.finalScoreUs ?? '—'} - ${e.finalScoreOpponent ?? '—'}</span>`}</div>
              ` : ''}
              <div class="field-row">
                <button class="edit-toggle">${isEditing ? 'Done' : 'Edit'}</button>
                <button class="delete-btn">Delete</button>
              </div>
            </div>
          </td>
        </tr>`;
  }

  function render() {
    renderOpponentOptions(oppSelect);
    const today = todayStr();
    const sorted = [...getEvents()].sort((a, b) =>
      a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

    const upcoming = sorted.filter(e => e.date >= today);      // ascending
    const past = sorted.filter(e => e.date < today).reverse(); // most recent first

    upcomingBody.innerHTML = upcoming.map(rowHtml).join('')
      || '<tr><td colspan="4">No upcoming events.</td></tr>';
    pastBody.innerHTML = past.map(rowHtml).join('')
      || '<tr><td colspan="4">No past events.</td></tr>';
  }

  function onClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this event? Removes its snack assignments too.')) deleteEvent(id);
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
  }

  function onChange(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('f-date')) updateEvent(id, { date: e.target.value });
    if (e.target.classList.contains('f-start')) updateEvent(id, { startTime: e.target.value });
    if (e.target.classList.contains('f-end')) updateEvent(id, { endTime: e.target.value });
    if (e.target.classList.contains('f-type')) updateEvent(id, { type: e.target.value });
    if (e.target.classList.contains('f-opponent')) updateEvent(id, { opponentId: e.target.value || null });
    if (e.target.classList.contains('f-location')) updateEvent(id, { location: e.target.value });
    if (e.target.classList.contains('f-status')) updateEvent(id, { status: e.target.value });
    if (e.target.classList.contains('f-score-us'))
      updateEvent(id, { finalScoreUs: e.target.value === '' ? null : Number(e.target.value) });
    if (e.target.classList.contains('f-score-opp'))
      updateEvent(id, { finalScoreOpponent: e.target.value === '' ? null : Number(e.target.value) });
  }

  upcomingBody.addEventListener('click', onClick);
  pastBody.addEventListener('click', onClick);
  upcomingBody.addEventListener('change', onChange);
  pastBody.addEventListener('change', onChange);

  const oppDialog = container.querySelector('#opponent-dialog');
  const oppForm = container.querySelector('#opponent-form');

  container.querySelector('#new-opponent-btn').addEventListener('click', () => {
    oppForm.reset();
    oppDialog.showModal();
  });

  container.querySelector('#opponent-cancel-btn').addEventListener('click', () => {
    oppDialog.close();
  });

  oppForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(oppForm);
    const name = fd.get('name').trim();
    if (!name) return;
    const homeLocation = fd.get('homeLocation').trim();
    const opp = addOpponent({ name, homeLocation });
    oppDialog.close();
    renderOpponentOptions(oppSelect, opp.id);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addEvent({
      type: fd.get('type'),
      date: fd.get('date'),
      startTime: fd.get('startTime'),
      endTime: fd.get('endTime') || '',
      location: fd.get('location') || '',
      opponentId: fd.get('opponentId') || null
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
