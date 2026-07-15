// schedule.js — unified games + practices, shared list/calendar.
import {
  getEvents, addEvent, updateEvent, deleteEvent,
  getOpponents, addOpponent, getOpponentById,
  subscribe
} from '../data.js';
import { escapeHtml } from '../util.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Schedule</h2>
    <div class="table-scroll">
      <table class="schedule-table">
        <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Opponent</th>
          <th>Location</th><th>Status</th><th>Score</th><th></th></tr></thead>
        <tbody id="schedule-body"></tbody>
      </table>
    </div>
    <h3>Add Event</h3>
    <form id="add-event-form">
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
  `;

  const tbody = container.querySelector('#schedule-body');
  const form = container.querySelector('#add-event-form');
  const oppSelect = container.querySelector('#opponent-select');

  function renderOpponentOptions(select, selectedId = '') {
    const opts = getOpponents().map(o =>
      `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('');
    select.innerHTML = `<option value="">— No opponent —</option>${opts}`;
  }

  function render() {
    renderOpponentOptions(oppSelect);
    const events = [...getEvents()].sort((a, b) =>
      a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

    tbody.innerHTML = events.map(e => {
      const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
      const isGame = e.type === 'game';
      return `
        <tr data-id="${e.id}">
          <td><input type="date" class="f-date" value="${e.date}" /></td>
          <td>
            <input type="time" class="f-start" value="${e.startTime}" />
            <input type="time" class="f-end" value="${e.endTime || ''}" />
          </td>
          <td>
            <select class="f-type">
              <option value="practice" ${!isGame ? 'selected' : ''}>Practice</option>
              <option value="game" ${isGame ? 'selected' : ''}>Game</option>
            </select>
          </td>
          <td>${isGame ? `<select class="f-opponent">
              <option value="">— No opponent —</option>${
                getOpponents().map(o => `<option value="${o.id}" ${o.id === e.opponentId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')
              }</select>` : ''}</td>
          <td><input class="f-location" value="${escapeHtml(e.location)}"
                placeholder="${opp ? escapeHtml(opp.homeLocation || '') : ''}" /></td>
          <td>
            <select class="f-status">
              <option value="scheduled" ${e.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="canceled" ${e.status === 'canceled' ? 'selected' : ''}>Canceled</option>
              <option value="completed" ${e.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </td>
          <td>${isGame && e.status === 'completed' ? `
            <input type="number" class="f-score-us" value="${e.finalScoreUs ?? ''}" size="2" /> -
            <input type="number" class="f-score-opp" value="${e.finalScoreOpponent ?? ''}" size="2" />
          ` : ''}</td>
          <td><button class="delete-btn">Delete</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="8">No events yet.</td></tr>';
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    if (e.target.classList.contains('delete-btn')) {
      if (confirm('Delete this event? Removes its snack assignments too.')) deleteEvent(row.dataset.id);
    }
  });

  tbody.addEventListener('change', (e) => {
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
  });

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
