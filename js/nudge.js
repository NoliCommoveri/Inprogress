// nudge.js — app-wide backup nudge banner.
import { backupNudgeDue, subscribe } from './data.js';

export function initNudgeBanner(bannerEl) {
  function render() {
    if (backupNudgeDue()) {
      bannerEl.hidden = false;
      bannerEl.innerHTML = `⚠️ You have unsaved changes since your last backup. ` +
        `Go to <a href="#/settings">Settings</a> to export a backup.`;
    } else {
      bannerEl.hidden = true;
    }
  }
  subscribe(render);
  render();
}
