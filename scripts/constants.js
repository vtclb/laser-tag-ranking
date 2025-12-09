export const LEAGUE = location.pathname.endsWith('sunday.html') ? 'sundaygames' : 'kids';
export const LEAGUE = (() => {
  const path = location.pathname.toLowerCase();

  if (path.includes('sunday')) return 'sundaygames';
  if (path.includes('old')) return 'olds';
  if (path.includes('kids')) return 'kids';
  if (path.includes('index')) return 'kids';

  return 'kids';
})();

