// settings.js — team name/season. Stage 6 adds backup/restore UI here;
// Stage 8 adds the range-export panel.
import { getSettings, updateSettings, subscribe } from '../data.js';

export function mount(container) {
  container.innerHTML = `
    <h2>Settings</h2>
    <section>
      <label>Team name: <input id="team-name" /></label><br/>
      <label>Season: <input id="season" /></label>
    </section>
  `;
  const teamInput = container.querySelector('#team-name');
  const seasonInput = container.querySelector('#season');

  function render() {
    const s = getSettings();
    if (document.activeElement !== teamInput) teamInput.value = s.teamName;
    if (document.activeElement !== seasonInput) seasonInput.value = s.season;
  }

  teamInput.addEventListener('change', () => updateSettings({ teamName: teamInput.value }));
  seasonInput.addEventListener('change', () => updateSettings({ season: seasonInput.value }));

  const unsub = subscribe(render);
  render();
  return () => unsub();
}
