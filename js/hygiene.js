// hygiene.js — app-wide banner for stale events/fundraisers, modeled on nudge.js.
import { subscribe } from './data.js';
import { getStaleEvents, getStaleFundraisers } from './selectors.js';

export function initHygieneBanner(bannerEl) {
  let dismissed = false; // session-only; resets on reload

  function render() {
    const n = getStaleEvents().length + getStaleFundraisers().length;

    if (n === 0 || dismissed) {
      bannerEl.hidden = true;
      return;
    }
    bannerEl.hidden = false;
    bannerEl.innerHTML =
      `📝 ${n} item${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a status update ` +
      `(past-dated but still scheduled/active). ` +
      `Review on the <a href="#/team">Team page</a>. ` +
      `<button id="hygiene-dismiss">Dismiss</button>`;
    bannerEl.querySelector('#hygiene-dismiss').addEventListener('click', () => {
      dismissed = true;
      render();
    });
  }

  subscribe(render);
  render();
}
