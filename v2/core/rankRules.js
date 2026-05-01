export const RANK_THRESHOLDS = [
  ['S', 1200],
  ['A', 1000],
  ['B', 800],
  ['C', 600],
  ['D', 400],
  ['E', 200],
  ['F', 0],
];

export function normalizePoints(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function rankFromPoints(points) {
  const pts = normalizePoints(points);
  const found = RANK_THRESHOLDS.find(([, min]) => pts >= min);
  return found ? found[0] : 'F';
}

export function getNextRankProgress(points) {
  const pts = normalizePoints(points);

  const ascending = [...RANK_THRESHOLDS]
    .sort((a, b) => a[1] - b[1]);

  const currentRank = rankFromPoints(pts);
  const currentIndex = ascending.findIndex(([rank]) => rank === currentRank);
  const next = ascending[currentIndex + 1];

  if (!next) {
    return {
      currentRank,
      nextRank: null,
      currentMin: ascending[currentIndex]?.[1] ?? 0,
      nextMin: null,
      points: pts,
      pointsToNext: 0,
      progress: 1,
      isMaxRank: true
    };
  }

  const currentMin = ascending[currentIndex]?.[1] ?? 0;
  const nextMin = next[1];
  const span = Math.max(nextMin - currentMin, 1);
  const progress = Math.max(0, Math.min(1, (pts - currentMin) / span));

  return {
    currentRank,
    nextRank: next[0],
    currentMin,
    nextMin,
    points: pts,
    pointsToNext: Math.max(0, nextMin - pts),
    progress,
    isMaxRank: false
  };
}
