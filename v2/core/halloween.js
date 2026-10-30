export function parseHalloween(data) {
  if (data?.kind !== 'varta-halloween-results' || data.schemaVersion !== 1 || !Array.isArray(data.players) || data.players.length > 100 || !['pending','open','final'].includes(data.status)) throw Error('Невірний формат результатів Halloween');
  const text = v => String(v ?? '').slice(0,160);
  const number = v => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1_000_000_000) throw Error('Некоректна числова статистика'); return v; };
  const safeImage = value => { try {const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';}catch{return '';} };
  const ids = new Set();
  const players = data.players.map(p => {
    const participantId = text(p.participantId);
    if (!participantId || ids.has(participantId)) throw Error('Дублікати учасників Halloween'); ids.add(participantId);
    const figures = Object.fromEntries(Object.entries(p.figures || {}).map(([k,v]) => [text(k),number(v)]));
    const list = values => { if (!Array.isArray(values) || values.length > 1000) throw Error('Некоректна колекція'); return values.map(text); };
    const league = ['kids','sundaygames'].includes(p.league) ? p.league : '';
    const nickname = text(p.nickname);
    // Rebuild profile links from public identity, never trust an exported URL.
    const profileUrl = p.playerId && league ? `#player?${new URLSearchParams({league,nick:nickname})}` : '';
    return { participantId, nickname, league, profileUrl, avatarUrl:safeImage(p.avatarUrl), place:number(p.place), points:number(p.points), figures, figureCount:number(p.figureCount), kinds:Object.values(figures).filter(n=>n>0).length, fullSets:number(p.fullSets), artifacts:list(p.artifacts), coinBalance:number(p.coinBalance), wins:number(p.wins), errors:number(p.errors || 0), awards:list(p.awards) };
  });
  players.sort((a,b)=>a.place-b.place||a.nickname.localeCompare(b.nickname,'uk'));
  return { schemaVersion:1,kind:'varta-halloween-results',eventId:text(data.eventId),title:text(data.title),status:data.status,revision:number(data.revision),preliminaryFormula:Boolean(data.preliminaryFormula),exportedAt:text(data.exportedAt),players };
}
