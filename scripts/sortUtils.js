export function sortByName(arr) {
  return [...arr].sort((a,b)=>a.nick.localeCompare(b.nick));
}
export function sortByPtsDesc(arr) {
  return [...arr].sort((a,b)=>b.pts - a.pts);
}
