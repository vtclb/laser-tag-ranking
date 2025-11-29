// scripts/tournamentView.js
import { fetchTournamentData } from './api.js?v=2025-09-19-balance-hotfix-1';

function qs(id) {
  return document.getElementById(id);
}

function formatRecordDate(start, end) {
  if (!start && !end) return '';
  if (start && end) return `${start} — ${end}`;
  return start || end || '';
}

function renderTeams(teams = []) {
  const tbody = qs('teams-table')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  teams.forEach(team => {
    const tr = document.createElement('tr');
    const record = [
      team.teamName || team.teamId,
      String(team.players || ''),
      `${team.wins || 0}-${team.losses || 0}-${team.draws || 0}`,
      team.points || 0,
      team.mmrCurrent || team.mmrStart || 0,
      team.rank || '',
    ];
    record.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderPlayers(players = [], teams = []) {
  const tbody = qs('players-table')?.querySelector('tbody');
  if (!tbody) return;
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  tbody.innerHTML = '';
  players.forEach(p => {
    const tr = document.createElement('tr');
    const cells = [
      p.playerNick,
      teamNames[p.teamId] || p.teamId,
      p.games || 0,
      `${p.wins || 0}-${p.losses || 0}-${p.draws || 0}`,
      p.mvpCount || 0,
      p.secondCount || 0,
      p.thirdCount || 0,
      p.impactPoints || 0,
    ];
    cells.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderGames(games = [], teams = []) {
  const tbody = qs('games-table')?.querySelector('tbody');
  if (!tbody) return;
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  tbody.innerHTML = '';
  games.forEach(g => {
    const tr = document.createElement('tr');
    const match = `${teamNames[g.teamAId] || g.teamAId} vs ${teamNames[g.teamBId] || g.teamBId}`;
    const status = g.isDraw === 'TRUE'
      ? 'Нічия'
      : (g.winnerTeamId ? `Переможець: ${teamNames[g.winnerTeamId] || g.winnerTeamId}` : 'Не зіграно');
    const awards = [g.mvpNick, g.secondNick, g.thirdNick].filter(Boolean).join(' / ');
    [g.mode, match, status, awards || '—'].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function loadTournament() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    qs('tournament-title').textContent = 'Турнір не вказано';
    return;
  }
  try {
    const data = await fetchTournamentData(id);
    const info = data.tournament || {};
    qs('tournament-title').textContent = info.name || info.tournamentId || 'Турнір';
    const metaParts = [
      info.league ? `Ліга: ${info.league}` : '',
      formatRecordDate(info.dateStart, info.dateEnd),
      info.status ? `Статус: ${info.status}` : '',
    ];
    qs('tournament-meta').textContent = metaParts.filter(Boolean).join(' · ');
    renderTeams(data.teams || []);
    renderPlayers(data.players || [], data.teams || []);
    renderGames(data.games || [], data.teams || []);
  } catch (err) {
    console.error(err);
    qs('tournament-title').textContent = 'Помилка завантаження турніру';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = qs('refresh-tournament');
  if (refreshBtn) refreshBtn.addEventListener('click', loadTournament);
  loadTournament();
});
