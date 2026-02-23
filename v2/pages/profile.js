import { getPlayerAllTimeProfile, getPlayerSeasonLogs, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { getQueryParams } from '../core/utils.js';

const { nick = '' } = getQueryParams();
const content = document.getElementById('content');
const placeholder = '../assets/default-avatar.svg';

function renderSkeleton() {
  content.innerHTML = '<section class="card"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></section><section class="card"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></section>';
}

async function init() {
  if (!nick) {
    content.innerHTML = '<section class="card">Player not found</section>';
    return;
  }

  renderSkeleton();
  try {
    const [profile, seasons] = await Promise.all([getPlayerAllTimeProfile(nick), getSeasonsList()]);
    if (!profile) {
      content.innerHTML = '<section class="card">Player not found</section>';
      return;
    }

    content.innerHTML = `
      <section class="card">
        <div class="player-head"><img class="avatar lg" src="${profile.avatar || placeholder}" onerror="this.src='${placeholder}'"><div><h1>${profile.nick}</h1><p class="tag">Основна ліга: ${profile.league}</p></div></div>
        <p><span class="tooltip-term" title="Games = зіграні матчі">Games</span>: ${profile.allTime.games} · <span class="tooltip-term" title="Rounds = серії боїв">Rounds</span>: ${profile.allTime.rounds}</p>
        <p><span class="tooltip-term" title="Wins / Losses / Draws">WLD</span>: ${profile.allTime.wins}/${profile.allTime.losses}/${profile.allTime.draws} · WR: ${profile.allTime.winrate}%</p>
        <p>Top1/2/3: ${profile.allTime.top1}/${profile.allTime.top2}/${profile.allTime.top3}</p>
      </section>
      <section class="card">
        <div class="search-row" id="seasonTabs"></div>
        <div id="seasonStats"></div>
        <div id="logs"></div>
      </section>
    `;

    const tabs = document.getElementById('seasonTabs');
    const selectedState = { seasonId: 'all' };
    tabs.innerHTML = `<button class="chip" data-season-id="all">All-time</button>${seasons.map((s) => `<button class="chip" data-season-id="${s.id}">${s.title}</button>`).join('')}`;

    async function renderSeason() {
      const seasonStats = document.getElementById('seasonStats');
      const logs = document.getElementById('logs');
      if (selectedState.seasonId === 'all') {
        seasonStats.innerHTML = `<ul class="list-clean">${profile.seasons.map((s) => `<li>${s.seasonTitle} (${s.league}) · games ${s.games}, WR ${s.winrate}%</li>`).join('')}</ul>`;
        logs.innerHTML = '<p class="tag">Оберіть сезон, щоб переглянути логи.</p>';
        return;
      }

      seasonStats.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
      logs.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
      const stat = profile.seasons.find((s) => s.seasonId === selectedState.seasonId);
      const logData = await getPlayerSeasonLogs({ nick, seasonId: selectedState.seasonId });
      seasonStats.innerHTML = stat
        ? `<p>${stat.seasonTitle}: <span class="tooltip-term" title="Wins / Losses / Draws">WLD</span> ${stat.wins}/${stat.losses}/${stat.draws}, top1/2/3 ${stat.top1}/${stat.top2}/${stat.top3}</p>
           <p>Очки за сезон (Δ): ${logData.metrics.seasonGain} · Максимум: ${logData.metrics.maxPoints} · <span class="tooltip-term" title="AVG = середня кількість поінтів за день">AVG/day</span>: ${logData.metrics.avgPerDay}</p>`
        : '<p>Сезон без статистики</p>';

      logs.innerHTML = logData.groups.map((g) => `<article class="card mini" style="border:1px solid rgba(255,255,255,.18);margin-top:.6rem;padding:.5rem .7rem;"><h3>${g.date}</h3><ul class="list-clean">${g.entries.map((m) => `<li>${m.team1.join(', ')} vs ${m.team2.join(', ')} · winner: ${m.winner || '—'} · MVP ${m.mvp1 || '—'}/${m.mvp2 || '—'}/${m.mvp3 || '—'} · rounds ${m.rounds || 1}</li>`).join('')}</ul></article>`).join('') || '<p class="placeholder">Немає логів за сезон</p>';
    }

    tabs.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-season-id]');
      if (!btn) return;
      selectedState.seasonId = btn.dataset.seasonId;
      renderSeason();
    });

    renderSeason();
  } catch (error) {
    content.innerHTML = `<section class="card">${safeErrorMessage(error, 'Дані тимчасово недоступні')}</section>`;
  }
}

init();
