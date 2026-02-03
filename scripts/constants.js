export const LEAGUE = (() => {
  const path = location.pathname.toLowerCase();

  if (path.includes('sunday')) return 'sundaygames';
  if (path.includes('old')) return 'sundaygames';
  if (path.includes('kids')) return 'kids';
  if (path.includes('index')) return 'kids';

  return 'kids';
})();
