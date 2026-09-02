import { MAX_PLAYERS, MAX_ROUNDS, MIN_ROUNDS, TEAM_IDS } from './config.js';
import {
  activeTeamIds,
  selectedPlayers,
  summarizeRounds,
  summarizeTeams,
  teamPlayers,
  unassignedPlayers,
  validateMatch,
} from './domain.js';

const $ = (id) => document.getElementById(id);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function playerOptions(state, selectedKey = '', { includeEmpty = false } = {}) {
  const participants = [
    ...teamPlayers(state, state.activeTeamA),
    ...teamPlayers(state, state.activeTeamB),
  ];
  const empty = includeEmpty ? '<option value="">Не обрано</option>' : '';
  return empty + participants.map((player) => (
    `<option value="${escapeHtml(player.key)}" ${player.key === selectedKey ? 'selected' : ''}>${escapeHtml(player.nick)}</option>`
  )).join('');
}

function renderPlayers(state) {
  const selected = new Set(state.selectedKeys);
  const query = String(state.search || '').trim().toLocaleLowerCase('uk');
  const filtered = state.players.filter((player) => !query || player.nick.toLocaleLowerCase('uk').includes(query));
  filtered.sort((a, b) => {
    if (state.sort === 'name_asc') return a.nick.localeCompare(b.nick, 'uk');
    const delta = a.rating - b.rating;
    return state.sort === 'rating_asc' ? delta || a.nick.localeCompare(b.nick, 'uk') : -delta || a.nick.localeCompare(b.nick, 'uk');
  });
  $('selectionCount').textContent = `Обрано ${state.selectedKeys.length} / ${MAX_PLAYERS}`;
  $('playerList').innerHTML = filtered.length ? filtered.map((player) => `
    <button class="b3-player" type="button" data-player-key="${escapeHtml(player.key)}" aria-pressed="${selected.has(player.key)}">
      <span class="b3-player__check">${selected.has(player.key) ? '✓' : ''}</span>
      <span class="b3-player__name">${escapeHtml(player.nick)}</span>
      <span class="b3-player__rating">${player.rating} pts</span>
    </button>
  `).join('') : `<p class="b3-empty">${state.playersLoaded ? 'Нічого не знайдено.' : 'Завантажте склад обраної ліги.'}</p>`;
}

function teamMoveSelect(state, playerKey, selectedTeamId = '') {
  const options = ['<option value="">Нерозподілений</option>', ...activeTeamIds(state).map((teamId) => (
    `<option value="${teamId}" ${teamId === selectedTeamId ? 'selected' : ''}>${escapeHtml(state.teamNames[teamId])}</option>`
  ))];
  return `<select data-move-player="${escapeHtml(playerKey)}" aria-label="Перемістити гравця">${options.join('')}</select>`;
}

function renderTeams(state) {
  const ids = activeTeamIds(state);
  $('teamsGrid').innerHTML = ids.map((teamId) => {
    const players = teamPlayers(state, teamId);
    const total = players.reduce((sum, player) => sum + player.rating, 0);
    return `
      <article class="b3-team" data-team-id="${teamId}">
        <header class="b3-team__head">
          <h3>${escapeHtml(state.teamNames[teamId])}</h3>
          <strong>${total} pts</strong>
        </header>
        <div class="b3-team__players">
          ${players.length ? players.map((player) => `
            <div class="b3-team-player">
              <span>${escapeHtml(player.nick)} · ${player.rating} pts</span>
              ${teamMoveSelect(state, player.key, teamId)}
            </div>
          `).join('') : '<p class="b3-empty" style="padding:0 11px">Команда порожня</p>'}
        </div>
      </article>
    `;
  }).join('');

  const unassigned = unassignedPlayers(state);
  $('unassignedPanel').classList.toggle('is-hidden', unassigned.length === 0);
  $('unassignedList').innerHTML = unassigned.map((player) => `
    <div class="b3-team-player">
      <span>${escapeHtml(player.nick)} · ${player.rating} pts</span>
      ${teamMoveSelect(state, player.key)}
    </div>
  `).join('');

  const metrics = summarizeTeams(state);
  const quality = metrics.relativeSpread <= 0.08 ? 'Добрий баланс' : metrics.relativeSpread <= 0.16 ? 'Прийнятний баланс' : 'Потрібна перевірка';
  $('balanceQuality').textContent = `${quality} · внутрішня оцінка сили`;
  $('balanceQuality').className = metrics.relativeSpread <= 0.08 ? 'b3-quality--good' : 'b3-quality--warn';
  $('rebalanceButton').classList.toggle('is-hidden', state.balanceMode !== 'auto');
}

function renderTeamSelectors(state) {
  const ids = activeTeamIds(state).filter((teamId) => teamPlayers(state, teamId).length > 0);
  const options = (selectedId) => ids.map((teamId) => (
    `<option value="${teamId}" ${teamId === selectedId ? 'selected' : ''}>${escapeHtml(state.teamNames[teamId])}</option>`
  )).join('');
  $('teamASelect').innerHTML = options(state.activeTeamA);
  $('teamBSelect').innerHTML = options(state.activeTeamB);
}

function renderRounds(state) {
  const nameA = state.teamNames[state.activeTeamA];
  const nameB = state.teamNames[state.activeTeamB];
  $('roundCountOptions').innerHTML = Array.from({ length: MAX_ROUNDS - MIN_ROUNDS + 1 }, (_, index) => index + MIN_ROUNDS)
    .map((count) => `<button class="b3-button" type="button" data-round-count="${count}" aria-pressed="${count === state.roundCount}">${count}</button>`).join('');
  $('roundsList').innerHTML = Array.from({ length: state.roundCount }, (_, index) => `
    <div class="b3-round" data-round-index="${index}" data-choice="${state.rounds[index] || ''}">
      <span class="b3-round__number">${index + 1}</span>
      <button type="button" data-round-choice="team1">${escapeHtml(nameA)}</button>
      <button type="button" data-round-choice="draw">Нічия</button>
      <button type="button" data-round-choice="team2">${escapeHtml(nameB)}</button>
    </div>
  `).join('');
}

function renderMatchSummary(state) {
  const summary = summarizeRounds(state);
  const aClass = summary.winner === 'team1' ? 'is-leading' : summary.winner === 'team2' ? 'is-trailing' : '';
  const bClass = summary.winner === 'team2' ? 'is-leading' : summary.winner === 'team1' ? 'is-trailing' : '';
  const drawClass = summary.winner === 'draw' ? 'is-draw' : '';
  $('matchSummary').innerHTML = `
    <div class="${aClass}"><strong>${summary.team1}</strong><span>${escapeHtml(state.teamNames[state.activeTeamA])}</span></div>
    <div class="${drawClass}"><strong>${summary.draws}</strong><span>Нічиї</span></div>
    <div class="${bClass}"><strong>${summary.team2}</strong><span>${escapeHtml(state.teamNames[state.activeTeamB])}</span></div>
  `;
}

function renderMvp(state) {
  $('mvp1Select').innerHTML = playerOptions(state, state.mvp.mvp1, { includeEmpty: true });
  $('mvp2Select').innerHTML = playerOptions(state, state.mvp.mvp2, { includeEmpty: true });
  $('mvp3Select').innerHTML = playerOptions(state, state.mvp.mvp3, { includeEmpty: true });
}

export function render(state) {
  document.querySelectorAll('.b3-stage').forEach((stage) => stage.classList.toggle('is-hidden', stage.dataset.stage !== state.stage));
  document.querySelectorAll('[data-step-target]').forEach((button) => {
    if (button.dataset.stepTarget === state.stage) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('statusBox').dataset.tone = state.save.status === 'saving' ? 'warning' : state.save.status;
  $('statusText').textContent = state.save.message || 'Готово до роботи';
  $('retryButton').classList.toggle('is-hidden', state.save.status !== 'error' || !state.save.requestId);
  $('retryButton').textContent = state.save.requestId ? 'Перевірити запис' : 'Повторити';
  $('forceRetryButton').classList.toggle('is-hidden', state.save.status !== 'error' || !state.save.canForceRetry);
  $('cancelPendingButton').classList.toggle('is-hidden', state.save.status !== 'error' || !state.save.canForceRetry);
  $('saveGameButton').disabled = state.save.status === 'saving' || !validateMatch(state).ok;
  $('saveGameButton').textContent = state.save.status === 'saving' ? 'Зберігаємо...' : 'Зберегти гру';
  $('leagueSelect').value = state.league;
  $('playerSearch').value = state.search;
  $('playerSort').value = state.sort;
  $('teamCountSelect').value = String(state.teamCount);
  document.querySelectorAll('input[name="balanceMode"]').forEach((input) => { input.checked = input.value === state.balanceMode; });
  const skillPlayers = state.players.filter((player) => player.skillGames > 0).length;
  $('ratingModelNote').textContent = skillPlayers || !state.playersLoaded
    ? 'Автобаланс враховує внутрішню оцінку сили. Офіційні поінти нараховуються за чинною схемою.'
    : 'Історія сили недоступна: нові гравці отримають нейтральну стартову оцінку. Офіційні поінти без змін.';
  renderPlayers(state);
  renderTeams(state);
  renderTeamSelectors(state);
  renderRounds(state);
  renderMatchSummary(state);
  renderMvp(state);
  $('lastSavePanel').classList.toggle('is-hidden', !state.lastSavedGame);
  if (state.lastSavedGame) {
    const time = new Date(state.lastSavedGame.savedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    $('lastSavePanel').textContent = state.lastSavedGame.ratingsRefreshed
      ? `Збережено ${time}. Поінти учасників оновлено.`
      : `Запис підтверджено ${time}. Оновіть поінти за хвилину.`;
  }
}

export function initializeStaticOptions() {
  $('teamCountSelect').innerHTML = Array.from({ length: 11 }, (_, index) => index + 2)
    .map((count) => `<option value="${count}">${count}</option>`).join('');
}

export function showRestoreBanner(draft) {
  $('restoreBanner').classList.remove('is-hidden');
  const selected = selectedPlayers(draft).length;
  $('restoreMeta').textContent = `${selected} гравців · ${draft.teamCount} команд · ${new Date(draft.updatedAt).toLocaleString('uk-UA')}`;
}

export function hideRestoreBanner() {
  $('restoreBanner').classList.add('is-hidden');
}
