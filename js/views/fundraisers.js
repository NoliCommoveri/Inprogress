// fundraisers.js — fundraisers + occurrences, progress bar.
import {
  getFundraisers, addFundraiser, updateFundraiser, deleteFundraiser,
  getFundraiserOccurrencesForFundraiser, addFundraiserOccurrence,
  updateFundraiserOccurrence, deleteFundraiserOccurrence,
  getFundraiserPlatforms, addFundraiserPlatform,
  subscribe
} from '../data.js';
import { escapeHtml, dollarsToCents } from '../util.js';
import { todayStr } from '../selectors.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Fundraisers</h2>
    <div id="fundraisers-list"></div>
    <h3>Add Fundraiser</h3>
    <form id="add-fundraiser-form">
      <input name="name" placeholder="Name" required />
      <select name="kind">
        <option value="uniforms">Uniforms</option>
        <option value="team_trip">Team Trip</option>
        <option value="general">General</option>
      </select>
      <select name="platformId" id="platform-select"><option value="">— In person —</option></select>
      <button type="button" id="new-platform-btn">+ New platform</button>
      <input name="goalAmount" type="number" step="0.01" placeholder="Goal $" />
      <button type="submit">Add Fundraiser</button>
    </form>
    <section class="fundraiser-group">
      <h3>Completed</h3>
      <div id="fundraisers-completed"></div>
    </section>
  `;

  const list = container.querySelector('#fundraisers-list');
  const completedList = container.querySelector('#fundraisers-completed');
  const form = container.querySelector('#add-fundraiser-form');
  const platformSelect = container.querySelector('#platform-select');
  const expandedCompleted = new Set();
  const editingIds = new Set();

  function renderPlatformOptions(select, selectedId = '') {
    const opts = getFundraiserPlatforms().map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    select.innerHTML = `<option value="">— In person —</option>${opts}`;
  }

  function cardBodyHtml(f) {
    const isEditing = editingIds.has(f.id);
    const pct = f.goalAmountCents > 0
      ? Math.min(100, Math.round(100 * f.raisedAmountCents / f.goalAmountCents)) : 0;
    const occurrences = getFundraiserOccurrencesForFundraiser(f.id);
    const platform = f.platformId
      ? getFundraiserPlatforms().find(p => p.id === f.platformId) : null;

    return `
      ${isEditing
        ? `<input class="f-name" value="${escapeHtml(f.name)}" />`
        : `<strong class="f-name-display">${escapeHtml(f.name)}</strong>`}
      ${isEditing ? `
        <select class="f-status">
          ${['planned', 'active', 'completed', 'canceled'].map(s =>
            `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      ` : `<span class="f-status-display">${f.status}</span>`}
      <span>Platform:
        ${isEditing ? `
          <select class="f-platform">
            <option value="">— In person —</option>${
              getFundraiserPlatforms().map(p => `<option value="${p.id}" ${p.id === f.platformId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')
            }</select>
        ` : `<span class="f-platform-display">${platform ? escapeHtml(platform.name) : 'In person'}</span>`}
      </span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      Raised $<input class="f-raised" type="number" step="0.01" value="${(f.raisedAmountCents / 100).toFixed(2)}" size="8" />
      / Goal $${isEditing
        ? `<input class="f-goal" type="number" step="0.01" value="${(f.goalAmountCents / 100).toFixed(2)}" size="8" />`
        : `<span class="f-goal-display">${(f.goalAmountCents / 100).toFixed(2)}</span>`}
      (${pct}%)
      <button class="edit-toggle">${isEditing ? 'Done' : 'Edit'}</button>
      <button class="delete-fundraiser-btn">Delete Fundraiser</button>
      <ul class="occurrence-list">
        ${occurrences.map(o => isEditing ? `
          <li data-occ="${o.id}">
            <input type="date" class="occ-start" value="${o.startDate}" />
            to <input type="date" class="occ-end" value="${o.endDate}" />
            <input class="occ-location" placeholder="Location" value="${escapeHtml(o.location)}" />
            <button class="delete-occ-btn">Remove</button>
          </li>` : `
          <li data-occ="${o.id}">
            <span>${escapeHtml(o.startDate)} to ${escapeHtml(o.endDate)}${o.location ? ` · ${escapeHtml(o.location)}` : ''}</span>
          </li>`).join('')}
      </ul>
      ${isEditing ? `<button class="add-occ-btn">+ Add date/occurrence</button>` : ''}
    `;
  }

  function activeCardHtml(f) {
    return `<div class="fundraiser-card" data-id="${f.id}">${cardBodyHtml(f)}</div>`;
  }

  function completedCardHtml(f) {
    const isExpanded = expandedCompleted.has(f.id);
    const pct = f.goalAmountCents > 0
      ? Math.min(100, Math.round(100 * f.raisedAmountCents / f.goalAmountCents)) : 0;
    const summary = `
      <div class="fundraiser-summary-row">
        <button type="button" class="fundraiser-toggle expand-toggle" aria-expanded="${isExpanded}" title="${isExpanded ? 'Collapse' : 'Expand'}">${isExpanded ? '▾' : '▸'}</button>
        <span class="fundraiser-summary-name">${escapeHtml(f.name)}</span>
        <span class="fundraiser-summary-stats">$${(f.raisedAmountCents / 100).toFixed(2)} / $${(f.goalAmountCents / 100).toFixed(2)} (${pct}%)</span>
      </div>`;
    return `
      <div class="fundraiser-card fundraiser-completed ${isExpanded ? '' : 'fundraiser-collapsed'}" data-id="${f.id}">
        ${summary}
        ${isExpanded ? cardBodyHtml(f) : ''}
      </div>`;
  }

  function render() {
    renderPlatformOptions(platformSelect);
    const fundraisers = getFundraisers();
    const active = fundraisers.filter(f => f.status !== 'completed');
    const completed = fundraisers.filter(f => f.status === 'completed');

    list.innerHTML = active.map(activeCardHtml).join('') || '<p>No fundraisers yet.</p>';
    completedList.innerHTML = completed.map(completedCardHtml).join('') || '<p>No completed fundraisers yet.</p>';
  }

  function onClick(e) {
    const card = e.target.closest('.fundraiser-card');
    if (!card) return;
    const fid = card.dataset.id;
    if (e.target.classList.contains('fundraiser-toggle')) {
      if (expandedCompleted.has(fid)) expandedCompleted.delete(fid); else expandedCompleted.add(fid);
      render();
      return;
    }
    if (e.target.classList.contains('edit-toggle')) {
      if (editingIds.has(fid)) editingIds.delete(fid); else editingIds.add(fid);
      render();
      return;
    }
    if (e.target.classList.contains('delete-fundraiser-btn')) {
      if (confirm('Delete this fundraiser and all its occurrences?')) deleteFundraiser(fid);
    }
    if (e.target.classList.contains('add-occ-btn')) {
      const today = todayStr();
      addFundraiserOccurrence({ fundraiserId: fid, startDate: today, endDate: today });
    }
    if (e.target.classList.contains('delete-occ-btn')) {
      deleteFundraiserOccurrence(e.target.closest('li').dataset.occ);
    }
  }

  function onChange(e) {
    const card = e.target.closest('.fundraiser-card');
    if (!card) return;
    const fid = card.dataset.id;
    if (e.target.classList.contains('f-name')) updateFundraiser(fid, { name: e.target.value });
    if (e.target.classList.contains('f-status')) updateFundraiser(fid, { status: e.target.value });
    if (e.target.classList.contains('f-platform')) updateFundraiser(fid, { platformId: e.target.value || null });
    if (e.target.classList.contains('f-raised')) updateFundraiser(fid, { raisedAmountCents: dollarsToCents(e.target.value) });
    if (e.target.classList.contains('f-goal')) updateFundraiser(fid, { goalAmountCents: dollarsToCents(e.target.value) });

    const occLi = e.target.closest('li[data-occ]');
    if (occLi) {
      const oid = occLi.dataset.occ;
      if (e.target.classList.contains('occ-start')) updateFundraiserOccurrence(oid, { startDate: e.target.value });
      if (e.target.classList.contains('occ-end')) updateFundraiserOccurrence(oid, { endDate: e.target.value });
      if (e.target.classList.contains('occ-location')) updateFundraiserOccurrence(oid, { location: e.target.value });
    }
  }

  list.addEventListener('click', onClick);
  completedList.addEventListener('click', onClick);
  list.addEventListener('change', onChange);
  completedList.addEventListener('change', onChange);

  container.querySelector('#new-platform-btn').addEventListener('click', () => {
    const name = prompt('Platform name?');
    if (!name) return;
    const url = prompt('URL (optional)?') || '';
    const platform = addFundraiserPlatform({ name, url });
    renderPlatformOptions(platformSelect, platform.id);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    addFundraiser({
      name: fd.get('name').trim(),
      kind: fd.get('kind'),
      platformId: fd.get('platformId') || null,
      goalAmountCents: dollarsToCents(fd.get('goalAmount') || '0'),
      raisedAmountCents: 0,
      status: 'planned'
    });
    form.reset();
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
