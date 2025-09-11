// scripts/rankUtils.js (ESM)
export function rankLetterForPoints(p) {
  p = Number(p) || 0;
  if (p >= 1200) return 'S';
  if (p >= 1000) return 'A';
  if (p >= 800)  return 'B';
  if (p >= 600)  return 'C';
  if (p >= 400)  return 'D';
  if (p >= 200)  return 'E';
  return 'F';
}
