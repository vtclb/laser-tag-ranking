// scripts/tournamentView.js
import { fetchTournamentData, fetchTournaments } from './api.js?v=2025-09-19-balance-hotfix-1';

const MODE_LABELS = { TR: 'TR', DM: 'DM', KT: 'KT' };
const MODE_ORDER = ['TR', 'DM', 'KT'];

function qs(id) {
  return document.getElementById(id);
}

function normalizeMode(raw) {
  const value = String(raw || '').toUpperCase();
  if (value === 'TEAM RANKING') return 'TR';
  if (value === 'DEATHMATCH' || value === 'DM') return 'DM';
  if (value === 'KING OF THE HILL' || value === 'KT' || value === 'KOTH') return 'KT';
  return value || 'TR';
}

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatRecordDate(start, end) {
  if (!start && !end) return '';
  if (start && end) return `${start} — ${end}`;
  return start || end || '';
}

function boolVal(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function setTitle(text) {
  const el = qs('tournament-title');
  if (el) el.textContent = text;
}

function setMeta(text) {
  const el = qs('tournament-meta');
  if (el) el.textContent = text;
}

function toggleSections(hasId) {
  document.querySelectorAll('[data-requires-id="true"]').forEach(node => {
    node.classList.toggle('hidden', !hasId);
  });
  const selector = qs('tournament-selector');
  selector?.classList.toggle('hidden', hasId);
  const backBtn = qs('back-to-selector');
  backBtn?.classList.toggle('hidden', !hasId);
}

function renderStats({ teams = [], games = [], info = {} }) {
  const container = qs('tournament-stats');
  if (!container) return;
  container.innerHTML = '';

  const totalTeams = teams.length;
  const totalGames = games.length;
  const playedGames = games.filter(g => boolVal(g.isDraw) || g.winnerTeamId).length;

  const stats = [
    { label: 'Назва турніру', value: info.name || info.tournamentId || '—' },
    { label: 'Ліга', value: info.league || '—' },
    { label: 'Дати', value: formatRecordDate(info.dateStart, info.dateEnd) || '—' },
    { label: 'Статус', value: info.status || '—' },
    { label: 'Кількість команд', value: totalTeams },
    { label: 'Матчі зіграно / всього', value: `${playedGames} / ${totalGames}` },
  ];

  stats.forEach(item => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const label = document.createElement('p');
    label.className = 'stat-label';
    label.textContent = item.label;
    const value = document.createElement('p');
    value.className = 'stat-value';
    value.textContent = item.value;
    card.append(label, value);
    container.appendChild(card);
  });
}

function computeTeams(teams = []) {
  return [...teams]
    .map(team => {
      const wins = parseNumber(team.wins);
      const draws = parseNumber(team.draws);
      const losses = parseNumber(team.losses);
      const points = team.points != null ? parseNumber(team.points) : wins * 3 + draws;
      const mmrCurrent = parseNumber(team.mmrCurrent || team.avgPts || team.teamStrengthIndex);
      return {
        ...team,
        wins,
        draws,
        losses,
        points,
        mmrCurrent,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.mmrCurrent - a.mmrCurrent;
    })
    .map((team, index) => ({ ...team, place: index + 1 }));
}

function renderTeams(teams = []) {
  const tbody = qs('teams-table')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const sorted = computeTeams(teams);
  sorted.forEach(team => {
    const tr = document.createElement('tr');
    const values = [
      team.teamName || team.teamId,
      team.wins,
      team.losses,
      team.draws,
      team.points,
      team.mmrCurrent.toFixed(1),
      team.place,
    ];
    values.forEach(val => {
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

  const sorted = [...players]
    .map(p => ({
      ...p,
      games: parseNumber(p.games),
      wins: parseNumber(p.wins),
      losses: parseNumber(p.losses),
      draws: parseNumber(p.draws),
      mvpCount: parseNumber(p.mvpCount),
      secondCount: parseNumber(p.secondCount),
      thirdCount: parseNumber(p.thirdCount),
      impactPoints: parseNumber(p.impactPoints),
      mmrChange: parseNumber(p.mmrChange),
    }))
    .sort((a, b) => {
      if (b.impactPoints !== a.impactPoints) return b.impactPoints - a.impactPoints;
      if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount;
      return b.games - a.games;
    });

  sorted.forEach(p => {
    const tr = document.createElement('tr');
    const values = [
      p.playerNick,
      teamNames[p.teamId] || p.teamId || '—',
      p.games,
      p.wins,
      p.losses,
      p.draws,
      p.mvpCount,
      p.secondCount,
      p.thirdCount,
      p.impactPoints,
      `${p.mmrChange > 0 ? '+' : ''}${p.mmrChange}`,
    ];
    values.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function describeWinner(game, teamNames) {
  if (boolVal(game.isDraw)) return 'Нічия';
  if (game.winnerTeamId) return `Переможець: ${teamNames[game.winnerTeamId] || game.winnerTeamId}`;
  return 'Матч не зіграно';
}

function renderGames(games = [], teams = []) {
  const container = qs('matches-container');
  if (!container) return;
  container.innerHTML = '';

  if (!games.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Матчі відсутні';
    container.appendChild(empty);
    return;
  }

  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  const byMode = games.reduce((acc, game) => {
    const mode = normalizeMode(game.mode);
    acc[mode] = acc[mode] || [];
    acc[mode].push(game);
    return acc;
  }, {});

  MODE_ORDER.forEach(mode => {
    const modeGames = byMode[mode] || [];
    if (!modeGames.length) return;
    const section = document.createElement('div');
    section.className = 'match-section';
    const header = document.createElement('h3');
    header.className = 'section-title';
    header.innerHTML = `${MODE_LABELS[mode] || mode} <span class="badge mode-${mode.toLowerCase()}">${mode}</span>`;
    section.appendChild(header);

    const sorted = [...modeGames].sort((a, b) => {
      const tsA = new Date(a.timestamp || a.updatedAt || 0).getTime();
      const tsB = new Date(b.timestamp || b.updatedAt || 0).getTime();
      return tsB - tsA;
    });

    sorted.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = 'match-card';
      const matchTitle = document.createElement('p');
      matchTitle.className = 'match-title';
      const nameA = teamNames[g.teamAId] || g.teamAId || '—';
      const nameB = teamNames[g.teamBId] || g.teamBId || '—';
      matchTitle.textContent = `#${idx + 1}  ${nameA} vs ${nameB}`;

      const modeLine = document.createElement('p');
      modeLine.className = 'match-meta';
      modeLine.textContent = `Режим: ${MODE_LABELS[mode] || mode}`;

      const winnerLine = document.createElement('div');
      winnerLine.className = 'result-line';
      winnerLine.innerHTML = `<strong>Результат:</strong> ${describeWinner(g, teamNames)}`;

      const awards = [
        g.mvpNick ? `MVP: ${g.mvpNick}` : '',
        g.secondNick ? `2 місце: ${g.secondNick}` : '',
        g.thirdNick ? `3 місце: ${g.thirdNick}` : '',
      ].filter(Boolean).join(' · ');
      const awardsLine = awards ? document.createElement('div') : null;
      if (awardsLine) {
        awardsLine.className = 'result-line';
        awardsLine.innerHTML = `<strong>Нагороди:</strong> ${awards}`;
      }

      const mmrA = parseNumber(g.teamAMmrDelta);
      const mmrB = parseNumber(g.teamBMmrDelta);
      const mmrLine = document.createElement('div');
      mmrLine.className = 'result-line';
      mmrLine.innerHTML = `<strong>MMR:</strong> <span class="mmr-diff ${mmrA < 0 ? 'mmr-negative' : ''}">${mmrA > 0 ? '+' : ''}${mmrA}</span> / <span class="mmr-diff ${mmrB < 0 ? 'mmr-negative' : ''}">${mmrB > 0 ? '+' : ''}${mmrB}</span>`;

      const dateLine = document.createElement('p');
      dateLine.className = 'match-meta';
      const ts = g.timestamp || g.updatedAt || '';
      dateLine.textContent = ts ? `Дата: ${ts}` : '';

      card.append(matchTitle, modeLine, winnerLine);
      if (awardsLine) card.appendChild(awardsLine);
      card.append(mmrLine, dateLine);
      section.appendChild(card);
    });

    container.appendChild(section);
  });
}

function renderTournament(data) {
  const info = data.tournament || {};
  const teams = Array.isArray(data.teams) ? data.teams : [];
  const players = Array.isArray(data.players) ? data.players : [];
  const games = Array.isArray(data.games) ? data.games : [];

  setTitle(info.name || info.tournamentId || 'Турнір');
  const metaParts = [
    info.league ? `Ліга: ${info.league}` : '',
    formatRecordDate(info.dateStart, info.dateEnd),
    info.status ? `Статус: ${info.status}` : '',
  ].filter(Boolean);
  setMeta(metaParts.join(' · '));

  renderStats({ teams, games, info });
  renderTeams(teams);
  renderPlayers(players, teams);
  renderGames(games, teams);
}

async function loadTournament(tournamentId) {
  const hasId = Boolean(tournamentId);
  toggleSections(hasId);
  if (!hasId) return showSelector();

  try {
    setTitle('Завантаження турніру...');
    setMeta('');
    const data = await fetchTournamentData(tournamentId);
    renderTournament(data || {});
  } catch (err) {
    console.error(err);
    setTitle('Помилка завантаження турніру');
    setMeta(err?.message || 'Спробуйте оновити сторінку');
  }
}

async function showSelector() {
  toggleSections(false);
  const listEl = qs('tournament-list');
  const emptyEl = qs('tournaments-empty');
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';
  emptyEl.classList.add('hidden');
  const stats = qs('tournament-stats');
  if (stats) stats.innerHTML = '';
  setTitle('Оберіть турнір');
  setMeta('Завантажте наявні турніри, щоб переглянути результати');

  try {
    const tournaments = await fetchTournaments();
    if (!tournaments.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    tournaments.forEach(t => {
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.className = 't-info';
      const name = document.createElement('div');
      name.className = 't-name';
      name.textContent = t.name || t.tournamentId;
      const meta = document.createElement('div');
      meta.className = 't-meta';
      const parts = [t.league, formatRecordDate(t.dateStart, t.dateEnd)].filter(Boolean);
      meta.textContent = parts.join(' • ');
      info.append(name, meta);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Відкрити';
      btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('id', t.tournamentId);
        window.history.replaceState({}, '', url.toString());
        loadTournament(t.tournamentId);
      });

      li.append(info, btn);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    emptyEl.textContent = 'Не вдалося завантажити список турнірів';
    emptyEl.classList.remove('hidden');
  }
}

function initTournamentView() {
  const refreshBtn = qs('refresh-tournament');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadTournament(getTournamentIdFromUrl()));
  }
  const backBtn = qs('back-to-selector');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
      showSelector();
    });
  }

  loadTournament(getTournamentIdFromUrl());
}

window.addEventListener('DOMContentLoaded', initTournamentView);
