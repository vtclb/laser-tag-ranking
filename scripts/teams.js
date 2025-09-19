import { saveLobbyState } from './state.js?v=2025-09-19-3';
import { lobby } from './lobby.js?v=2025-09-19-3';

export let teams = {};

export function initTeams(n, data) {
  const area = document.getElementById('teams-area');
  area.innerHTML = '';
  area.classList.remove('hidden');
  teams = {};
  for (let i=1;i<=n;i++){
    const arr = data[i]||[];
    teams[i] = arr;
    const sum = arr.reduce((s,p)=>s+p.pts,0);
    const div = document.createElement('div');
    div.className = `card team-box team-${i}`;
    div.innerHTML = `
      <label>
        <input type="checkbox" class="team-select" data-team="${i}">
        Команда ${i} (∑ ${sum})
      </label>
      <ul>${arr.map(p=>`<li class="rank-${p.rank}">${p.nick} (${p.pts})</li>`).join('')}</ul>
    `;
    area.append(div);
  }
  saveLobbyState({lobby, teams, manualCount: n});
}
