// scripts/lobby.js
import { log } from './logger.js';

import { initTeams, teams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import {
  updateAbonement,
  adminCreatePlayer,
  issueAccessKey,
  getProfile,
  safeDel,
  getAvatarUrl,
  avatarSrcFromRecord,
  clearFetchCache,
} from './api.js';
import { saveLobbyState, loadLobbyState, getLobbyStorageKey } from './state.js';
import { refreshArenaTeams } from './scenario.js';
import { setAvatar } from './avatar.js';

export let lobby = [];
let players = [], filtered = [], selected = [], manualCount = 0;
const ABONEMENT_TYPES = ['none', 'lite', 'full'];

  let uiLeague = 'sundaygames';

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

function refreshAvatars(nick) {
  const sel = nick ? `img.avatar-img[data-nick="${nick}"]` : 'img.avatar-img[data-nick]';
  document.querySelectorAll(sel).forEach(img => setAvatar(img, img.dataset.nick));
}

window.addEventListener('storage', e => {
  if (e.key === 'avatarRefresh') {
    const [nick] = (e.newValue || '').split(':');
    if (nick) clearFetchCache(`avatar:${nick}`);
    refreshAvatars(nick);
  }
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
      const data = await getProfile({ nick, league: uiLeague });
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
  getAvatarUrl(nick).then(rec => avatarSrcFromRecord(rec)).catch(() => {});
  renderLobby();
  renderLobbyCards();
  renderSelect(filtered);
}

// Ініціалізує лоббі новим набором гравців
  export function initLobby(pl, league = uiLeague) {
    uiLeague = String(league || '').toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
  players = pl;
  filtered = [...players];
  const saved = loadLobbyState(uiLeague);
  lobby = saved?.lobby || [];
  manualCount = saved?.manualCount || 0;
  selected = [];
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  if (manualCount > 0) {
    initTeams(manualCount, saved?.teams || {});
  }
  renderSelect(filtered);
  renderLobby();
  renderLobbyCards();
}

export function updateLobbyState(updates){
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
  const teamCount = Object.keys(teams).length;
  if(teamCount) initTeams(teamCount, teams);
  renderLobby();
  renderLobbyCards();
}

// Рендер списку доступних гравців
function renderSelect(arr) {
  document.getElementById('select-area').classList.remove('hidden');
  const ul = document.getElementById('select-list');
  ul.replaceChildren();
  arr.forEach((p, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.i = i;
    if (selected.includes(p)) input.checked = true;
    if (lobby.includes(p) || Object.values(teams).flat().includes(p)) input.disabled = true;
    label.appendChild(input);
    label.append(` ${p.nick} (${p.pts}) – ${p.rank}`);
    li.appendChild(label);
    ul.appendChild(li);
  });

  ul.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.onchange = () => {
      const p = arr[+cb.dataset.i];
      if (cb.checked) selected.push(p);
      else selected = selected.filter(x => x !== p);
    };
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
        selected = selected.filter(p => filtered.includes(p));
        renderSelect(filtered);
      }, 300);
    });
  }

  document.getElementById('btn-sort-name').onclick = () => {
    filtered = sortByName(filtered);
    selected = selected.filter(p => filtered.includes(p));
    renderSelect(filtered);
  };

  document.getElementById('btn-sort-pts').onclick = () => {
    filtered = sortByPtsDesc(filtered);
    selected = selected.filter(p => filtered.includes(p));
    renderSelect(filtered);
  };

  document.getElementById('btn-add-selected').onclick = () => {
    selected.forEach(p => {
      if (!lobby.includes(p)) lobby.push(p);
    });
    selected = [];
    renderLobby();
    renderLobbyCards();
    renderSelect(filtered);
  };

  document.getElementById('btn-clear-selected').onclick = () => {
    selected = [];
    renderSelect(filtered);
  };

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
        const status = await adminCreatePlayer({ league: uiLeague, nick, age });
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
export function setManualCount(n) {
  manualCount = n;
  renderLobby();
  renderLobbyCards();
}

export function clearLobby() {
  lobby.length = 0;
  manualCount = 0;
  Object.keys(teams).forEach(k => { teams[k].length = 0; });

  safeDel(localStorage, getLobbyStorageKey(undefined, uiLeague));

  renderLobby();
  renderLobbyCards();
  renderTeams();
  updateSummary();
  renderSelect(filtered);
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

function renderPlayerList(el, arr) {
  if (!el) return;
  el.replaceChildren();
  arr.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player';
    div.dataset.nick = p.nick;
    div.draggable = true;

    const img = document.createElement('img');
    img.className = 'player__avatar';
    img.alt = 'avatar';
    img.loading = 'lazy';
    img.width = 40;
    img.height = 40;
    setAvatar(img, p.nick, 40);

    const meta = document.createElement('div');
    meta.className = 'player__meta';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'player__name';
    nameDiv.textContent = p.nick;

    const ptsDiv = document.createElement('div');
    ptsDiv.className = 'player__points';
    ptsDiv.textContent = `${p.pts} pts`;

    meta.appendChild(nameDiv);
    meta.appendChild(ptsDiv);

    const dragDiv = document.createElement('div');
    dragDiv.className = 'player__drag';
    dragDiv.textContent = '≡';

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(dragDiv);

    el.appendChild(div);
  });
}

function setupDnD(containers) {
  containers.forEach(c => {
    c.addEventListener('dragover', e => e.preventDefault());
    c.addEventListener('drop', e => {
      e.preventDefault();
      const nick = e.dataTransfer.getData('text/plain');
      movePlayer(nick, c.id);
    });
  });

  containers.forEach(c => {
    c.querySelectorAll('.player').forEach(p => {
      p.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', p.dataset.nick);
      });
    });
  });
}

function takePlayer(nick) {
  let idx = lobby.findIndex(p => p.nick === nick);
  if (idx !== -1) return lobby.splice(idx, 1)[0];
  if (!teams[1]) teams[1] = [];
  if (!teams[2]) teams[2] = [];
  idx = teams[1].findIndex(p => p.nick === nick);
  if (idx !== -1) return teams[1].splice(idx, 1)[0];
  idx = teams[2].findIndex(p => p.nick === nick);
  if (idx !== -1) return teams[2].splice(idx, 1)[0];
  return null;
}

function movePlayer(nick, targetId) {
  const p = takePlayer(nick);
  if (!p) return;
  if (targetId === 'lobby-list') lobby.push(p);
  else if (targetId === 'team-a') teams[1].push(p);
  else if (targetId === 'team-b') teams[2].push(p);
  renderLobby();
  renderLobbyCards();
}

// Рендер лоббі
function renderLobby() {
  const lobbyEl = document.getElementById('lobby-list');
  const teamAEl = document.getElementById('team-a');
  const teamBEl = document.getElementById('team-b');
  if (teamAEl || teamBEl) {
    teams[1] = teams[1] || [];
    teams[2] = teams[2] || [];
    renderPlayerList(lobbyEl, lobby);
    renderPlayerList(teamAEl, teams[1]);
    renderPlayerList(teamBEl, teams[2]);
    setupDnD([lobbyEl, teamAEl, teamBEl].filter(Boolean));
    updateSummary();
    saveLobbyState({ lobby, teams, manualCount, league: uiLeague });
    updatePlayersDatalist();
    return;
  }

  const tbody = lobbyEl;
  tbody.replaceChildren();
  lobby.forEach((p, i) => {
    const tr = document.createElement('tr');

    const tdNick = document.createElement('td');
    tdNick.textContent = p.nick;
    tr.appendChild(tdNick);

    const tdPts = document.createElement('td');
    tdPts.textContent = p.pts;
    tr.appendChild(tdPts);

    const tdRank = document.createElement('td');
    tdRank.textContent = p.rank;
    tr.appendChild(tdRank);

    const tdAbon = document.createElement('td');
    const sel = document.createElement('select');
    sel.className = 'abonement-select';
    sel.dataset.i = i;
    ABONEMENT_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (p.abonement === t) opt.selected = true;
      sel.appendChild(opt);
    });
    tdAbon.appendChild(sel);
    tr.appendChild(tdAbon);

    const tdBtn = document.createElement('td');
    const issueBtn = document.createElement('button');
    issueBtn.className = 'btn-issue-key';
    issueBtn.dataset.nick = p.nick;
    issueBtn.textContent = 'Видати ключ';
    tdBtn.appendChild(issueBtn);
    tr.appendChild(tdBtn);

    const tdKey = document.createElement('td');
    tdKey.className = 'access-key';
    tr.appendChild(tdKey);

    const tdActions = document.createElement('td');
    for (let k = 0; k < manualCount; k++) {
      const btn = document.createElement('button');
      btn.className = 'assign';
      btn.dataset.i = i;
      btn.dataset.team = k + 1;
      btn.textContent = `→${k+1}`;
      tdActions.appendChild(btn);
    }
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-lobby';
    removeBtn.dataset.i = i;
    removeBtn.textContent = '✕';
    tdActions.appendChild(removeBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  const total = lobby.reduce((s, p) => s + p.pts, 0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = total;
  document.getElementById('lobby-avg').textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';

  updatePlayersDatalist();
  saveLobbyState({lobby, teams, manualCount, league: uiLeague});
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
    for (let k = 0; k < manualCount; k++) {
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

function onLobbyAction(e) {
  const assign = e.target.closest('.assign');
  if (assign) {
    const idx = +assign.dataset.i;
    const teamNo = +assign.dataset.team;
    const p = lobby.splice(idx, 1)[0];

    const preset = {};
    Object.keys(teams).forEach(key => {
      preset[key] = [...teams[key]];
    });
    preset[teamNo] = preset[teamNo] || [];
    preset[teamNo].push(p);

    initTeams(manualCount, preset);
    refreshArenaTeams();
    renderLobby();
    renderLobbyCards();
    renderSelect(filtered);
    return;
  }

  const remove = e.target.closest('.remove-lobby');
  if (remove) {
    const idx = +remove.dataset.i;
    lobby.splice(idx, 1);
    renderLobby();
    renderLobbyCards();
    renderSelect(filtered);
    refreshArenaTeams();
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
        const res = await updateAbonement({ nick: player.nick, league: uiLeague, type: newType });
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
    const key = await issueAccessKey({ nick, league: uiLeague });
    const host = btn.closest('tr') || btn.closest('.player');
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

  document.getElementById('ui-clear-lobby')?.addEventListener('click', () => {
    if (typeof window.clearLobby === 'function') window.clearLobby();
    else {
      document.getElementById('lobby-list')?.replaceChildren();
      document.querySelector('.bal__players')?.replaceChildren();
    }
    closePanel();
  });

  document.getElementById('btn-clear-lobby')?.addEventListener('click', () => {
    if (typeof clearLobby === 'function') clearLobby();
  });

  const fixVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  fixVh();
  window.addEventListener('resize', fixVh);
})();
