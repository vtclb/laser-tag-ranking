export function normalizeLeague(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['kids', 'kid', 'child', 'діти'].includes(value)) return 'kids';
  if (['olds', 'old', 'adults', 'sundaygames', 'sunday', 'дорослі'].includes(value)) return 'olds';
  return '';
}

export function leagueLabelUA(league) {
  return normalizeLeague(league) === 'olds' ? 'Доросла ліга' : 'Дитяча ліга';
}

export function leagueShortUA(league) {
  return normalizeLeague(league) === 'olds' ? 'Olds' : 'Kids';
}

export function toDataHubLeague(league) {
  return normalizeLeague(league) === 'olds' ? 'sundaygames' : 'kids';
}

export function fromDataHubLeague(league) {
  return normalizeLeague(league);
}
