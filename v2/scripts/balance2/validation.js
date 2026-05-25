import { getEventModeLimits } from './config.js';
import { normalizeManualPoints, calculateSchoolStandings } from './schoolMode.js';

export function validateSchoolEvent(eventState = {}) {
  const errors = [];
  const limits = getEventModeLimits('school');
  if (eventState.eventMode !== 'school') errors.push('Подія має бути в режимі school.');
  if (!eventState.eventId) errors.push('Не можна зберегти: відсутній eventId.');
  if (!String(eventState.title || '').trim()) errors.push('Не можна зберегти: назва події порожня.');
  if ((eventState.players || []).length > limits.maxPlayers) errors.push(`Не можна зберегти: гравців більше ${limits.maxPlayers}.`);
  if ((eventState.teams || []).length > limits.maxTeams) errors.push(`Не можна зберегти: команд більше ${limits.maxTeams}.`);
  if ((eventState.teams || []).length < 2) errors.push('Не можна зберегти: потрібно мінімум 2 команди.');
  if (eventState.affectsPlayerRating !== false) errors.push('School event не може впливати на рейтинг гравців.');

  const teamIds = new Set();
  (eventState.teams || []).forEach((team, index) => {
    if (!team?.id) errors.push(`Команда #${index + 1} не має id.`);
    if (teamIds.has(team?.id)) errors.push(`Duplicate team id: ${team?.id}.`);
    teamIds.add(team?.id);
    if (!String(team?.schoolName || '').trim()) errors.push(`Команда ${team?.teamName || index + 1}: порожня назва школи.`);
  });

  (eventState.battles || []).forEach((battle, index) => {
    if (!battle?.id) errors.push(`Бій #${index + 1} не має id.`);
    if (!Array.isArray(battle?.results) || battle.results.length < 2) errors.push(`Бій #${index + 1} має містити мінімум 2 результати.`);
    const inBattle = new Set();
    (battle?.results || []).forEach((result) => {
      if (!result?.teamId) errors.push(`Бій #${index + 1}: teamId обов'язковий.`);
      if (inBattle.has(result?.teamId)) errors.push(`Бій #${index + 1}: дубль teamId ${result?.teamId}.`);
      inBattle.add(result?.teamId);
      if (normalizeManualPoints(result?.points) === null) errors.push(`Бій #${index + 1}: некоректні бали для команди ${result?.teamId}.`);
    });
  });

  const calculated = calculateSchoolStandings(eventState.teams || [], eventState.battles || []);
  if (!Array.isArray(eventState.standings) || eventState.standings.length !== calculated.length) {
    errors.push('Standings не перераховані після останньої зміни.');
  }

  return { ok: errors.length === 0, errors };
}
