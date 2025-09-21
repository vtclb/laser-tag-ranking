import {
  state,
  setTeamsCount,
  setTeams,
  getTeamKey,
  getTeamMembers,
} from './state.js?v=2025-09-19-avatars-2';

export const teams = state.teams;

export function initTeams(n, data = {}) {
  const area = document.getElementById('teams-area');
  if (!area) return;

  area.innerHTML = '';
  if (n <= 0) {
    area.classList.add('hidden');
    setTeamsCount(0);
    setTeams({});
    return;
  }

  area.classList.remove('hidden');

  const count = setTeamsCount(n);
  setTeams(data);

  for (let i = 1; i <= count; i++) {
    const key = getTeamKey(i);
    const members = getTeamMembers(key);
    const sum = members.reduce((s, p) => s + (Number(p.pts) || 0), 0);
    const div = document.createElement('div');
    div.className = `card team-box team-${i}`;
    div.innerHTML = `
      <label>
        <input type="checkbox" class="team-select" data-team="${i}">
        Команда ${i} (∑ ${sum})
      </label>
      <ul>${members.map(p => `<li class="rank-${p.rank}">${p.nick} (${p.pts})</li>`).join('')}</ul>
    `;
    area.append(div);
  }
}
