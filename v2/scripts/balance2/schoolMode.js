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
