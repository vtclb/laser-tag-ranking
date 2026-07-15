const VALID_WINNERS = new Set(['team1', 'team2', 'draw', 'tie']);

function normalizeNick(value = '') {
  return String(value || '').trim();
}

function nickKey(value = '') {
  return normalizeNick(value).toLowerCase();
}

function asPlayerNick(player = {}) {
  return normalizeNick(player.nickname || player.nick || player.player || player.Player);
}

function asPlayerPoints(player = {}) {
  return player.points ?? player.Points ?? player.pts ?? player.rating;
}

function gameTeams(game = {}) {
  if (Array.isArray(game.teams)) return game.teams.map(normalizeNick).filter(Boolean);
  return [
    ...(Array.isArray(game.team1) ? game.team1 : []),
    ...(Array.isArray(game.team2) ? game.team2 : []),
    ...(Array.isArray(game.team3) ? game.team3 : []),
    ...(Array.isArray(game.team4) ? game.team4 : [])
  ].map(normalizeNick).filter(Boolean);
}

function gameMvpNicks(game = {}) {
  return [game.mvp, game.mvp1, game.mvp2, game.mvp3]
    .map(normalizeNick)
    .filter(Boolean);
}

function warning(type, message, context = {}, severity = 'warning') {
  return { type, severity, message, context };
}

export function auditLeagueData({ league, players = [], games = [] } = {}) {
  const warnings = [];
  const playerKeys = new Set();
  const seen = new Map();

  (Array.isArray(players) ? players : []).forEach((player, index) => {
    const nick = asPlayerNick(player);
    const key = nickKey(nick);
    if (!nick) {
      warnings.push(warning('UNKNOWN_PLAYER', 'Player row has an empty nickname', { league, index }, 'error'));
      return;
    }

    if (seen.has(key)) {
      warnings.push(warning('DUPLICATE_NICK', `Duplicate nick in ${league}: ${nick}`, {
        league,
        nick,
        firstIndex: seen.get(key),
        index
      }));
    } else {
      seen.set(key, index);
    }
    playerKeys.add(key);

    const points = Number(asPlayerPoints(player));
    if (!Number.isFinite(points)) {
      warnings.push(warning('INVALID_POINTS', `Invalid points for ${nick}`, {
        league,
        nick,
        points: asPlayerPoints(player)
      }, 'error'));
    }
  });

  (Array.isArray(games) ? games : []).forEach((game, index) => {
    const winner = normalizeNick(game.winner).toLowerCase();
    if (winner && !VALID_WINNERS.has(winner)) {
      warnings.push(warning('INVALID_WINNER', `Invalid winner in ${league}: ${winner}`, {
        league,
        index,
        winner
      }, 'error'));
    }

    const participants = gameTeams(game);
    const participantKeys = new Set(participants.map(nickKey));
    participants.forEach((nick) => {
      if (!playerKeys.has(nickKey(nick))) {
        warnings.push(warning('UNKNOWN_PLAYER', `Game participant is not in ${league} roster: ${nick}`, {
          league,
          index,
          nick
        }));
      }
    });

    gameMvpNicks(game).forEach((nick) => {
      if (!participantKeys.has(nickKey(nick))) {
        warnings.push(warning('MVP_NOT_IN_GAME', `MVP is not a participant in ${league}: ${nick}`, {
          league,
          index,
          nick
        }));
      }
    });
  });

  return {
    ok: warnings.length === 0,
    warnings
  };
}
