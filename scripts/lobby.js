// scripts/lobby.js
import { log } from './logger.js?v=2025-09-19-avatars-2';

import { initTeams, teams } from './teams.js?v=2025-09-19-avatars-2';
import { sortByName, sortByPtsDesc } from './sortUtils.js?v=2025-09-19-avatars-2';
import {
  updateAbonement,
  adminCreatePlayer,
  issueAccessKey,
  getProfile,
} from './api.js?v=2025-09-19-avatars-2';
import {
  state,
  setLeague,
  setLobbyPlayers,
  setTeamsCount,
  setTeams,
  setPlayers,
  getTeamKey,
  getTeamKeys,
  getTeamNumber,
} from './state.js?v=2025-09-19-avatars-2';
import { refreshArenaTeams } from './scenario.js?v=2025-09-19-avatars-2';
import { renderAllAvatars, reloadAvatars } from './avatars.client.js';
import { recomputeAutoBalance } from './balance.js?v=2025-09-19-avatars-2';

export const lobby = state.lobbyPlayers;
let players = [], filtered = [], selected = [];
const ABONEMENT_TYPES = ['none', 'lite', 'full'];

setLeague(state.league);

async function maybeAutoRebalance() {
  if (state.balanceMode === 'auto') {
    try {
      await recomputeAutoBalance();
    } catch (err) {
      log('[ranking]', err);
    }
  }
}

function updatePlayersDatalist() {
  const dl = document.getElementById('players-datalist');
  if (dl) {
    dl.replaceChildren();
    lobby.forEach(p => {
      const option = document.createElement('option');
      option.value = p.nick;
      dl.appendChild(option);
    });
  }
}

window.addEventListener('storage', e => {
  if (e.key === 'avatarRefresh') reloadAvatars();
});

async function addPlayer(nick){
  if(!nick) return;
  if (lobby.some(p => p.nick === nick)) {
    alert('Гравець вже у лобі');
    return;
  }
  let res = players.find(p => p.nick === nick);
  if (!res) {
    try {
      const data = await getProfile({ nick, league: state.league });
      const profile = data && data.profile;
      if (profile) {
        const pts = Number(profile.points || 0);
        const rank = pts < 200 ? 'D' : pts < 500 ? 'C' : pts < 800 ? 'B' : pts < 1200 ? 'A' : 'S';
        res = { nick, pts, rank, abonement: profile.abonement?.type || 'none' };
        players.push(res);
        filtered.push(res);
      }
    } catch (err) {
      log('[ranking]', err);
    }
  }
  if (!res) {
    alert('Гравця не знайдено');
    return;
  }
  lobby.push({ ...res, team: null });
  renderLobby();
  renderLobbyCards();
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
  renderSelect(filtered);
  await maybeAutoRebalance();
}

// Ініціалізує лоббі новим набором гравців
export async function initLobby(pl, league = state.league) {
  setLeague(league);
  players = Array.isArray(pl) ? [...pl] : [];
  filtered = [...players];
  setPlayers(players);
  setLobbyPlayers([]);
  setTeams({});
  selected = [];
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  if (state.teamsCount > 0) {
    initTeams(state.teamsCount, state.teams);
  }
  renderSelect(filtered);
  renderLobby();
  renderLobbyCards();
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
  await maybeAutoRebalance();
}

export async function updateLobbyState(updates){
  updates.forEach(u=>{
    const norm = {nick:u.nick};
    if(u.points!==undefined) norm.pts = u.points;
    if(u.pts!==undefined)    norm.pts = u.pts;
    if(u.rank!==undefined)   norm.rank = u.rank;

    const pAll = players.find(x=>x.nick===u.nick);
    if(pAll) Object.assign(pAll, norm);
    const pLobby = lobby.find(x=>x.nick===u.nick);
    if(pLobby) Object.assign(pLobby, norm);
    Object.keys(teams).forEach(k=>{
      const tp = teams[k].find(x=>x.nick===u.nick);
      if(tp) Object.assign(tp, norm);
    });
  });
  const teamCount = state.teamsCount;
  if (teamCount > 0) initTeams(teamCount, teams);
  renderLobby();
  renderLobbyCards();
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
  await maybeAutoRebalance();
}

// Рендер списку доступних гравців
function renderSelect(arr) {
  const area = document.getElementById('select-area');
  if (area) area.classList.remove('hidden');
  const list = document.getElementById('player-list');
  if (!list) return;

  list.replaceChildren();
  const taken = new Set();
  lobby.forEach(p => taken.add(p.nick));
  Object.values(teams).forEach(teamArr => {
    teamArr.forEach(p => taken.add(p.nick));
  });

  arr.forEach(p => {
    const label = document.createElement('label');
    label.className = 'player-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.nick = p.nick;
    if (selected.some(sel => sel.nick === p.nick)) checkbox.checked = true;
    if (taken.has(p.nick)) checkbox.disabled = true;

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const nick = document.createElement('strong');
    nick.textContent = p.nick;
    const stats = document.createElement('span');
    stats.textContent = `${p.pts} pts · ${p.rank}`;
    meta.append(nick, stats);

    label.append(checkbox, meta);
    list.appendChild(label);

    checkbox.addEventListener('change', () => {
      const player = players.find(x => x.nick === checkbox.dataset.nick);
      if (!player) return;
      if (checkbox.checked) {
        if (!selected.some(sel => sel.nick === player.nick)) selected.push(player);
      } else {
        selected = selected.filter(sel => sel.nick !== player.nick);
      }
    });
  });
}

// Слухачі кнопок та пошуку
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const term = searchInput.value.trim().toLowerCase();
        filtered = players.filter(p => p.nick.toLowerCase().includes(term));
        selected = selected.filter(sel => filtered.some(p => p.nick === sel.nick));
        renderSelect(filtered);
      }, 300);
    });
  }

  document.getElementById('btn-sort-name').onclick = () => {
    filtered = sortByName(filtered);
    selected = selected.filter(sel => filtered.some(p => p.nick === sel.nick));
    renderSelect(filtered);
  };

  document.getElementById('btn-sort-pts').onclick = () => {
    filtered = sortByPtsDesc(filtered);
    selected = selected.filter(sel => filtered.some(p => p.nick === sel.nick));
    renderSelect(filtered);
  };

  const addToLobbyBtn = document.getElementById('add-to-lobby');
  const legacyAddBtn = document.getElementById('btn-add-selected');
  const handleAddSelected = async () => {
    selected.forEach(p => {
      if (!lobby.some(lp => lp.nick === p.nick)) lobby.push(p);
    });
    selected = [];
    renderLobby();
    renderLobbyCards();
    try {
      await renderAllAvatars(document.getElementById('players') || document);
    } catch (err) {
      log('[ranking]', err);
    }
    renderSelect(filtered);
    await maybeAutoRebalance();
  };
  if (addToLobbyBtn) {
    addToLobbyBtn.addEventListener('click', handleAddSelected);
  }
  if (legacyAddBtn && legacyAddBtn !== addToLobbyBtn) {
    legacyAddBtn.addEventListener('click', () => {
      if (addToLobbyBtn) addToLobbyBtn.click();
      else handleAddSelected();
    });
  }

  document.getElementById('btn-clear-selected').onclick = () => {
    selected = [];
    renderSelect(filtered);
  };

  document.querySelectorAll('[data-teams]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const n = parseInt(btn.dataset.teams, 10);
      if (!Number.isInteger(n)) return;
      const sizeSelect = document.getElementById('teamsize');
      if (sizeSelect) sizeSelect.value = String(n);
      if (state.balanceMode === 'manual') {
        try {
          await setManualCount(n);
        } catch (err) {
          log('[ranking]', err);
        }
      }
    });
  });

  const addPlayerInput = document.getElementById('addPlayerInput');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  if(addPlayerInput && addPlayerBtn){
    addPlayerBtn.addEventListener('click', () => {
      addPlayer(addPlayerInput.value.trim());
    });
  }

  const createBtn = document.getElementById('btn-create');
  const newNick = document.getElementById('new-nick');
  const newAge  = document.getElementById('new-age');
  if (createBtn && newNick && newAge) {
    createBtn.addEventListener('click', async () => {
      const nick = newNick.value.trim();
      if (!nick) return;
      const age = parseInt(newAge.value, 10) || 0;
      try {
        const status = await adminCreatePlayer({ league: state.league, nick, age });
        if (status === 'DUPLICATE') {
          if (typeof showToast === 'function') {
            showToast('Такий нік вже існує');
          } else {
            alert('Такий нік вже існує');
          }
          return;
        }
        if (status === 'OK') {
          const newPlayer = { nick, pts: 0, rank: 'D', abonement: 'none' };
          players.push(newPlayer);
          filtered.push(newPlayer);
          renderSelect(filtered);
          newNick.value = '';
          newAge.value = '';
        } else {
          const msg = 'Не вдалося створити гравця';
          if (typeof showToast === 'function') showToast(msg); else alert(msg);
        }
      } catch (err) {
        log('[ranking]', err);
        const msg = 'Не вдалося створити гравця';
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
      }
    });
  }

  const lobbyContainer = document.getElementById('lobby-area') || document.getElementById('lobby-list');
  if (lobbyContainer) {
    lobbyContainer.addEventListener('click', onLobbyAction);
    lobbyContainer.addEventListener('change', onLobbyAction);
  }
});

// Встановлюємо кількість команд для ручного режиму
export async function setManualCount(n) {
  setTeamsCount(n);
  if (state.teamsCount <= 0) {
    getTeamKeys().forEach(key => {
      const arr = teams[key] || [];
      arr.forEach(player => {
        if (!lobby.some(lp => lp.nick === player.nick)) lobby.push(player);
      });
      teams[key].length = 0;
    });
  } else {
    getTeamKeys().forEach(key => {
      const teamNo = getTeamNumber(key);
      if (Number.isInteger(teamNo) && teamNo > state.teamsCount) {
        const overflow = teams[key] || [];
        overflow.forEach(player => {
          if (!lobby.some(lp => lp.nick === player.nick)) lobby.push(player);
        });
        teams[key].length = 0;
      }
    });
  }
  renderLobby();
  renderLobbyCards();
  renderSelect(filtered);
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
}

export async function clearLobby() {
  lobby.length = 0;
  setTeamsCount(0);
  setTeams({});

  renderLobby();
  renderLobbyCards();
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
  renderTeams();
  updateSummary();
  renderSelect(filtered);
  await maybeAutoRebalance();
}

function renderTeams() {
  const area = document.getElementById('teams-area');
  if (area) area.innerHTML = '';
}

function updateSummary() {
  const total = lobby.reduce((s, p) => s + p.pts, 0);
  const countEl = document.getElementById('lobby-count');
  const sumEl   = document.getElementById('lobby-sum');
  const avgEl   = document.getElementById('lobby-avg');
  if (countEl) countEl.textContent = lobby.length;
  if (sumEl)   sumEl.textContent   = total;
  if (avgEl)   avgEl.textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';
}

function createLobbyEntry(player, index) {
  const entry = document.createElement('div');
  entry.className = 'lobby-player';
  entry.dataset.nick = player.nick;
  entry.dataset.i = index;
  if (state.teamsCount > 0) entry.setAttribute('draggable', 'true');
  else entry.removeAttribute('draggable');

  const main = document.createElement('div');
  main.className = 'lobby-player__main';
  const nickSpan = document.createElement('span');
  nickSpan.className = 'player__nick';
  nickSpan.textContent = player.nick;
  const statsWrap = document.createElement('div');
  statsWrap.className = 'player__stats';
  const ptsSpan = document.createElement('span');
  ptsSpan.className = 'player__pts';
  ptsSpan.textContent = `${player.pts} pts`;
  const rankSpan = document.createElement('span');
  rankSpan.className = 'player__rank';
  rankSpan.textContent = player.rank;
  statsWrap.append(ptsSpan, rankSpan);
  main.append(nickSpan, statsWrap);
  entry.appendChild(main);

  const meta = document.createElement('div');
  meta.className = 'lobby-player__meta';

  const abonLabel = document.createElement('label');
  abonLabel.textContent = 'Абонемент:';
  const select = document.createElement('select');
  select.className = 'abonement-select';
  select.dataset.i = index;
  ABONEMENT_TYPES.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    if ((player.abonement || 'none') === type) opt.selected = true;
    select.appendChild(opt);
  });
  abonLabel.appendChild(select);

  const keyControls = document.createElement('div');
  keyControls.className = 'key-controls';
  const issueBtn = document.createElement('button');
  issueBtn.type = 'button';
  issueBtn.className = 'btn-issue-key';
  issueBtn.dataset.nick = player.nick;
  issueBtn.textContent = 'Видати ключ';
  const keyDisplay = document.createElement('div');
  keyDisplay.className = 'access-key';
  keyControls.append(issueBtn, keyDisplay);

  meta.append(abonLabel, keyControls);
  entry.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'lobby-player__actions';
  for (let k = 0; k < state.teamsCount; k++) {
    const assignBtn = document.createElement('button');
    assignBtn.type = 'button';
    assignBtn.className = 'assign';
    assignBtn.dataset.i = index;
    assignBtn.dataset.team = k + 1;
    assignBtn.textContent = `→${k + 1}`;
    actions.appendChild(assignBtn);
  }
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-lobby';
  removeBtn.dataset.i = index;
  removeBtn.textContent = '✕';
  actions.appendChild(removeBtn);
  entry.appendChild(actions);

  return entry;
}

function createTeamEntry(player) {
  const li = document.createElement('li');
  li.className = 'team-player';
  li.dataset.nick = player.nick;
  if (state.teamsCount > 0) li.setAttribute('draggable', 'true');
  else li.removeAttribute('draggable');

  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = player.nick;
  const pts = document.createElement('span');
  pts.className = 'player-points';
  pts.textContent = player.pts;
  li.append(name, pts);
  return li;
}

function setupDnD(containers) {
  const active = containers.filter(Boolean);
  active.forEach(container => {
    if (!container.dataset.dndInit) {
      container.addEventListener('dragover', e => {
        e.preventDefault();
        container.classList.add('drag-over');
      });
      container.addEventListener('dragleave', () => {
        container.classList.remove('drag-over');
      });
      container.addEventListener('drop', async e => {
        e.preventDefault();
        container.classList.remove('drag-over');
        const nick = e.dataTransfer.getData('text/plain');
        const targetKey = container.dataset.team || container.id;
        await movePlayer(nick, targetKey);
      });
      container.dataset.dndInit = '1';
    }
  });

  const draggables = [];
  active.forEach(container => {
    container.querySelectorAll('[draggable="true"]').forEach(item => {
      draggables.push(item);
    });
  });
  draggables.forEach(item => {
    item.addEventListener('dragstart', e => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.nick);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
}

function takePlayer(nick) {
  let idx = lobby.findIndex(p => p.nick === nick);
  if (idx !== -1) return lobby.splice(idx, 1)[0];
  for (const key of Object.keys(teams)) {
    const arr = teams[key] || [];
    idx = arr.findIndex(p => p.nick === nick);
    if (idx !== -1) return arr.splice(idx, 1)[0];
  }
  return null;
}

async function movePlayer(nick, targetKey) {
  const player = takePlayer(nick);
  if (!player) return;

  if (String(targetKey || '').startsWith('team')) {
    const teamNo = Number.parseInt(String(targetKey).replace('team', ''), 10);
    const teamKey = getTeamKey(teamNo);
    if (teamKey) {
      teams[teamKey].push(player);
      renderLobby();
      renderLobbyCards();
      try {
        await renderAllAvatars(document.getElementById('players') || document);
      } catch (err) {
        log('[ranking]', err);
      }
      renderSelect(filtered);
      refreshArenaTeams();
      await maybeAutoRebalance();
      return;
    }
  }

  lobby.push(player);

  renderLobby();
  renderLobbyCards();
  try {
    await renderAllAvatars(document.getElementById('players') || document);
  } catch (err) {
    log('[ranking]', err);
  }
  renderSelect(filtered);
  refreshArenaTeams();
  await maybeAutoRebalance();
}

// Рендер лоббі
function renderLobby() {
  const lobbyContainer = document.getElementById('lobby-list');
  if (!lobbyContainer) return;
  if (!lobbyContainer.dataset.team) lobbyContainer.dataset.team = 'lobby';

  lobbyContainer.replaceChildren();
  lobby.forEach((player, index) => {
    lobbyContainer.appendChild(createLobbyEntry(player, index));
  });

  const dropTargets = [lobbyContainer];
  const teamsContainer = document.getElementById('lobby');
  if (teamsContainer) {
    teamsContainer.classList.toggle('hidden', state.teamsCount === 0);
    Array.from(teamsContainer.querySelectorAll('.team')).forEach(teamDiv => {
      const key = teamDiv.dataset.team || '';
      const teamNo = getTeamNumber(key);
      const teamKey = getTeamKey(key);
      const list = teamDiv.querySelector('.team-list');
      const sumEl = teamDiv.querySelector('.team-sum');
      const isActive = state.teamsCount > 0 && Number.isInteger(teamNo) && state.teamsCount >= teamNo;

      if (!Number.isInteger(teamNo)) {
        teamDiv.classList.add('hidden');
        if (list) list.replaceChildren();
        if (sumEl) sumEl.textContent = '∑ 0';
        return;
      }

      const members = teamKey ? teams[teamKey] : [];
      if (list) {
        list.replaceChildren();
        members.forEach(player => {
          list.appendChild(createTeamEntry(player));
        });
        list.dataset.team = key;
      }
      if (sumEl) {
        const total = members.reduce((sum, p) => sum + (Number(p.pts) || 0), 0);
        sumEl.textContent = `∑ ${total}`;
      }
      teamDiv.classList.toggle('hidden', !isActive);
      if (isActive && list) {
        dropTargets.push(list);
      }
    });
  }

  updateSummary();
  updatePlayersDatalist();

  if (state.teamsCount > 0) {
    setupDnD(dropTargets);
  }
}

function renderLobbyCards() {
  let cards = document.querySelector('.bal__players');
  if (!cards) {
    const area = document.getElementById('lobby-area');
    if (area) {
      cards = document.createElement('div');
      cards.className = 'bal__players only-mobile';
      area.appendChild(cards);
    }
  }
  if (!cards) return;
  cards.replaceChildren();
  lobby.forEach((p, i) => {
    const player = document.createElement('div');
    player.className = 'player';

    const row1 = document.createElement('div');
    row1.className = 'row';
    const nickSpan = document.createElement('span');
    nickSpan.className = 'nick';
    nickSpan.textContent = p.nick;
    const ptsSpan = document.createElement('span');
    ptsSpan.className = 'pts';
    ptsSpan.textContent = p.pts;
    row1.append(nickSpan, ptsSpan);

    const row2 = document.createElement('div');
    row2.className = 'row';
    const rankSpan = document.createElement('span');
    rankSpan.className = 'rank';
    rankSpan.textContent = p.rank;
    const seasonSpan = document.createElement('span');
    seasonSpan.className = 'season';
    seasonSpan.textContent = p.abonement || '';
    row2.append(rankSpan, seasonSpan);

    const row3 = document.createElement('div');
    row3.className = 'row';
    const keySpan = document.createElement('span');
    keySpan.className = 'key';
    const issueBtn = document.createElement('button');
    issueBtn.className = 'btn-issue-key';
    issueBtn.dataset.nick = p.nick;
    issueBtn.textContent = 'Видати ключ';
    const accessSpan = document.createElement('span');
    accessSpan.className = 'access-key';
    keySpan.append(issueBtn, accessSpan);

    const actionsSpan = document.createElement('span');
    actionsSpan.className = 'actions';
    for (let k = 0; k < state.teamsCount; k++) {
      const btn = document.createElement('button');
      btn.className = 'assign';
      btn.dataset.i = i;
      btn.dataset.team = k + 1;
      btn.textContent = `→${k+1}`;
      actionsSpan.appendChild(btn);
    }
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-lobby';
    removeBtn.dataset.i = i;
    removeBtn.textContent = '✕';
    actionsSpan.appendChild(removeBtn);

    row3.append(keySpan, actionsSpan);

    player.append(row1, row2, row3);
    cards.appendChild(player);
  });
}

async function onLobbyAction(e) {
  const assign = e.target.closest('.assign');
  if (assign) {
    const idx = +assign.dataset.i;
    const teamNo = +assign.dataset.team;
    const p = lobby.splice(idx, 1)[0];

    const preset = {};
    const teamKey = getTeamKey(teamNo);
    getTeamKeys().forEach(key => {
      preset[key] = [...teams[key]];
    });
    if (teamKey) {
      preset[teamKey] = preset[teamKey] || [];
      preset[teamKey].push(p);
      initTeams(state.teamsCount, preset);
    } else {
      lobby.splice(idx, 0, p);
    }

    refreshArenaTeams();
    renderLobby();
    renderLobbyCards();
    try {
      await renderAllAvatars(document.getElementById('players') || document);
    } catch (err) {
      log('[ranking]', err);
    }
    renderSelect(filtered);
    await maybeAutoRebalance();
    return;
  }

  const remove = e.target.closest('.remove-lobby');
  if (remove) {
    const idx = +remove.dataset.i;
    lobby.splice(idx, 1);
    renderLobby();
    renderLobbyCards();
    try {
      await renderAllAvatars(document.getElementById('players') || document);
    } catch (err) {
      log('[ranking]', err);
    }
    renderSelect(filtered);
    refreshArenaTeams();
    await maybeAutoRebalance();
    return;
  }

  const sel = e.target.closest('.abonement-select');
  if (sel && e.type === 'change') {
    const idx = +sel.dataset.i;
    const player = lobby[idx];
    const newType = sel.value;
    const prevType = player.abonement || 'none';
    (async () => {
      try {
        const res = await updateAbonement({ nick: player.nick, league: state.league, type: newType });
        if (res !== 'OK' && res?.status !== 'OK') throw new Error('Failed');
        player.abonement = newType;
        const full = players.find(p => p.nick === player.nick);
        if (full) full.abonement = newType;
        const msg = 'Абонемент оновлено';
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
      } catch (err) {
        sel.value = prevType;
        log('[ranking]', err);
        const msg = 'Помилка оновлення абонемента';
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
      }
    })();
  }
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-issue-key');
  if (!btn) return;
  const nick = btn.dataset.nick;
  try {
    const key = await issueAccessKey({ nick, league: state.league });
    const host = btn.closest('.lobby-player') || btn.closest('.player') || btn.closest('tr');
    const cell = host?.querySelector('.access-key');
    if (cell) {
      cell.innerHTML = `<span class='key'>${key}</span><button class='copy-key'>Copy</button>`;
    }
  } catch (err) {
    log('[ranking]', err);
    const msg = 'Не вдалося видати ключ';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
  }
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('.copy-key');
  if (!btn) return;
  const cell = btn.closest('.access-key');
  const key = cell?.querySelector('.key')?.textContent;
  if (!key) return;
  try {
    await navigator.clipboard.writeText(key);
  } catch (err) {
    log('[ranking]', err);
  }
});


// Mobile shell
(() => {
  if (window.__balMobileInit) return;
  window.__balMobileInit = true;

  if (typeof window.clearLobby !== 'function') {
    window.clearLobby = clearLobby;
  }

  const burger  = document.getElementById('ui-burger');
  const panel   = document.getElementById('ui-panel');
  const overlay = document.getElementById('ui-overlay');

  const closePanel = () => {
    if (panel) panel.hidden = true;
    if (overlay) overlay.hidden = true;
  };
  const openPanel = () => {
    if (panel) panel.hidden = false;
    if (overlay) overlay.hidden = false;
  };

  burger?.addEventListener('click', openPanel);
  overlay?.addEventListener('click', closePanel);
  panel?.addEventListener('click', e => e.stopPropagation());

  document.getElementById('ui-clear-lobby')?.addEventListener('click', async () => {
    if (typeof window.clearLobby === 'function') await window.clearLobby();
    else {
      document.getElementById('lobby-list')?.replaceChildren();
      document.querySelector('.bal__players')?.replaceChildren();
    }
    closePanel();
  });

  document.getElementById('btn-clear-lobby')?.addEventListener('click', async () => {
    if (typeof clearLobby === 'function') await clearLobby();
  });

  const fixVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  fixVh();
  window.addEventListener('resize', fixVh);
})();
