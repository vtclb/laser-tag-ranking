// Changelog (Codex): switched Home to compact Top-5 league lists, battles/rounds stats labels, and compact rank distribution with counts + percentages.
import { getHomeOverview, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const placeholder = '../assets/default-avatar.svg';
const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueLabel, leagueSlug) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    return `<li class="top5-row">
      <span class="top5-pos">${idx + 1}</span>
      <img class="avatar" src="${player.avatarUrl || placeholder}" alt="avatar" onerror="this.src='${placeholder}'">
      <span class="top5-nick">${player.nick || '—'}</span>
      <span class="top5-points">${player.points ?? '—'}</span>
      <span class="rank-badge ${meta.cssClass}">${meta.label}</span>
    </li>`;
  }).join('');

  return `<article class="card mini top5-card">
    <p class="tag">${leagueLabel}</p>
    <ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol>
    <a class="chip" href="./league.html?league=${leagueSlug}">${leagueSlug === 'kids' ? 'Статистика Молодша ліга' : 'Статистика Старша ліга'}</a>
  </article>`;
}

function statsCard(title, stats) {
  return `<article class="card mini"><p class="tag">${title}</p><h3>Бої: ${stats.battles}</h3><p>Раунди: ${stats.rounds}</p><p>Участі гравців: ${stats.playerGames}</p></article>`;
}

function distChart(title, dist, leagueClass = '') {
  const total = Object.values(dist || {}).reduce((a, b) => a + b, 0) || 0;
  const rows = ranks.map((rank) => {
    const value = dist?.[rank] || 0;
    const percent = total ? Math.round((value / total) * 100) : 0;
    const meta = rankMeta(rank);
    return `<div class="dist-row compact ${leagueClass}">
      <span class="dist-rank ${meta.cssClass}">${rank}</span>
      <span class="dist-count">${value}</span>
      <span class="dist-percent">${percent}%</span>
    </div>`;
  }).join('');
  return `<article class="card mini"><p class="tag">${title}</p><p class="tag">Всього гравців: ${total}</p>${rows}</article>`;
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = '<article class="card mini skeleton-block"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article><article class="card mini skeleton-block"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
  document.getElementById('overviewStats').innerHTML = '<article class="card mini"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article><article class="card mini"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
  document.getElementById('charts').innerHTML = '<article class="card mini"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article><article class="card mini"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

async function init() {
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();
  try {
    const data = await getHomeOverview();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'Kids TOP-5', 'kids') + top5Card(data.top5Adults, 'Olds TOP-5', 'sundaygames');
    document.getElementById('overviewStats').innerHTML = statsCard('Молодша ліга', data.statsKids) + statsCard('Старша ліга', data.statsAdults) + statsCard('Загалом по лігах', data.statsTotal);
    document.getElementById('charts').innerHTML = distChart('Ранги: Молодша ліга', data.rankDistKids, 'league-kids') + distChart('Ранги: Старша ліга', data.rankDistAdults, 'league-adults');
    stateBox.textContent = 'Бої та раунди рахуються за матчами, а участі — окремо по гравцях.';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Дані тимчасово недоступні';
    stateBox.textContent = safeErrorMessage(error, 'Дані тимчасово недоступні');
  }
}

init();
