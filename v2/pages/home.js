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
    <a class="chip" href="./league.html?league=${leagueSlug}">${leagueSlug === 'kids' ? 'Перейти до дитячої ліги' : 'Перейти до дорослої ліги'}</a>
  </article>`;
}

function statsCard(title, stats) {
  return `<article class="card mini"><p class="tag">${title}</p><h3><span class="tooltip-term" title="Games = зіграні матчі">Games</span>: ${stats.games}</h3><p><span class="tooltip-term" title="Rounds = серії боїв">Rounds</span>: ${stats.rounds}</p><p><span class="tooltip-term" title="Battles = окремі бої">Battles</span>: ${stats.battles}</p></article>`;
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
  document.getElementById('topHeroes').innerHTML = '<article class="card mini skeleton-block skeleton"></article><article class="card mini skeleton-block skeleton"></article>';
  document.getElementById('overviewStats').innerHTML = '<article class="card mini"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article><article class="card mini"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
  document.getElementById('charts').innerHTML = '<article class="card mini"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article><article class="card mini"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

async function init() {
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();
  try {
    const data = await getHomeOverview();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'Kids — TOP 5', 'kids') + top5Card(data.top5Adults, 'Sundaygames — TOP 5', 'sundaygames');
    document.getElementById('overviewStats').innerHTML = statsCard('Kids статистика', data.statsKids) + statsCard('Sundaygames статистика', data.statsAdults) + statsCard('Загалом по лігах', data.statsTotal);
    document.getElementById('charts').innerHTML = distChart('Ранги: Kids', data.rankDistKids, 'league-kids') + distChart('Ранги: Sundaygames', data.rankDistAdults, 'league-adults');
    stateBox.innerHTML = '<span class="tooltip-term" title="AVG = середня кількість поінтів за гру">AVG</span> · <span class="tooltip-term" title="Wins / Losses / Draws">WLD</span> · <span class="tooltip-term" title="Games = зіграні матчі">Games</span> · <span class="tooltip-term" title="Rounds = серії боїв">Rounds</span> · <span class="tooltip-term" title="Battles = окремі бої">Battles</span>';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Дані тимчасово недоступні';
    stateBox.textContent = safeErrorMessage(error, 'Дані тимчасово недоступні');
  }
}

init();
