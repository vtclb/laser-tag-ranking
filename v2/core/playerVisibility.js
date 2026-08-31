const HIDDEN_PUBLIC_PLAYER_KEYS = new Set(['bogd']);

export function normalizeVisibilityNick(value = '') {
  return String(value || '').trim().toLocaleLowerCase('uk-UA');
}

export function isHiddenPublicNick(value = '') {
  return HIDDEN_PUBLIC_PLAYER_KEYS.has(normalizeVisibilityNick(value));
}

export function playerVisibilityNick(player = {}) {
  return player?.nickname ?? player?.nick ?? player?.Nickname ?? player?.Nick ?? '';
}

export function isPublicPlayer(player = {}) {
  return !isHiddenPublicNick(playerVisibilityNick(player));
}

export function filterPublicPlayers(players = []) {
  return (Array.isArray(players) ? players : []).filter(isPublicPlayer);
}

export function rerankPublicPlayers(players = []) {
  return filterPublicPlayers(players).map((player, index) => ({
    ...player,
    place: index + 1,
    finalPlace: index + 1
  }));
}

export function findExactHiddenPlayer(players = [], query = '') {
  const key = normalizeVisibilityNick(query);
  if (!key || !HIDDEN_PUBLIC_PLAYER_KEYS.has(key)) return null;
  return (Array.isArray(players) ? players : []).find((player) => (
    normalizeVisibilityNick(playerVisibilityNick(player)) === key
  )) || null;
}
