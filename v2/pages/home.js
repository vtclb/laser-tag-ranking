import { getHomeOverview, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const placeholder = '../assets/default-avatar.svg';
const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function heroCard(player, leagueLabel) {
  if (!player) return `<article class="card mini"><p class="tag">${leagueLabel}</p><p>Немає даних</p></article>`;
  const meta = rankMeta(player.rankLetter);
  return `<article class="hero-card ${meta.cssClass}">
    <p class="tag">TOP-1 ${leagueLabel}</p>
    <div class="player-head">
      <img class="avatar lg" src="${player.avatarUrl || placeholder}" alt="avatar" onerror="this.src='${placeholder}'">
      <div>
        <h3>${player.nick}</h3>
        <p><span class="rank-badge ${meta.cssClass}">${meta.label}</span></p>
        <p class="tag">Points: ${player.points ?? '—'} · MVP: ${player.mvp ?? 0}</p>
      </div>
    </div>
  </article>`;
}

function statsCard(title, stats) {
  return `<article class="card mini"><p class="tag">${title}</p><h3>Ігри: ${stats.games}</h3><p>Раунди: ${stats.rounds}</p><p>Гравці: ${stats.players}</p></article>`;
}

function distChart(title, dist) {
  const total = Object.values(dist || {}).reduce((a, b) => a + b, 0) || 1;
  const bars = ranks.map((r) => {
    const v = dist?.[r] || 0;
    const width = Math.round((v / total) * 100);
    const meta = rankMeta(r);
    return `<div class="dist-row"><span>${r}</span><div class="dist-track"><div class="dist-fill ${meta.cssClass}" style="width:${width}%"></div></div><b>${v}</b></div>`;
  }).join('');
  return `<article class="card mini"><p class="tag">${title}</p>${bars}</article>`;
}

async function init() {
  const stateBox = document.getElementById('stateBox');
  try {
    stateBox.textContent = 'Завантаження...';
    const data = await getHomeOverview();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = heroCard(data.top1Kids, 'Kids') + heroCard(data.top1Adults, 'Olds');
    document.getElementById('overviewStats').innerHTML = statsCard('Kids статистика', data.statsKids) + statsCard('Olds статистика', data.statsAdults);
    document.getElementById('charts').innerHTML = distChart('Розподіл рангу: Kids', data.rankDistKids) + distChart('Розподіл рангу: Olds', data.rankDistAdults);
    stateBox.textContent = '';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Помилка';
    stateBox.textContent = safeErrorMessage(error);
  }
}

init();
