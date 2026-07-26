function defaultPlayerKey(playerOrKey) {
  if (typeof playerOrKey === 'string') return playerOrKey;
  if (!playerOrKey || typeof playerOrKey !== 'object') return '';
  return String(playerOrKey.uid || playerOrKey.id || playerOrKey.nick || playerOrKey.name || '').trim();
}

function pointsOf(player) {
  return Number(player?.points ?? player?.pts) || 0;
}

export function snapshotPlayerPoints(players = [], getKey = defaultPlayerKey) {
  return Object.fromEntries(players
    .map((player) => [getKey(player), pointsOf(player)])
    .filter(([key]) => key));
}

export function snapshotTeamTotals(teams = {}, pointsByKey = {}) {
  return Object.fromEntries(Object.entries(teams).map(([teamId, playerKeys]) => [
    teamId,
    (Array.isArray(playerKeys) ? playerKeys : [])
      .reduce((total, playerKey) => total + (Number(pointsByKey[playerKey]) || 0), 0),
  ]));
}

export function getBalanceSpread(teamTotals = {}) {
  const totals = Object.values(teamTotals).map(Number).filter(Number.isFinite);
  return totals.length > 1 ? Math.max(...totals) - Math.min(...totals) : 0;
}

export function buildRatingReconciliation({
  beforePoints = {},
  afterPlayers = [],
  participantKeys = [],
  teams = {},
  beforeTeamTotals = {},
  getKey = defaultPlayerKey,
} = {}) {
  const afterPoints = snapshotPlayerPoints(afterPlayers, getKey);
  const afterPlayersByKey = new Map(afterPlayers.map((player) => [getKey(player), player]));
  const uniqueParticipants = [...new Set(participantKeys.filter(Boolean))];
  const changes = uniqueParticipants.map((playerKey) => {
    const before = Number(beforePoints[playerKey]) || 0;
    const after = Number(afterPoints[playerKey] ?? before) || 0;
    const player = afterPlayersByKey.get(playerKey);
    return {
      playerKey,
      nick: String(player?.nick || playerKey),
      before,
      after,
      delta: after - before,
    };
  });
  const afterTeamTotals = snapshotTeamTotals(teams, afterPoints);
  const teamChanges = Object.keys(teams).map((teamId) => {
    const before = Number(beforeTeamTotals[teamId]) || 0;
    const after = Number(afterTeamTotals[teamId]) || 0;
    return { teamId, before, after, delta: after - before };
  });

  return {
    confirmed: changes.some((change) => change.delta !== 0),
    changes,
    changedPlayers: changes.filter((change) => change.delta !== 0),
    teamChanges,
    beforeSpread: getBalanceSpread(beforeTeamTotals),
    afterSpread: getBalanceSpread(afterTeamTotals),
  };
}
