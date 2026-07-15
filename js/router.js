// router.js — hash-based view switching (#/roster, #/schedule, ...).
const routes = {
  '#/team':        () => import('./views/team.js'),
  '#/schedule':    () => import('./views/schedule.js'),
  '#/roster':      () => import('./views/roster.js'),
  '#/parents':     () => import('./views/parents.js'),
  '#/communications': () => import('./views/communications.js'),
  '#/snacks':      () => import('./views/snacks.js'),
  '#/fundraisers': () => import('./views/fundraisers.js'),
  '#/settings':    () => import('./views/settings.js'),
};
const DEFAULT_ROUTE = '#/team';

let currentUnmount = null;

export function initRouter(outletEl, navEl) {
  window.addEventListener('hashchange', () => renderRoute(outletEl, navEl));
  renderRoute(outletEl, navEl);
}

async function renderRoute(outletEl, navEl) {
  const hash = window.location.hash;
  if (!routes[hash]) {
    window.location.hash = DEFAULT_ROUTE;   // triggers hashchange -> re-entry
    return;
  }
  if (currentUnmount) { currentUnmount(); currentUnmount = null; }
  outletEl.innerHTML = '';
  highlightNav(navEl, hash);
  const mod = await routes[hash]();
  currentUnmount = mod.mount(outletEl) || null;
}

function highlightNav(navEl, hash) {
  navEl.querySelectorAll('a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
}
