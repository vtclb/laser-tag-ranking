/** Сортування А→Я */
export function sortByName(players) {
  return [...players].sort((a,b)=>a.nick.localeCompare(b.nick,'uk'));
}
/** Сортування за балами ↓ */
export function sortByPtsDesc(players) {
  return [...players].sort((a,b)=>b.pts - a.pts);
}
