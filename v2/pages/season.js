import { getSeasonsList, getSeasonDashboard, getSeasonPlayerQuickCard, rankMeta, safeErrorMessage } from '../core/dataHub.js';

const seasonSelect = document.getElementById('seasonSelect');
const leagueSelect = document.getElementById('leagueSelect');
const modal = document.getElementById('playerModal');
const modalBody = document.getElementById('modalBody');
const placeholder = '../assets/default-avatar.svg';

function distChart(dist) {
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].map((r) => {
    const meta = rankMeta(r);
    return `<div class="dist-row"><span>${r}</span><div class="dist-track"><div class="dist-fill ${meta.cssClass}" style="width:${(dist[r] || 0) * 12}%"></div></div><b>${dist[r] || 0}</b></div>`;
  }).join('');
}

function renderRows(rows) {
  document.getElementById('tableBody').innerHTML = rows.map((p) => `
    <tr data-nick="${p.nick}" class="${p.rank.cssClass}">
      <td>${p.place}</td>
      <td><strong>${p.nick}</strong></td>
      <td>${p.points ?? '—'}</td><td>${p.games}</td><td>${p.winRate ?? '—'}%</td><td>${p.mvp}</td><td>${p.mvp2}</td><td>${p.mvp3}</td>
    </tr>
  `).join('') || '<tr><td colspan="8">Дані відсутні</td></tr>';
}

async function showPlayer(nick) {
  const data = await getSeasonPlayerQuickCard({ seasonId: seasonSelect.value, league: leagueSelect.value, nick });
  if (!data) return;
  modalBody.innerHTML = `
    <button class="chip modal-close" onclick="document.getElementById('playerModal').close()">✕</button>
    <div class="player-head">
      <img class="avatar lg" src="${data.avatarUrl || placeholder}" alt="avatar" onerror="this.src='${placeholder}'">
      <div><h3>${data.nick}</h3><p><span class="rank-badge ${data.rank.cssClass}">${data.rank.label}</span> · points: ${data.points ?? '—'}</p></div>
    </div>
    <p><span title="Перемоги/Поразки/Нічиї">WLD</span>: ${data.wins}/${data.losses}/${data.draws} · WR: ${data.winrate ?? '—'}%</p>
    <p>Top1/2/3: ${data.mvp1}/${data.mvp2}/${data.mvp3}</p>
    <div class="modal-actions"><a class="chip" href="./profile.html?nick=${encodeURIComponent(data.nick)}">Profile</a></div>
  `;
  modal.showModal();
}

async function loadDashboard() {
  const state = document.getElementById('state');
  try {
    state.textContent = 'Завантаження...';
    const data = await getSeasonDashboard(seasonSelect.value, leagueSelect.value);
    document.getElementById('seasonTitle').textContent = `${data.seasonTitle} · ${data.league} · Dashboard`;
    document.getElementById('totals').innerHTML = `<article class="card mini"><h3>Games ${data.totals.games}</h3><p>Rounds ${data.totals.rounds}</p></article><article class="card mini"><h3>Players ${data.totals.players}</h3><p><span title="AVG = середня зміна поінтів за гру">AVG Δ</span> ${data.totals.avgPointsDeltaPerGame}</p><p><span title="Перемоги/Поразки/Нічиї">WLD</span> ${data.totals.wldLabel}</p></article>`;
    document.getElementById('charts').innerHTML = `<article class="card mini"><p class="tag">Rank distribution</p>${distChart(data.rankDistribution)}</article>`;
    document.getElementById('top3').innerHTML = data.top3.map((p) => `<article class="top-card ${p.rank.cssClass}"><img class="avatar" src="${p.avatarUrl || placeholder}" onerror="this.src='${placeholder}'"> ${p.nick}<br><span class="rank-badge ${p.rank.cssClass}">${p.rank.label}</span></article>`).join('');
    document.getElementById('leaders').innerHTML = `<article class="card mini">🥇 Найбільше ігор: ${data.leaders.mostGames.nick || '—'} (${data.leaders.mostGames.count || 0})</article><article class="card mini">🎯 Найкращий WR: ${data.leaders.bestWinrate.nick || '—'} (${data.leaders.bestWinrate.winRate || 0}%)</article><article class="card mini">👑 TOP1: ${data.leaders.mostTop1.nick || '—'} (${data.leaders.mostTop1.count || 0})</article><article class="card mini">🥈 TOP2: ${data.leaders.mostTop2.nick || '—'} (${data.leaders.mostTop2.count || 0})</article><article class="card mini">🥉 TOP3: ${data.leaders.mostTop3.nick || '—'} (${data.leaders.mostTop3.count || 0})</article>`;
    renderRows(data.tablePlayers);
    state.textContent = '';
  } catch (error) {
    state.textContent = safeErrorMessage(error);
  }
}

document.getElementById('tableBody').addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-nick]');
  if (row) showPlayer(row.dataset.nick);
});

modal.addEventListener('click', (event) => {
  if (event.target === modal) modal.close();
});

async function init() {
  const seasons = await getSeasonsList();
  seasonSelect.innerHTML = seasons.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');
  seasonSelect.value = seasons[0]?.id;
  seasonSelect.addEventListener('change', loadDashboard);
  leagueSelect.addEventListener('change', loadDashboard);
  await loadDashboard();
}

init();
