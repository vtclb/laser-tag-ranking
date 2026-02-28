import { state, getParticipants } from './state.js';
import { movePlayerToTeam } from './manual.js';

function sumByNicks(nicks) {
  const map = new Map(state.players.map((p) => [p.nick, p]));
  return nicks.reduce((acc, n) => acc + (map.get(n)?.pts || 0), 0);
}

export function render() {
  renderPlayers();
  renderLobby();
  renderTeams();
  renderWinnerOptions();
  renderPenalties();
  renderMatchDatalist();
}

export function setActiveTab(tab) {
  document.getElementById('teamsCard').style.display = tab === 'teams' ? '' : 'none';
  document.getElementById('matchCard').style.display = tab === 'match' ? '' : 'none';
}

function renderPlayers() {
  const list = document.getElementById('playerList');
  const count = document.getElementById('playersCount');
  if (!list || !count) return;
  const q = state.query.toLowerCase().trim();
  const players = q ? state.players.filter((p) => p.nick.toLowerCase().includes(q)) : state.players;
  count.textContent = `Players: ${players.length}`;
  const frag = document.createDocumentFragment();
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `<span>${p.nick} <small class="tag">${p.pts}</small></span><button class="chip" data-add="${p.nick}">+ Lobby</button>`;
    frag.appendChild(row);
  }
  list.replaceChildren(frag);
}

function renderLobby() {
  const wrap = document.getElementById('lobbyList');
  if (!wrap) return;
  const frag = document.createDocumentFragment();
  for (const nick of state.selected) {
    const row = document.createElement('div');
    row.className = 'lobby-row';
    row.innerHTML = `<span>${nick}</span><button class="chip" data-remove="${nick}">Remove</button>`;
    frag.appendChild(row);
  }
  wrap.replaceChildren(frag);
}

function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  const frag = document.createDocumentFragment();
  for (const key of keys) {
    const nicks = state.teams[key];
    const card = document.createElement('div');
    card.className = 'team-card';
    const players = nicks.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions"><button class="chip" data-move="${nick}:bench">Bench</button></div></div>`).join('');
    card.innerHTML = `<h4>${key.toUpperCase()} · Σ ${sumByNicks(nicks)}</h4>${players || '<div class="tag">empty</div>'}`;
    frag.appendChild(card);
  }

  if (state.mode === 'manual') {
    const bench = state.selected.filter((nick) => !keys.some((k) => state.teams[k].includes(nick)));
    const benchCard = document.createElement('div');
    benchCard.className = 'team-card';
    benchCard.innerHTML = `<h4>Bench</h4>${bench.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions">${keys.map((k) => `<button class="chip" data-move="${nick}:${k}">${k}</button>`).join('')}</div></div>`).join('') || '<div class="tag">empty</div>'}`;
    frag.appendChild(benchCard);
  }

  grid.replaceChildren(frag);
}

function renderWinnerOptions() {
  const root = document.getElementById('winnerOptions');
  if (!root) return;
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  const btns = keys.map((k) => `<button class="chip ${state.match.winner === k ? 'active' : ''}" data-winner="${k}">${k.toUpperCase()} win</button>`);
  btns.push(`<button class="chip ${state.match.winner === 'tie' ? 'active' : ''}" data-winner="tie">Draw</button>`);
  root.innerHTML = btns.join('');
}

function renderPenalties() {
  const root = document.getElementById('penaltiesList');
  if (!root) return;
  const participants = getParticipants();
  root.innerHTML = participants.map((nick) => {
    const val = Number(state.match.penalties[nick] || 0);
    return `<div class="penalty-row"><span>${nick}</span><div class="penalty-controls"><button class="chip" data-pen="${nick}:-1">-</button><strong>${val}</strong><button class="chip" data-pen="${nick}:1">+</button></div></div>`;
  }).join('');
}

function renderMatchDatalist() {
  const dl = document.getElementById('participantsDatalist');
  if (!dl) return;
  const participants = [...new Set(getParticipants())];
  dl.innerHTML = participants.map((nick) => `<option value="${nick}"></option>`).join('');
}

export function bindUiEvents(handlers) {
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]')?.dataset.add;
    const remove = e.target.closest('[data-remove]')?.dataset.remove;
    const move = e.target.closest('[data-move]')?.dataset.move;
    const winner = e.target.closest('[data-winner]')?.dataset.winner;
    const pen = e.target.closest('[data-pen]')?.dataset.pen;
    if (add) handlers.onAdd(add);
    if (remove) handlers.onRemove(remove);
    if (move) {
      const [nick, team] = move.split(':');
      movePlayerToTeam(nick, team === 'bench' ? '' : team);
      handlers.onChanged();
    }
    if (winner) handlers.onWinner(winner);
    if (pen) {
      const [nick, delta] = pen.split(':');
      handlers.onPenalty(nick, Number(delta));
    }
  });
}
