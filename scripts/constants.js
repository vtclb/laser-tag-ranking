import { normalizeLeague } from './api.js';

export const LEAGUE = (() => {
  const path = location.pathname.toLowerCase();
  const params = new URLSearchParams(location.search);
  const queryLeague = params.get('league');
  if (queryLeague) return normalizeLeague(queryLeague);

  if (path.includes('sunday')) return 'sundaygames';
  if (path.includes('old')) return 'sundaygames';
  if (path.includes('kids')) return 'kids';
  if (path.includes('index')) return 'kids';

  return normalizeLeague('');
})();
