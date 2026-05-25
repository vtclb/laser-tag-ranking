import { getEventModeLimits } from './config.js';

function nowIso() { return new Date().toISOString(); }

export function normalizeSchoolMeta(input = {}) {
  const teamName = String(input.teamName || '').trim() || 'Команда';
  const schoolName = String(input.schoolName || '').trim();
  const schoolNumberRaw = String(input.schoolNumber ?? '').trim();
  return {
    teamName,
    schoolName,
    schoolNumber: schoolNumberRaw,
  };
}

export function formatSchoolDisplay(meta = {}, fallbackTeamName = 'Команда') {
  const normalized = normalizeSchoolMeta({ ...meta, teamName: meta?.teamName || fallbackTeamName });
  const schoolPrefix = normalized.schoolNumber
    ? `Школа №${normalized.schoolNumber}`
    : 'Без номера';
  const schoolLabel = normalized.schoolName ? `${schoolPrefix} · ${normalized.schoolName}` : `${schoolPrefix} · Без назви`;
  return {
    schoolLabel,
    teamLabel: normalized.teamName || fallbackTeamName,
  };
}

export function normalizeManualPoints(value) {
  const limits = getEventModeLimits('school');
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < limits.minManualPoints || parsed > limits.maxManualPoints) return null;
  return parsed;
}

export function balanceIntoSchoolTeams(players = []) {
  const limits = getEventModeLimits('school');
  const teamCount = limits.maxTeams;
  const sorted = [...players].sort((a, b) => ((Number(b.pts ?? b.points) || 0) - (Number(a.pts ?? a.points) || 0)));
  const teams = Object.fromEntries(Array.from({ length: teamCount }, (_, i) => [`team${i + 1}`, []]));
  const targets = Array.from({ length: teamCount }, (_, i) => Math.floor(sorted.length / teamCount) + (i < sorted.length % teamCount ? 1 : 0));
  const sum = (arr) => arr.reduce((acc, p) => acc + (Number(p.pts ?? p.points) || 0), 0);
  sorted.forEach((player) => {
    const idx = Array.from({ length: teamCount }, (_, i) => i)
      .filter((i) => teams[`team${i + 1}`].length < targets[i])
      .sort((a, b) => sum(teams[`team${a + 1}`]) - sum(teams[`team${b + 1}`]))[0] ?? 0;
    teams[`team${idx + 1}`].push(player);
  });
  return teams;
}

export function generateSchoolGroups(teamKeys = []) {
  const clean = [...new Set(teamKeys)].filter((k) => /^team([1-9]|10)$/.test(k));
  const ordered = clean.sort((a, b) => Number(a.replace('team', '')) - Number(b.replace('team', '')));
  return {
    A: { id: 'A', name: 'Група A', teamIds: ordered.filter((_, idx) => idx % 2 === 0).slice(0, 5) },
    B: { id: 'B', name: 'Група B', teamIds: ordered.filter((_, idx) => idx % 2 === 1).slice(0, 5) },
  };
}

export function createSchoolEventDraft() {
  const now = nowIso();
  const stamp = now.replaceAll('-', '').replaceAll(':', '').replace('T', '_').slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 6);
  return {
    eventId: `school_${stamp}_${rand}`,
    format: 'school_groups_final',
    eventMode: 'school',
    scoringMode: 'manualPoints',
    affectsPlayerRating: false,
    title: 'Шкільний турнір',
    date: now.slice(0, 10),
    status: 'draft',
    teams: [],
    groups: { A: { id: 'A', name: 'Група A', teamIds: [] }, B: { id: 'B', name: 'Група B', teamIds: [] } },
    groupMatches: [],
    groupStandings: { A: [], B: [] },
    qualifiers: { A: [], B: [] },
    wildcard: { enabled: false, teamId: '', selectedByAdmin: false, reason: '' },
    finalGroup: { id: 'FINAL', name: 'Фінальна група', teamIds: [], matches: [], standings: [], championTeamId: '' },
    championTeamId: '',
    changeLog: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function generateRoundRobinMatches(teamIds = [], { stage = 'group', groupId = 'A', titlePrefix = 'Група A' } = {}) {
  const now = nowIso();
  const matches = [];
  let matchIndex = 1;
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      matches.push({
        id: `${stage}_${groupId}_${teamIds[i]}_${teamIds[j]}`,
        stage,
        groupId,
        title: `${titlePrefix} · Матч ${matchIndex}`,
        matchIndex,
        teamAId: teamIds[i],
        teamBId: teamIds[j],
        status: 'pending',
        result: { teamAId: teamIds[i], teamBId: teamIds[j], pointsA: null, pointsB: null, winnerTeamId: '', isDraw: false },
        createdAt: now,
        updatedAt: now,
      });
      matchIndex += 1;
    }
  }
  return matches;
}

export function calculateSchoolRoundRobinStandings(teams = [], matches = []) {
  const map = new Map(teams.map((t) => [t.id, { place: 0, teamId: t.id, teamName: t.teamName || 'Команда', schoolName: t.schoolName || '', schoolNumber: t.schoolNumber || '', matchesPlayed: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointsDiff: 0, tournamentPoints: 0, averagePointsFor: 0, bestMatchPoints: 0 }]));
  matches.forEach((m) => {
    if (m?.status !== 'completed') return;
    const a = map.get(m.teamAId); const b = map.get(m.teamBId);
    const pa = Number(m?.result?.pointsA); const pb = Number(m?.result?.pointsB);
    if (!a || !b || !Number.isInteger(pa) || !Number.isInteger(pb)) return;
    a.matchesPlayed += 1; b.matchesPlayed += 1;
    a.pointsFor += pa; a.pointsAgainst += pb; b.pointsFor += pb; b.pointsAgainst += pa;
    a.bestMatchPoints = Math.max(a.bestMatchPoints, pa); b.bestMatchPoints = Math.max(b.bestMatchPoints, pb);
    if (pa > pb) { a.wins += 1; b.losses += 1; a.tournamentPoints += 3; }
    else if (pb > pa) { b.wins += 1; a.losses += 1; b.tournamentPoints += 3; }
    else { a.draws += 1; b.draws += 1; a.tournamentPoints += 1; b.tournamentPoints += 1; }
  });
  const rows = [...map.values()].map((r) => ({ ...r, pointsDiff: r.pointsFor - r.pointsAgainst, averagePointsFor: r.matchesPlayed ? Number((r.pointsFor / r.matchesPlayed).toFixed(2)) : 0 }));
  rows.sort((a, b) => b.tournamentPoints - a.tournamentPoints || b.wins - a.wins || b.pointsDiff - a.pointsDiff || b.pointsFor - a.pointsFor || b.bestMatchPoints - a.bestMatchPoints || String(a.schoolNumber).localeCompare(String(b.schoolNumber), 'uk') || String(a.schoolName).localeCompare(String(b.schoolName), 'uk') || String(a.teamName).localeCompare(String(b.teamName), 'uk'));
  return rows.map((row, idx) => ({ ...row, place: idx + 1 }));
}

export function calculateSchoolGroupStandings(teams = [], groupMatches = [], groupId = 'A') {
  const groupTeamIds = new Set(groupMatches.filter((m) => m.groupId === groupId).flatMap((m) => [m.teamAId, m.teamBId]));
  return calculateSchoolRoundRobinStandings(teams.filter((t) => groupTeamIds.has(t.id)), groupMatches.filter((m) => m.groupId === groupId));
}

export function refreshFinalGroupDerivedState(schoolState = {}, teams = []) {
  const finalGroup = schoolState.finalGroup || { teamIds: [], matches: [] };
  const teamIds = Array.isArray(finalGroup.teamIds) ? finalGroup.teamIds : [];
  const finalTeams = (teams || []).filter((t) => teamIds.includes(t.id));
  const matches = Array.isArray(finalGroup.matches) ? finalGroup.matches : [];
  const standings = calculateSchoolRoundRobinStandings(finalTeams, matches);
  const allCompleted = matches.length > 0 && matches.every((m) => m?.status === 'completed');
  const championTeamId = allCompleted && standings[0] ? standings[0].teamId : '';
  schoolState.finalGroup.standings = standings;
  schoolState.finalGroup.championTeamId = championTeamId;
  schoolState.championTeamId = championTeamId;
  return { standings, championTeamId, allCompleted };
}

export function getFinalGroupProgress(matches = []) {
  const all = Array.isArray(matches) ? matches : [];
  const completed = all.filter((m) => m?.status === 'completed').length;
  return { completed, total: all.length };
}

export function calculateSchoolStandings(teams = [], battles = []) {
  const map = new Map(teams.map((team) => [team.id, {
    teamId: team.id,
    teamName: team.teamName || 'Команда',
    schoolName: team.schoolName || '',
    schoolNumber: team.schoolNumber || 'Без номера',
    playersCount: Array.isArray(team.players) ? team.players.length : 0,
    battlesPlayed: 0,
    totalPoints: 0,
    averagePoints: 0,
    bestBattlePoints: 0,
    worstBattlePoints: 0,
    winsByBattle: 0,
    zeroPointBattles: 0,
    _points: [],
  }]));

  battles.forEach((battle) => {
    const results = Array.isArray(battle?.results) ? battle.results : [];
    const valid = results.filter((result) => map.has(result.teamId) && Number.isInteger(result.points));
    if (!valid.length) return;
    const maxPoints = Math.max(...valid.map((r) => r.points));
    valid.forEach((result) => {
      const row = map.get(result.teamId);
      row.battlesPlayed += 1;
      row.totalPoints += result.points;
      row._points.push(result.points);
      if (result.points === 0) row.zeroPointBattles += 1;
      if (result.points === maxPoints) row.winsByBattle += 1;
    });
  });

  const rows = [...map.values()].map((row) => {
    const pts = row._points;
    row.bestBattlePoints = pts.length ? Math.max(...pts) : 0;
    row.worstBattlePoints = pts.length ? Math.min(...pts) : 0;
    row.averagePoints = row.battlesPlayed ? Number((row.totalPoints / row.battlesPlayed).toFixed(2)) : 0;
    delete row._points;
    return row;
  });

  rows.sort((a, b) => (
    b.totalPoints - a.totalPoints
    || b.winsByBattle - a.winsByBattle
    || b.averagePoints - a.averagePoints
    || b.bestBattlePoints - a.bestBattlePoints
    || a.zeroPointBattles - b.zeroPointBattles
    || String(a.schoolNumber || '').localeCompare(String(b.schoolNumber || ''), 'uk')
    || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'uk')
    || String(a.teamName || '').localeCompare(String(b.teamName || ''), 'uk')
  ));

  return rows.map((row, index) => ({ ...row, place: index + 1 }));
}


export function getSchoolGroupProgress(groupMatches = []) {
  const matches = Array.isArray(groupMatches) ? groupMatches : [];
  const completedTotal = matches.filter((m) => m?.status === 'completed').length;
  const completedA = matches.filter((m) => m?.groupId === 'A' && m?.status === 'completed').length;
  const completedB = matches.filter((m) => m?.groupId === 'B' && m?.status === 'completed').length;
  return { completedTotal, total: 20, completedA, totalA: 10, completedB, totalB: 10 };
}

export function canFormSchoolFinalGroup(schoolState = {}) {
  const matches = Array.isArray(schoolState.groupMatches) ? schoolState.groupMatches : [];
  const completedAll = matches.length === 20 && matches.every((m) => m?.status === 'completed');
  const rowsA = Array.isArray(schoolState?.groupStandings?.A) ? schoolState.groupStandings.A : [];
  const rowsB = Array.isArray(schoolState?.groupStandings?.B) ? schoolState.groupStandings.B : [];
  return completedAll && rowsA.length >= 5 && rowsB.length >= 5;
}

export function buildFinalGroupFromStandings(schoolState = {}) {
  const topA = (schoolState?.groupStandings?.A || []).slice(0, 2).map((row) => row.teamId).filter(Boolean);
  const topB = (schoolState?.groupStandings?.B || []).slice(0, 2).map((row) => row.teamId).filter(Boolean);
  return {
    qualifiers: { A: topA, B: topB },
    teamIds: [...topA, ...topB],
  };
}

export function getWildcardCandidates(schoolState = {}) {
  const qualifiers = new Set([...(schoolState?.qualifiers?.A || []), ...(schoolState?.qualifiers?.B || [])]);
  return ['A', 'B']
    .flatMap((groupId) => (schoolState?.groupStandings?.[groupId] || []).map((row) => ({ ...row, groupId })))
    .filter((row) => row?.teamId && !qualifiers.has(row.teamId));
}

export function pickBestWildcardCandidate(candidates = []) {
  const sorted = [...candidates].sort((a, b) => (
    (b.tournamentPoints || 0) - (a.tournamentPoints || 0)
    || (b.wins || 0) - (a.wins || 0)
    || (b.pointsDiff || 0) - (a.pointsDiff || 0)
    || (b.pointsFor || 0) - (a.pointsFor || 0)
    || (a.place || 999) - (b.place || 999)
    || String(a.schoolNumber || '').localeCompare(String(b.schoolNumber || ''), 'uk')
    || String(a.schoolName || '').localeCompare(String(b.schoolName || ''), 'uk')
    || String(a.teamName || '').localeCompare(String(b.teamName || ''), 'uk')
  ));
  return sorted[0] || null;
}

export function getSchoolWorkflowStage(schoolState = {}) {
  if (!schoolState || typeof schoolState !== 'object') return 'setup';
  const teams = Array.isArray(schoolState.teams) ? schoolState.teams : [];
  const hasTeams = teams.length > 0;
  if (!hasTeams) return 'setup';
  const groupA = schoolState?.groups?.A?.teamIds || [];
  const groupB = schoolState?.groups?.B?.teamIds || [];
  if (!groupA.length && !groupB.length) return 'teams';
  const groupMatches = Array.isArray(schoolState.groupMatches) ? schoolState.groupMatches : [];
  if (!groupMatches.length) return 'groups';
  const groupAllCompleted = groupMatches.length > 0 && groupMatches.every((m) => m?.status === 'completed');
  if (!groupAllCompleted) return 'group_matches';
  const finalIds = Array.isArray(schoolState?.finalGroup?.teamIds) ? schoolState.finalGroup.teamIds : [];
  if (!finalIds.length) return 'final_group';
  const finalMatches = Array.isArray(schoolState?.finalGroup?.matches) ? schoolState.finalGroup.matches : [];
  const finalAllCompleted = finalMatches.length > 0 && finalMatches.every((m) => m?.status === 'completed');
  if (!finalAllCompleted) return 'final_matches';
  return schoolState.championTeamId || schoolState?.finalGroup?.championTeamId ? 'completed' : 'final_matches';
}
