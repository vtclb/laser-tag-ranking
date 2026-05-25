import { TEAM_KEYS, getPlayerKey } from './state.js';
import { calculateSchoolStandings, normalizeSchoolMeta, createSchoolEventDraft } from './schoolMode.js';

export function buildSchoolEventPayload(currentState) {
  const now = new Date().toISOString();
  if (!currentState.schoolState.eventId) currentState.schoolState.eventId = createSchoolEventDraft().eventId;
  const activeKeys = TEAM_KEYS.slice(0, currentState.teamsState.teamCount).filter((k) => (currentState.teamsState.teams[k] || []).length > 0);
  const playersMap = new Map((currentState.playersState.players || []).map((p) => [getPlayerKey(p), p]));
  const teams = activeKeys.map((teamKey, idx) => {
    const meta = normalizeSchoolMeta(currentState.schoolState.teamMeta?.[teamKey] || { teamName: `Команда ${idx + 1}` });
    const players = (currentState.teamsState.teams[teamKey] || []).map((playerKey) => ({ id: playerKey, nick: String(playersMap.get(playerKey)?.nick || playerKey || '').trim() }));
    return { id: teamKey, teamKey, teamName: meta.teamName, schoolName: meta.schoolName, schoolNumber: meta.schoolNumber, players };
  });
  const battles = Array.isArray(currentState.schoolState.battles) ? currentState.schoolState.battles : [];
  const standings = calculateSchoolStandings(teams, battles);
  return {
    eventId: currentState.schoolState.eventId,
    eventMode: 'school',
    scoringMode: 'manualPoints',
    affectsPlayerRating: false,
    title: String(currentState.schoolState.title || 'Шкільний турнір').trim(),
    date: String(currentState.schoolState.date || now.slice(0, 10)).trim(),
    status: currentState.schoolState.status || 'draft',
    teams, battles, standings,
    changeLog: Array.isArray(currentState.schoolState.changeLog) ? currentState.schoolState.changeLog : [],
    createdAt: currentState.schoolState.createdAt || now,
    updatedAt: now,
  };
}
