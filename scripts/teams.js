import { state, setTeamsCount, setTeams, saveLobbyState } from './state.js?v=2025-09-19-avatars-2';

export const teams = state.teams;

export function initTeams(n, data = {}) {
  const area = document.getElementById('teams-area');
  if (!area) return;

  area.innerHTML = '';
  area.classList.remove('hidden');

  setTeamsCount(n);
  setTeams({});

  for (let i = 1; i <= state.teamsCount; i++) {
    const arr = Array.isArray(data?.[i]) ? [...data[i]] : [];
    state.teams[i] = arr;
    const sum = arr.reduce((s, p) => s + (Number(p.pts) || 0), 0);
    const div = document.createElement('div');
    div.className = `card team-box team-${i}`;
    div.innerHTML = `
      <label>
        <input type="checkbox" class="team-select" data-team="${i}">
        Команда ${i} (∑ ${sum})
      </label>
      <ul>${arr.map(p => `<li class="rank-${p.rank}">${p.nick} (${p.pts})</li>`).join('')}</ul>
    `;
    area.append(div);
  }

  saveLobbyState();
}
