const LEAGUE_ALIASES = {
  kids: 'kids',
  kid: 'kids',
  junior: 'kids',
  sundaygames: 'sundaygames',
  sunday: 'sundaygames',
  sundaygame: 'sundaygames',
  olds: 'sundaygames',
  adult: 'sundaygames',
  adults: 'sundaygames',
  old: 'sundaygames',
  'старшаліга': 'sundaygames',
  'старша ліга': 'sundaygames'
};

export function normalizeLeague(league) {
  const s = String(league || '').trim().toLowerCase();
  return LEAGUE_ALIASES[s] || 'kids';
}

export const LEAGUE = (() => {
  const path = (typeof location !== 'undefined' && location.pathname)
    ? location.pathname.toLowerCase()
    : '';

  if (path.includes('sunday')) return 'sundaygames';
  if (path.includes('old')) return 'sundaygames';
  if (path.includes('kids')) return 'kids';
  if (path.includes('index')) return 'kids';

  return 'kids';
})();
