export function normalizeLeague(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['kids', 'kid', 'child', 'діти', 'дитяча'].includes(value)) return 'kids';
  if (['sundaygames', 'sunday', 'olds', 'old', 'adults', 'adult', 'дорослі', 'доросла'].includes(value)) return 'sundaygames';
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
