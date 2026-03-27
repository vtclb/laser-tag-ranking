import { getPlayerAllTimeProfile, getPlayerSeasonLogs, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getHashQueryParams } from '../core/utils.js';

const placeholder = '../assets/default-avatar.svg';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }

function buildHash(route, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return `#${route}${qs ? `?${qs}` : ''}`;
}

function resolveParams(params = {}) {
  const qp = getHashQueryParams();
  return {
    league: normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids',
    nick: String(params.nick || qp.get('nick') || '').trim()
  };
}

function renderSkeleton(root) {
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження профілю…</p></section>';
}

export async function initProfilePage(params = {}) {
  const root = document.getElementById('profileRoot') || document.getElementById('view');
  if (!root) return;

  const { nick, league } = resolveParams(params);
  if (!nick) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Не вказано нікнейм гравця.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
    return;
  }

  renderSkeleton(root);

  try {
    const [profile, seasons] = await Promise.all([getPlayerAllTimeProfile(nick), getSeasonsList()]);
    if (!profile) {
      root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Гравця не знайдено.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
      return;
    }

    root.innerHTML = `
      <section class="px-card">
        <div class="player-head"><img class="avatar lg" src="${esc(profile.avatar || placeholder)}" alt="${esc(profile.nick)}" onerror="this.src='${placeholder}'"><div><h1 class="px-card__title">${esc(profile.nick)}</h1><p class="px-card__text">Основна ліга: ${esc(leagueLabelUA(profile.league))}</p></div></div>
        <p class="px-card__text">Games: ${profile.allTime.games} · Rounds: ${profile.allTime.rounds}</p>
        <p class="px-card__text">W/L/D: ${profile.allTime.wins}/${profile.allTime.losses}/${profile.allTime.draws} · WR: ${profile.allTime.winrate}%</p>
        <p class="px-card__text">MVP1/2/3: ${profile.allTime.top1}/${profile.allTime.top2}/${profile.allTime.top3}</p>
        <div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div>
      </section>
      <section class="px-card">
        <div class="season-controls-row" id="seasonTabs"></div>
        <div id="seasonStats"></div>
        <div id="logs"></div>
      </section>
    `;

    const tabs = root.querySelector('#seasonTabs');
    const selectedState = { seasonId: 'all' };
    tabs.innerHTML = `<button class="btn btn--secondary" data-season-id="all" type="button">All-time</button>${seasons.map((s) => `<button class="btn btn--secondary" data-season-id="${s.id}" type="button">${esc(s.title)}</button>`).join('')}`;

    async function renderSeason() {
      const seasonStats = root.querySelector('#seasonStats');
      const logs = root.querySelector('#logs');
      if (selectedState.seasonId === 'all') {
        seasonStats.innerHTML = `<ul class="list-clean">${profile.seasons.map((s) => `<li>${esc(s.seasonTitle)} (${esc(leagueLabelUA(s.league))}) · games ${s.games}, WR ${s.winrate}%</li>`).join('')}</ul>`;
        logs.innerHTML = '<p class="px-card__text">Оберіть сезон, щоб переглянути логи.</p>';
        return;
      }

      seasonStats.innerHTML = '<p class="px-card__text">Завантаження сезону…</p>';
      logs.innerHTML = '<p class="px-card__text">Завантаження логів…</p>';

      const stat = profile.seasons.find((s) => s.seasonId === selectedState.seasonId);
      const logData = await getPlayerSeasonLogs({ nick, seasonId: selectedState.seasonId });

      seasonStats.innerHTML = stat
        ? `<p class="px-card__text">${esc(stat.seasonTitle)}: W/L/D ${stat.wins}/${stat.losses}/${stat.draws}, MVP1/2/3 ${stat.top1}/${stat.top2}/${stat.top3}</p>
           <p class="px-card__text">Очки за сезон (Δ): ${logData.metrics.seasonGain} · Максимум: ${logData.metrics.maxPoints} · AVG/day: ${logData.metrics.avgPerDay}</p>`
        : '<p class="px-card__text">Сезон без статистики</p>';

      logs.innerHTML = logData.groups.map((g) => `<article class="px-card"><h3>${esc(g.date)}</h3><ul class="list-clean">${g.entries.map((m) => `<li>${esc(m.team1.join(', '))} vs ${esc(m.team2.join(', '))} · winner: ${esc(m.winner || '—')} · MVP ${esc(m.mvp1 || '—')}/${esc(m.mvp2 || '—')}/${esc(m.mvp3 || '—')} · rounds ${esc(m.rounds || 1)}</li>`).join('')}</ul></article>`).join('') || '<p class="px-card__text">Немає логів за сезон</p>';
    }

    tabs.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-season-id]');
      if (!btn) return;
      selectedState.seasonId = btn.dataset.seasonId;
      renderSeason();
    });

    await renderSeason();
  } catch (error) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Дані тимчасово недоступні'))}</p></section>`;
  }
}
