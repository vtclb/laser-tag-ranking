import { TEAM_KEYS, getPlayerKey } from './state.js';
import {
  normalizeSchoolMeta,
  createSchoolEventDraft,
  calculateSchoolGroupStandings,
  calculateSchoolRoundRobinStandings,
} from './schoolMode.js';

export function buildSchoolEventPayload(currentState) {
  const now = new Date().toISOString();
  if (!currentState.schoolState.eventId) currentState.schoolState.eventId = createSchoolEventDraft().eventId;
  const activeKeys = TEAM_KEYS.slice(0, 10);
  const playersMap = new Map((currentState.playersState.players || []).map((p) => [getPlayerKey(p), p]));
  const teams = activeKeys.map((teamKey, idx) => {
    const meta = normalizeSchoolMeta(currentState.schoolState.teamMeta?.[teamKey] || { teamName: `Команда ${idx + 1}` });
    const players = (currentState.teamsState.teams[teamKey] || []).map((playerKey) => ({ id: playerKey, nick: String(playersMap.get(playerKey)?.nick || playerKey || '').trim() }));
    const strengthPoints = players.reduce((acc, p) => acc + (Number(playersMap.get(p.id)?.points ?? playersMap.get(p.id)?.pts) || 0), 0);
    return { id: teamKey, teamKey, teamName: meta.teamName, schoolName: meta.schoolName, schoolNumber: meta.schoolNumber, players, strengthPoints };
  });
  const groups = currentState.schoolState.groups || { A: { id: 'A', name: 'Група A', teamIds: [] }, B: { id: 'B', name: 'Група B', teamIds: [] } };
  const groupMatches = Array.isArray(currentState.schoolState.groupMatches) ? currentState.schoolState.groupMatches : [];
  const qualifiers = currentState.schoolState.qualifiers || { A: [], B: [] };
  const wildcard = currentState.schoolState.wildcard || { enabled: false, teamId: '', selectedByAdmin: false, reason: '' };
  const finalGroup = currentState.schoolState.finalGroup || { id: 'FINAL', name: 'Фінальна група', teamIds: [], matches: [] };
  const groupStandings = { A: calculateSchoolGroupStandings(teams, groupMatches, 'A'), B: calculateSchoolGroupStandings(teams, groupMatches, 'B') };
  const finalStandings = calculateSchoolRoundRobinStandings(teams.filter((t) => (finalGroup.teamIds || []).includes(t.id)), finalGroup.matches || []);
  const finalCompleted = (finalGroup.matches || []).length > 0 && (finalGroup.matches || []).every((m) => m.status === 'completed');
  const championTeamId = finalCompleted && finalStandings[0] ? finalStandings[0].teamId : '';
  return {
    eventId: currentState.schoolState.eventId,
    eventMode: 'school',
    format: 'school_groups_final',
    scoringMode: 'manualPoints',
    affectsPlayerRating: false,
    title: String(currentState.schoolState.title || 'Шкільний турнір').trim(),
    date: String(currentState.schoolState.date || now.slice(0, 10)).trim(),
    status: currentState.schoolState.status || 'draft',
    teams,
    groups,
    groupMatches,
    groupStandings,
    qualifiers,
    wildcard,
    finalGroup: { ...finalGroup, standings: finalStandings, championTeamId },
    championTeamId,
    changeLog: Array.isArray(currentState.schoolState.changeLog) ? currentState.schoolState.changeLog : [],
    createdAt: currentState.schoolState.createdAt || now,
    updatedAt: now,
  };
}
