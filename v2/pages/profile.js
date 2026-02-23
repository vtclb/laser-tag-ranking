import { getPlayerAllTimeProfile, getPlayerSeasonLogs, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { getQueryParams } from '../core/utils.js';

const { nick = '' } = getQueryParams();
const content = document.getElementById('content');
const placeholder = '../assets/default-avatar.svg';

async function init() {
  if (!nick) {
    content.innerHTML = '<section class="card">Player not found</section>';
    return;
  }
  try {
    const [profile, seasons] = await Promise.all([getPlayerAllTimeProfile(nick), getSeasonsList()]);
    if (!profile) {
      content.innerHTML = '<section class="card">Player not found</section>';
      return;
    }

    content.innerHTML = `
      <section class="card">
        <div class="player-head"><img class="avatar lg" src="${profile.avatar || placeholder}" onerror="this.src='${placeholder}'"><div><h1>${profile.nick}</h1><p class="tag">Основна ліга: ${profile.league}</p></div></div>
        <p>Games: ${profile.allTime.games} · Rounds: ${profile.allTime.rounds}</p>
        <p>W/L/D: ${profile.allTime.wins}/${profile.allTime.losses}/${profile.allTime.draws} · WR: ${profile.allTime.winrate}%</p>
        <p>Top1/2/3: ${profile.allTime.top1}/${profile.allTime.top2}/${profile.allTime.top3}</p>
      </section>
      <section class="card">
        <div class="search-row"><select id="seasonFilter" class="search-input"><option value="all">All-time</option>${seasons.map((s) => `<option value="${s.id}">${s.title}</option>`).join('')}</select></div>
        <div id="seasonStats"></div>
        <div id="logs"></div>
      </section>
    `;

    const filter = document.getElementById('seasonFilter');
    async function renderSeason() {
      const selected = filter.value;
      const seasonStats = document.getElementById('seasonStats');
      const logs = document.getElementById('logs');
      if (selected === 'all') {
        seasonStats.innerHTML = `<ul class="list-clean">${profile.seasons.map((s) => `<li>${s.seasonTitle} (${s.league}) · games ${s.games}, WR ${s.winrate}%</li>`).join('')}</ul>`;
        logs.innerHTML = '<p class="tag">Оберіть сезон, щоб переглянути логи.</p>';
        return;
      }
      const stat = profile.seasons.find((s) => s.seasonId === selected);
      const logData = await getPlayerSeasonLogs({ nick, seasonId: selected });
      seasonStats.innerHTML = stat ? `<p>${stat.seasonTitle}: <span title="Перемоги/Поразки/Нічиї">WLD</span> ${stat.wins}/${stat.losses}/${stat.draws}, top1/2/3 ${stat.top1}/${stat.top2}/${stat.top3}</p><p>Season gain: ${logData.metrics.seasonGain} · Max points: ${logData.metrics.maxPoints} · Avg/day: ${logData.metrics.avgPerDay}</p>` : '<p>Сезон без статистики</p>';
      logs.innerHTML = logData.groups.map((g) => `<article class="card mini" style="border:1px solid rgba(255,255,255,.18);margin-top:.6rem;padding:.5rem .7rem;"><h3>${g.date}</h3><ul class="list-clean">${g.entries.map((m) => `<li>${m.team1.join(', ')} vs ${m.team2.join(', ')} · winner: ${m.winner || '—'} · MVP ${m.mvp1 || '—'}/${m.mvp2 || '—'}/${m.mvp3 || '—'} · rounds ${m.rounds || 1}</li>`).join('')}</ul></article>`).join('') || '<p class="placeholder">Немає логів за сезон</p>';
    }

    filter.addEventListener('change', renderSeason);
    renderSeason();
  } catch (error) {
    content.innerHTML = `<section class="card">${safeErrorMessage(error)}</section>`;
  }
}

init();
