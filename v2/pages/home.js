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
    <a class="chip" href="./league.html?league=${leagueSlug}">Статистика ліги</a>
  </article>`;
}

function statsCard(title, stats) {
  return `<article class="card mini"><p class="tag">${title}</p><h3>Бої: ${stats.battles}</h3><p>Раундів: ${stats.rounds}</p><p>Гравців: ${stats.players}</p></article>`;
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

async function init() {
  const stateBox = document.getElementById('stateBox');
  try {
    stateBox.textContent = 'Завантаження...';
    const data = await getHomeOverview();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'Kids — TOP 5', 'kids') + top5Card(data.top5Adults, 'Sundaygames — TOP 5', 'sundaygames');
    document.getElementById('overviewStats').innerHTML = statsCard('Kids статистика', data.statsKids) + statsCard('Sundaygames статистика', data.statsAdults);
    document.getElementById('charts').innerHTML = distChart('Ранги: Kids', data.rankDistKids, 'league-kids') + distChart('Ранги: Sundaygames', data.rankDistAdults, 'league-adults');
    stateBox.textContent = '';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Помилка';
    stateBox.textContent = safeErrorMessage(error);
  }
}

init();
