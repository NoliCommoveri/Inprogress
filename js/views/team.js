// team.js — landing dashboard: season record, next game/practice, hygiene.
import { getSettings, getOpponentById, updateEvent, updateFundraiser, subscribe }
  from '../data.js';
import {
  getTeamRecord, getNextEventOfType, getStaleEvents, getStaleFundraisers
} from '../selectors.js';
import { escapeHtml } from '../util.js';

function fmtDate(d) {
  return new Date(d + 'T00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(e) {
  return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

export function mount(container) {
  container.innerHTML = `
    <h2 id="team-heading" class="team-heading">Team</h2>
    <p id="team-season" class="team-season"></p>
    <div class="dashboard-cards">
      <section class="record-card">
        <h3>Record</h3>
        <p id="record-line" class="big-stat">—</p>
      </section>
      <section class="next-game-card">
        <h3>Next Game</h3>
        <div id="next-game"></div>
      </section>
      <section class="next-practice-card">
        <h3>Next Practice</h3>
        <div id="next-practice"></div>
      </section>
    </div>
    <section id="needs-attention" class="needs-attention" hidden>
      <h3>⚠️ Needs Attention</h3>
      <div id="attention-body"></div>
    </section>
  `;

  const heading  = container.querySelector('#team-heading');
  const seasonEl = container.querySelector('#team-season');
  const recordEl = container.querySelector('#record-line');
  const gameEl   = container.querySelector('#next-game');
  const practEl  = container.querySelector('#next-practice');
  const attnCard = container.querySelector('#needs-attention');
  const attnBody = container.querySelector('#attention-body');

  function render() {
    const s = getSettings();
    heading.textContent = s.teamName || 'Team';
    seasonEl.textContent = s.season ? `Season - ${s.season}` : '';

    const { wins, losses, ties } = getTeamRecord();
    recordEl.textContent = ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;

    const g = getNextEventOfType('game');
    if (!g) {
      gameEl.innerHTML = `<p class="muted">No upcoming games.</p>`;
    } else {
      const opp = g.opponentId ? getOpponentById(g.opponentId) : null;
      const oppName = opp ? escapeHtml(opp.name) : 'TBD';
      const loc = g.location || (opp && opp.homeLocation) || '';
      gameEl.innerHTML = `
        <p class="vs-line">vs <strong>${oppName}</strong></p>
        <p class="when-line">${fmtDate(g.date)} · ${fmtTime(g)}</p>
        ${loc ? `<p class="loc-line">${escapeHtml(loc)}</p>` : ''}
      `;
    }

    const pr = getNextEventOfType('practice');
    if (!pr) {
      practEl.innerHTML = `<p class="muted">No upcoming practices.</p>`;
    } else {
      practEl.innerHTML = `
        <p class="when-line"><strong>${fmtDate(pr.date)}</strong> · ${fmtTime(pr)}</p>
        ${pr.location ? `<p class="loc-line">${escapeHtml(pr.location)}</p>` : ''}
      `;
    }

    renderNeedsAttention();
  }

  function renderNeedsAttention() {
    const staleEvents = getStaleEvents();
    const staleFundraisers = getStaleFundraisers();
    if (!staleEvents.length && !staleFundraisers.length) {
      attnCard.hidden = true;
      attnBody.innerHTML = '';
      return;
    }
    attnCard.hidden = false;

    const eventRows = staleEvents.map(e => {
      const opp = e.opponentId ? getOpponentById(e.opponentId) : null;
      const label = e.type === 'game'
        ? `Game${opp ? ` vs ${escapeHtml(opp.name)}` : ''}`
        : 'Practice';
      return `
        <div class="attn-row" data-kind="event" data-id="${e.id}" data-type="${e.type}">
          <span>${fmtDate(e.date)} · ${label} — still marked scheduled.</span>
          ${e.type === 'game'
            ? `<button class="attn-result-btn">Enter result</button>` : ''}
          <button class="attn-complete-btn">Mark completed</button>
          <button class="attn-cancel-btn">Mark canceled</button>
        </div>`;
    }).join('');

    const fundRows = staleFundraisers.map(f => `
      <div class="attn-row" data-kind="fundraiser" data-id="${f.id}">
        <span>Fundraiser "${escapeHtml(f.name)}" has ended but is still ${escapeHtml(f.status)}.</span>
        <button class="attn-fund-complete-btn">Mark completed</button>
        <button class="attn-fund-cancel-btn">Mark canceled</button>
      </div>`).join('');

    attnBody.innerHTML = eventRows + fundRows;
  }

  attnBody.addEventListener('click', (e) => {
    const row = e.target.closest('.attn-row');
    if (!row) return;
    const id = row.dataset.id;

    if (row.dataset.kind === 'event') {
      if (e.target.classList.contains('attn-complete-btn'))
        updateEvent(id, { status: 'completed' });
      if (e.target.classList.contains('attn-cancel-btn'))
        updateEvent(id, { status: 'canceled' });
      if (e.target.classList.contains('attn-result-btn')) {
        updateEvent(id, { status: 'completed' });
        window.location.hash = '#/schedule';
      }
    }

    if (row.dataset.kind === 'fundraiser') {
      if (e.target.classList.contains('attn-fund-complete-btn'))
        updateFundraiser(id, { status: 'completed' });
      if (e.target.classList.contains('attn-fund-cancel-btn'))
        updateFundraiser(id, { status: 'canceled' });
    }
  });

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
