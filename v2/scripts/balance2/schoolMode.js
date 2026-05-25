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

export function createSchoolEventDraft() {
  const now = nowIso();
  const stamp = now.replaceAll('-', '').replaceAll(':', '').replace('T', '_').slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 6);
  return {
    eventId: `school_${stamp}_${rand}`,
    eventMode: 'school',
    scoringMode: 'manualPoints',
    affectsPlayerRating: false,
    title: 'Шкільний турнір',
    date: now.slice(0, 10),
    status: 'draft',
    teams: [],
    battles: [],
    standings: [],
    changeLog: [],
    createdAt: now,
    updatedAt: now,
  };
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
