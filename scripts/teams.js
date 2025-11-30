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
    div.className = `card team team-${i}`;
    div.dataset.team = key || `team${i}`;

    const header = document.createElement('div');
    header.className = 'team-header';
    const title = document.createElement('span');
    title.textContent = `Команда ${i}`;
    const total = document.createElement('span');
    total.className = 'team-sum';
    total.textContent = `∑ ${sum}`;
    header.append(title, total);

    const list = document.createElement('ul');
    list.className = 'team-list';
    list.dataset.team = key || `team${i}`;
    members.forEach(p => {
      const li = document.createElement('li');
      li.className = `rank-${p.rank || ''}`;
      li.dataset.nick = p.nick;
      li.textContent = `${p.nick} (${p.pts})`;
      list.appendChild(li);
    });

    div.append(header, list);
    area.append(div);
  }
}
