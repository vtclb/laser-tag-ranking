export function normalizeLeagueKey(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'olds') return 'sundaygames';
  if (s === 'sunday') return 'sundaygames';
  if (s === 'adult') return 'sundaygames';
  return s;
}

export function normalizeLeague(input) {
  const value = normalizeLeagueKey(input);
  if (['kids', 'kid', 'child', 'діти', 'дитяча'].includes(value)) return 'kids';
  if (['sundaygames', 'old', 'adults', 'дорослі', 'доросла'].includes(value)) return 'sundaygames';
  return '';
}

export function normalizeLeagueSummary(summary = {}) {
  const source = (summary && typeof summary === 'object') ? summary : {};
  const normalized = { kids: {}, sundaygames: {} };
  Object.entries(source).forEach(([key, value]) => {
    const league = normalizeLeague(key);
    if (!league) return;
    normalized[league] = (value && typeof value === 'object') ? value : {};
  });
  return normalized;
}

export function leagueLabelUA(league) {
  return normalizeLeague(league) === 'sundaygames' ? 'Доросла ліга' : 'Дитяча ліга';
}

export function toDataHubLeague(league) {
  return normalizeLeague(league) === 'sundaygames' ? 'sundaygames' : 'kids';
}
