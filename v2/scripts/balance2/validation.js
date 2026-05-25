import { getEventModeLimits } from './config.js';
import { normalizeManualPoints } from './schoolMode.js';

export function validateSchoolEvent(eventState = {}) {
  return validateSchoolTournament(eventState);
}

export function validateSchoolTournament(eventState = {}) {
  const errors = [];
  const limits = getEventModeLimits('school');
  if (eventState.eventMode !== 'school') errors.push('Подія має бути в режимі school.');
  if (!eventState.eventId) errors.push('Не можна зберегти: відсутній eventId.');
  if (!String(eventState.title || '').trim()) errors.push('Не можна зберегти: назва події порожня.');
  if ((eventState.players || []).length > limits.maxPlayers) errors.push(`Не можна зберегти: гравців більше ${limits.maxPlayers}.`);
  if ((eventState.teams || []).length !== limits.maxTeams) errors.push(`Потрібно рівно ${limits.maxTeams} команд.`);
  if (eventState.format !== 'school_groups_final') errors.push('Формат має бути school_groups_final.');
  if (eventState.affectsPlayerRating !== false) errors.push('School event не може впливати на рейтинг гравців.');

  const teamIds = new Set();
  (eventState.teams || []).forEach((team, index) => {
    if (!team?.id) errors.push(`Команда #${index + 1} не має id.`);
    if (teamIds.has(team?.id)) errors.push(`Duplicate team id: ${team?.id}.`);
    teamIds.add(team?.id);
    if (!String(team?.schoolName || '').trim()) errors.push(`Команда ${team?.teamName || index + 1}: порожня назва школи.`);
  });

  const groups = eventState.groups || {};
  if ((groups.A?.teamIds || []).length !== 5) errors.push('Група A має містити рівно 5 команд.');
  if ((groups.B?.teamIds || []).length !== 5) errors.push('Група B має містити рівно 5 команд.');

  (eventState.groupMatches || []).forEach((match) => {
    if (!match?.teamAId || !match?.teamBId || match.teamAId === match.teamBId) errors.push(`Матч ${match?.title || match?.id || ''} має некоректні команди.`);
    if (match.status === 'completed') {
      if (normalizeManualPoints(match?.result?.pointsA) === null || normalizeManualPoints(match?.result?.pointsB) === null) errors.push(`Матч ${match?.title || match?.id || ''} має некоректні бали.`);
    }
  });

  const finalIds = eventState.finalGroup?.teamIds || [];
  if (![4, 5].includes(finalIds.length)) errors.push('Фінальна група має містити 4 або 5 команд.');
  const qualifiersA = eventState.qualifiers?.A || [];
  const qualifiersB = eventState.qualifiers?.B || [];
  const qualifierSet = new Set([...qualifiersA, ...qualifiersB]);
  const wildcard = eventState.wildcard || {};
  if (wildcard.enabled) {
    if (!wildcard.teamId) errors.push('Увімкнений wildcard має містити teamId.');
    if (qualifierSet.has(wildcard.teamId)) errors.push('Wildcard команда не може бути direct qualifier.');
    if (!finalIds.includes(wildcard.teamId)) errors.push('Wildcard команда має входити до finalGroup.teamIds.');
  }
  if ((eventState.finalGroup?.matches || []).some((match) => match.status === 'completed' && (normalizeManualPoints(match?.result?.pointsA) === null || normalizeManualPoints(match?.result?.pointsB) === null))) {
    errors.push('Фінальні матчі мають некоректні бали.');
  }

  return { ok: errors.length === 0, errors };
}
