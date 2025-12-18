'use strict';

const FALLBACK = '—';

function normName(value, aliasMap = {}) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lookup = trimmed.toLowerCase();
  for (const [canonicalRaw, aliases] of Object.entries(aliasMap ?? {})) {
    const canonical = typeof canonicalRaw === 'string' ? canonicalRaw.trim() : '';
    if (!canonical) {
      continue;
    }
    if (canonical.toLowerCase() === lookup) {
      return canonical;
    }
    if (
      Array.isArray(aliases) &&
      aliases.some((alias) => typeof alias === 'string' && alias.trim().toLowerCase() === lookup)
    ) {
      return canonical;
    }
  }

  return trimmed;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveCanonicalNickname(nickname, aliasMap = {}) {
  const original = typeof nickname === 'string' ? nickname.trim() : '';
  if (!original) {
    return '';
  }

  const lookup = original.toLowerCase();
  for (const [canonicalRaw, aliases] of Object.entries(aliasMap ?? {})) {
    const canonical = typeof canonicalRaw === 'string' ? canonicalRaw.trim() : '';
    if (!canonical) {
      continue;
    }
    if (canonical.toLowerCase() === lookup) {
      return canonical;
    }
    if (
      Array.isArray(aliases) &&
      aliases.some(
        (alias) => typeof alias === 'string' && alias.trim().toLowerCase() === lookup
      )
    ) {
      return canonical;
    }
  }

  return original;
}

function getNicknameVariants(nickname, aliasMap = {}) {
  const variants = new Set();
  const canonical = resolveCanonicalNickname(nickname, aliasMap);
  const aliasList =
    canonical && aliasMap && Array.isArray(aliasMap[canonical]) ? aliasMap[canonical] : [];

  [nickname, canonical, ...(aliasList ?? [])].forEach((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        variants.add(trimmed);
      }
    }
  });

  return Array.from(variants);
}

function normalizeNickname(nickname, aliasMap = {}) {
  const canonical = resolveCanonicalNickname(nickname, aliasMap);
  return normalizeString(canonical || nickname);
}

function canon(name) {
  return normalizeNickname(name, aliasMapGlobal);
}

function normalizeKey(name) {
  return canon(name);
}

function displayName(name) {
  const resolved = resolveCanonicalNickname(name, aliasMapGlobal);
  if (resolved) {
    return resolved;
  }
  return typeof name === 'string' && name.trim() ? name.trim() : FALLBACK;
}

function getRankTierByPlace(place) {
  const rank = Number(place);
  if (!Number.isFinite(rank) || rank <= 0) {
    return FALLBACK;
  }
  if (rank <= 3) {
    return 'S';
  }
  if (rank <= 7) {
    return 'A';
  }
  if (rank <= 10) {
    return 'B';
  }
  if (rank <= 15) {
    return 'C';
  }
  return 'D';
}

function getRankClass(rankTier) {
  const tier = typeof rankTier === 'string' ? rankTier.trim().toUpperCase() : '';
  if (!tier) {
    return 'rank-none';
  }
  return `rank-${tier}`;
}

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function computeStdDev(values, mean) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

const ADULT_LEAGUE_ALIASES = [
  'adult',
  'olds',
  'old',
  'sundaygames',
  'sunday',
  'league',
  'дорос',
  'старш'
];

const KIDS_LEAGUE_ALIASES = ['kids', 'kid', 'children', 'junior', 'youth', 'дит', 'молод'];

function normalizeLeagueName(value) {
  if (typeof value !== 'string') {
    return 'sundaygames';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 'sundaygames';
  }

  const lookup = trimmed.toLowerCase();
  const compact = lookup.replace(/[\s_-]+/g, '');

  if (KIDS_LEAGUE_ALIASES.some((token) => compact.includes(token))) {
    return 'kids';
  }

  if (ADULT_LEAGUE_ALIASES.some((token) => compact.includes(token))) {
    return 'sundaygames';
  }

  return 'sundaygames';
}

function resolvePlayerLeague(entry, fallback) {
  const aliasMap = aliasMapGlobal;
  const normalizedKey = normalizeNickname(entry?.player ?? entry?.nickname ?? '', aliasMap);
  if (normalizedKey && playerLeagueMap.has(normalizedKey)) {
    return playerLeagueMap.get(normalizedKey);
  }

  const leagueFields = ['league', 'League', 'leagueName', 'league_name'];
  for (const field of leagueFields) {
    const value = typeof entry?.[field] === 'string' ? entry[field].trim() : '';
    if (value) {
      return value;
    }
  }
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : '';
}

function getLeagueLabel(value) {
  const normalized = normalizeLeagueName(value);
  if (normalized === 'kids') {
    return 'Дитяча ліга';
  }
  if (normalized === 'sundaygames') {
    return 'Доросла ліга';
  }
  return value || FALLBACK;
}

function isAdminPlayer(entry, aliasMap = {}) {
  if (!entry) {
    return false;
  }
  const adminFlag = entry?.is_admin === true || entry?.isAdmin === true;
  if (adminFlag) {
    return true;
  }
  const normalizedName = normalizeNickname(entry?.player ?? entry?.nickname ?? '', aliasMap);
  return normalizedName ? ADMIN_BLOCKLIST.has(normalizedName) : false;
}

function parseTeamPlayers(team) {
  const collectTokens = (value) => {
    if (typeof value !== 'string') {
      return [];
    }
    const normalizedSeparators = value.replace(/[|;]/g, ',').replace(/\r?\n/g, ',');
    const primary = normalizedSeparators
      .split(/[,]/)
      .flatMap((chunk) => chunk.split(/\s{2,}/))
      .map((name) => name.trim())
      .filter(Boolean);

    if (primary.length > 1) {
      return primary;
    }

    return normalizedSeparators
      .split(/\s+/)
      .map((name) => name.trim())
      .filter(Boolean);
  };

  if (Array.isArray(team)) {
    return team
      .flatMap((value) => collectTokens(typeof value === 'string' ? value : ''))
      .filter(Boolean);
  }

  if (typeof team === 'string') {

    return collectTokens(team);

  }

  return [];
}

function extractParticipants(event, aliasMap = aliasMapGlobal) {
  const normalizeEntry = (value) => {
    if (value && typeof value === 'object') {
      const candidate =
        (typeof value.canonical === 'string' && value.canonical.trim()) ||
        (typeof value.raw === 'string' && value.raw.trim()) ||
        '';
      if (!candidate) {
        return null;
      }
      const normalizedExisting = normalizeNickname(candidate, aliasMap);
      if (!normalizedExisting) {
        return null;
      }
      return {
        raw: candidate,
        canonical: resolveCanonicalNickname(candidate, aliasMap) || candidate,
        normalized: normalizedExisting
      };
    }
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const canonical = resolveCanonicalNickname(trimmed, aliasMap) || trimmed;
    const normalized = normalizeNickname(trimmed, aliasMap);
    if (!normalized) {
      return null;
    }
    return { raw: trimmed, canonical, normalized };
  };

  const team1Sources = [event?.team1, event?.Team1];
  const team2Sources = [event?.team2, event?.Team2];

  const normalizeTeam = (sources) =>
    sources
      .flatMap((source) => {
        if (Array.isArray(source) && source.some((item) => typeof item === 'object')) {
          return source;
        }
        return parseTeamPlayers(source);
      })
      .map((name) => normalizeEntry(name))
      .filter(Boolean);

  const team1 = normalizeTeam(team1Sources);
  const team2 = normalizeTeam(team2Sources);

  return {
    team1,
    team2
  };
}

function normalizeEventEntry(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const leagueRaw =
    event.League || event.league || event.leagueName || event.league_name || event.meta?.league;
  const league = normalizeLeagueName(leagueRaw);
  const { team1, team2 } = extractParticipants(event);
  const score = Array.isArray(event.score) ? event.score : [];
  const mvpCandidates = [event.MVP, event.mvp, event.mvp2, event.mvp3]
    .flat()
    .flatMap((value) => {
      if (typeof value === 'string') {
        return value
          .split(/[;,]/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (Array.isArray(value)) {
        return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
      }
      return [];
    });

  return {
    id: toFiniteNumber(event.id) ?? null,
    date: typeof event.date === 'string' ? event.date : '',
    league,
    team1,
    team2,
    score,
    winnerTeam: toFiniteNumber(event.winnerTeam),
    mvp: mvpCandidates
  };
}

function buildPlayerLeagueMap(events = []) {
  const leagueStats = new Map();

  events.forEach((event, index) => {
    const league = normalizeLeagueName(event?.League || event?.league);

    if (!league || (league !== 'kids' && league !== 'sundaygames')) {
      return;
    }

    const eventTimestamp = (() => {
      if (typeof event?.date === 'string') {
        const time = Date.parse(event.date);
        if (Number.isFinite(time)) {
          return time;
        }
      }
      return index;
    })();

    const { team1, team2 } = extractParticipants(event);
    [...team1, ...team2].forEach((player) => {
      const key = normalizeKey(player?.canonical ?? player?.raw ?? '');
      if (!key) {
        return;
      }

      const record =
        leagueStats.get(key) || { kids: 0, sundaygames: 0, lastLeague: '', lastSeen: null };
      if (league === 'kids') {
        record.kids += 1;
      }
      if (league === 'sundaygames') {
        record.sundaygames += 1;
      }
      if (record.lastSeen === null || eventTimestamp >= record.lastSeen) {
        record.lastLeague = league;
        record.lastSeen = eventTimestamp;
      }
      leagueStats.set(key, record);
    });
  });

  const playerLeagueMap = new Map();
  leagueStats.forEach((counts, key) => {
    const kidsCount = toFiniteNumber(counts.kids) ?? 0;
    const sundayCount = toFiniteNumber(counts.sundaygames) ?? 0;
    const lastLeague = normalizeLeagueName(counts.lastLeague);

    if (kidsCount > sundayCount) {
      playerLeagueMap.set(key, 'kids');
    } else if (sundayCount > kidsCount) {
      playerLeagueMap.set(key, 'sundaygames');
    } else if (kidsCount > 0 && lastLeague) {
      playerLeagueMap.set(key, lastLeague);
    }
  });

  return playerLeagueMap;
}

function mergePlayerRecords(allPlayers = [], topList = [], aliasMap = {}) {
  const detailedIndex = new Map();
  topList.forEach((entry) => {
    const normalized = normalizeNickname(entry?.player, aliasMap);
    if (normalized) {
      detailedIndex.set(normalized, entry);
    }
  });

  const merged = allPlayers.map((entry) => {
    const normalized = normalizeNickname(entry?.player, aliasMap);
    const detailed = normalized ? detailedIndex.get(normalized) : null;
    return detailed ? { ...detailed, ...entry } : entry;
  });

  detailedIndex.forEach((entry, normalized) => {
    const alreadyExists = merged.some((player) => normalizeNickname(player?.player, aliasMap) === normalized);
    if (!alreadyExists) {
      merged.push(entry);
    }
  });

  return merged;
}

function ensurePlayerRecord(statsMap, playerKey, display) {
  if (!statsMap.has(playerKey)) {
    const nickname = displayName(display || playerKey);
    statsMap.set(playerKey, {
      nickname,
      canonicalNickname: nickname,
      normalizedNickname: playerKey,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      rounds: 0,
      round_wins: 0,
      round_losses: 0,
      MVP: 0,
      bestStreak: 0,
      lossStreak: 0,
      currentWinStreak: 0,
      currentLossStreak: 0,
      teammatesMap: new Map(),
      teammatesWinsMap: new Map(),
      opponentsMap: new Map(),
      opponentsLossesMap: new Map(),
      recentScores: [],
      timeline: null,
      aliases: [],
      leagueKey: ''
    });
  }
  return statsMap.get(playerKey);
}

function convertCountMapToList(map, limit = 3) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .filter((item) => item.name && toFiniteNumber(item.count) !== null)
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function computeLeagueStats(events = [], leagueKey) {
  const normalizedLeague = normalizeLeagueName(leagueKey);
  const stats = new Map();
  const playerSet = new Set();

  let totalGames = 0;
  let totalRounds = 0;
  let totalParticipants = 0;

  const relevantEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => {
      if (!event) {
        return false;
      }
      const eventLeague = normalizeLeagueName(event.league || event.League);
      if (normalizedLeague) {
        return eventLeague === normalizedLeague;
      }
      return Boolean(eventLeague);
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.event?.date ?? '') || 0;
      const timeB = Date.parse(b.event?.date ?? '') || 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.index - b.index;
    });

  relevantEvents.forEach(({ event }) => {
    const { team1, team2 } = extractParticipants(event);
    const teams = [team1, team2].map((team) =>
      team
        .map((player) => ({
          raw: player.canonical,
          key: player.normalized
        }))
        .filter((item) => Boolean(item.key))
    );

    if (teams[0].length === 0 && teams[1].length === 0) {
      return;
    }

    totalGames += 1;
    totalParticipants += teams[0].length + teams[1].length;

    const score = Array.isArray(event.score) ? event.score : [];
    const roundsInMatch = score.reduce((sum, value) => sum + (toFiniteNumber(value) ?? 0), 0);
    if (roundsInMatch > 0) {
      totalRounds += roundsInMatch;
    }

    const winner = toFiniteNumber(event.winnerTeam);

    teams.forEach((team, index) => {
      const opponentIndex = index === 0 ? 1 : 0;
      const result = (() => {
        if (winner === index + 1) {
          return 'win';
        }
        if (winner === opponentIndex + 1) {
          return 'loss';
        }
        const ownScore = toFiniteNumber(score[index]);
        const opponentScore = toFiniteNumber(score[opponentIndex]);
        if (ownScore !== null && opponentScore !== null) {
          if (ownScore > opponentScore) {
            return 'win';
          }
          if (ownScore < opponentScore) {
            return 'loss';
          }
        }
        return 'draw';
      })();

      team.forEach(({ key, raw }) => {
        playerSet.add(key);
        const record = ensurePlayerRecord(stats, key, raw);
        if (!record.leagueKey) {
          record.leagueKey = normalizedLeague;
        }
        record.games += 1;
        if (result === 'win') {
          record.wins += 1;
          record.currentWinStreak += 1;
          record.currentLossStreak = 0;
          record.bestStreak = Math.max(record.bestStreak, record.currentWinStreak);
        } else if (result === 'loss') {
          record.losses += 1;
          record.currentLossStreak += 1;
          record.currentWinStreak = 0;
          record.lossStreak = Math.max(record.lossStreak, record.currentLossStreak);
        } else {
          record.draws += 1;
          record.currentLossStreak = 0;
          record.currentWinStreak = 0;
        }

        if (Array.isArray(event.mvp) && event.mvp.some((value) => canon(value) === key)) {
          record.MVP += 1;
        }

        const roundsForPlayer = toFiniteNumber(score[index]);
        const roundsAgainstPlayer = toFiniteNumber(score[opponentIndex]);
        if (roundsForPlayer !== null) {
          record.round_wins += roundsForPlayer;
          record.rounds += roundsForPlayer;
        }
        if (roundsAgainstPlayer !== null) {
          record.round_losses += roundsAgainstPlayer;
          record.rounds += roundsAgainstPlayer;
        }

        const teammates = team.filter((item) => item.key !== key);
        teammates.forEach((mate) => {
          const count = record.teammatesMap.get(mate.raw) ?? 0;
          record.teammatesMap.set(mate.raw, count + 1);
          if (result === 'win') {
            const winsCount = record.teammatesWinsMap.get(mate.raw) ?? 0;
            record.teammatesWinsMap.set(mate.raw, winsCount + 1);
          }
        });

        const opponents = teams[opponentIndex];
        opponents.forEach((enemy) => {
          const count = record.opponentsMap.get(enemy.raw) ?? 0;
          record.opponentsMap.set(enemy.raw, count + 1);
          if (result === 'loss') {
            const lossesCount = record.opponentsLossesMap.get(enemy.raw) ?? 0;
            record.opponentsLossesMap.set(enemy.raw, lossesCount + 1);
          }
        });
      });
    });
  });

  stats.forEach((record) => {
    record.winRate = record.games > 0 ? record.wins / record.games : null;
    record.roundWR = record.rounds > 0 ? record.round_wins / record.rounds : null;
    record.teammatesMost = convertCountMapToList(record.teammatesMap);
    record.teammatesMostWins = convertCountMapToList(record.teammatesWinsMap);
    record.opponentsMost = convertCountMapToList(record.opponentsMap);
    record.opponentsMostLosses = convertCountMapToList(record.opponentsLossesMap);
  });

  return {
    playerStats: stats,
    metrics: {
      totalGames,
      totalRounds: totalRounds > 0 ? totalRounds : null,
      playersWithGames: playerSet.size,
      avgPlayersPerGame: totalGames > 0 ? totalParticipants / totalGames : null,
      avgRoundsPerGame: totalGames > 0 && totalRounds > 0 ? totalRounds / totalGames : null
    }
  };
}

function buildLeagueOptions(players = [], fallbackLeague) {
  const unique = new Set();
  players.forEach((player) => {
    const leagueName = resolvePlayerLeague(player, fallbackLeague);
    const normalized = normalizeLeagueName(leagueName);
    if (normalized) {
      unique.add(normalized);
    }
  });

  const buttonTargets = leagueButtons
    .map((button) => button.dataset.leagueTarget || button.dataset.leagueValue)
    .filter(Boolean)
    .map((value) => normalizeLeagueName(value))
    .filter(Boolean);

  buttonTargets.forEach((target) => unique.add(target));

  const normalizedFallback = normalizeLeagueName(fallbackLeague);
  if (normalizedFallback) {
    unique.add(normalizedFallback);
  }

  const priority = ['sundaygames', 'kids'];
  return Array.from(unique.values()).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
}

function sortPlayersForLeaderboard(a, b) {
  const rankA = toFiniteNumber(a?.rank);
  const rankB = toFiniteNumber(b?.rank);
  if (rankA !== null && rankB !== null && rankA !== rankB) {
    return rankA - rankB;
  }

  const pointsA = toFiniteNumber(a?.season_points ?? a?.totalPoints);
  const pointsB = toFiniteNumber(b?.season_points ?? b?.totalPoints);
  if (pointsA !== null && pointsB !== null && pointsA !== pointsB) {
    return pointsB - pointsA;
  }

  const winRateA = toFiniteNumber(a?.winRate);
  const winRateB = toFiniteNumber(b?.winRate);
  if (winRateA !== null && winRateB !== null && winRateA !== winRateB) {
    return winRateB - winRateA;
  }

  const gamesA = toFiniteNumber(a?.games);
  const gamesB = toFiniteNumber(b?.games);
  if (gamesA !== null && gamesB !== null && gamesA !== gamesB) {
    return gamesB - gamesA;
  }

  const nameA = normalizeNickname(a?.nickname ?? a?.player ?? '', PACK?.aliases ?? {});
  const nameB = normalizeNickname(b?.nickname ?? b?.player ?? '', PACK?.aliases ?? {});
  return nameA.localeCompare(nameB);
}

function getPlayerLeagueKey(player) {
  const aliasMap = aliasMapGlobal;
  const nickname = player?.nickname ?? player?.player ?? '';
  const normalized = normalizeNickname(nickname, aliasMap);
  const leagueFromMap = normalized ? playerLeagueMap.get(normalized) : '';
  const directLeague = player?.leagueKey ?? player?.league ?? leagueFromMap ?? '';
  return normalizeLeagueName(directLeague || leagueFromMap || '');
}

function filterPlayersByLeague(players = [], leagueValue = '') {
  const normalizedLeague = normalizeLeagueName(leagueValue);
  const fallback = normalizeLeagueName(fallbackLeague);
  const targetLeague = normalizedLeague || fallback;

  if (!Array.isArray(players)) {
    return [];
  }

  if (!targetLeague) {
    return players;
  }

  return players.filter((player) => {
    const leagueKey = getPlayerLeagueKey(player);
    if (!leagueKey) {
      return targetLeague === fallback;
    }
    return leagueKey === targetLeague;
  });
}

function getLeagueStatsForNickname(normalizedNickname, leagueValue = '') {
  if (!normalizedNickname) {
    return null;
  }

  const leagueKey = normalizeLeagueName(leagueValue || activeLeague);
  const leagueData = leagueStatsCache.get(leagueKey);
  if (!leagueData || !(leagueData.playerStats instanceof Map)) {
    return null;
  }

  return leagueData.playerStats.get(normalizedNickname) ?? null;
}

function applyLeagueStats(player, leagueValue = '') {
  if (!player) {
    return null;
  }

  const aliasMap = aliasMapGlobal;
  const leagueKey = normalizeLeagueName(leagueValue || activeLeague);
  const nicknameField =
    (typeof player?.nickname === 'string' && player.nickname.trim()) ||
    (typeof player?.canonicalNickname === 'string' && player.canonicalNickname.trim()) ||
    (typeof player?.player === 'string' && player.player.trim()) ||
    '';
  const normalizedNickname = normalizeNickname(nicknameField, aliasMap);
  const stats = getLeagueStatsForNickname(normalizedNickname, leagueKey);

  const target = { ...player };
  const resetStats = () => {
    target.games = 0;
    target.wins = 0;
    target.losses = 0;
    target.draws = 0;
    target.rounds = 0;
    target.round_wins = 0;
    target.round_losses = 0;
    target.MVP = 0;
    target.bestStreak = 0;
    target.lossStreak = 0;
    target.win_streak = 0;
    target.loss_streak = 0;
    target.winRate = null;
    target.roundWR = null;
    target.teammatesMost = [];
    target.teammatesMostWins = [];
    target.opponentsMost = [];
    target.opponentsMostLosses = [];
    target.recentScores = [];
  };

  resetStats();

  if (stats) {
    target.games = stats.games;
    target.wins = stats.wins;
    target.losses = stats.losses;
    target.draws = stats.draws;
    target.rounds = stats.rounds;
    target.round_wins = stats.round_wins;
    target.round_losses = stats.round_losses;
    target.MVP = stats.MVP;
    target.bestStreak = stats.bestStreak;
    target.lossStreak = stats.lossStreak;
    target.win_streak = stats.bestStreak;
    target.loss_streak = stats.lossStreak;
    target.winRate = stats.winRate;
    target.roundWR = stats.roundWR;
    target.teammatesMost = stats.teammatesMost;
    target.teammatesMostWins = stats.teammatesMostWins;
    target.opponentsMost = stats.opponentsMost;
    target.opponentsMostLosses = stats.opponentsMostLosses;
    target.recentScores = stats.recentScores;
  }

  target.leagueKey = leagueKey || target.leagueKey;
  target.league = leagueKey || target.league;
  target.team = getLeagueLabel(target.league || leagueKey || FALLBACK);
  target.canonicalNickname =
    target.canonicalNickname || resolveCanonicalNickname(nicknameField, aliasMap) || nicknameField;
  target.normalizedNickname = normalizedNickname || target.normalizedNickname;

  return target;
}

function buildProfileForLeague(targetPlayer, leagueValue = '') {
  const leagueKey = normalizeLeagueName(leagueValue || activeLeague);
  const aliasMap = aliasMapGlobal;
  const basePlayer =
    typeof targetPlayer === 'string' ? findProfilePlayer(targetPlayer) : targetPlayer;

  if (!basePlayer && typeof targetPlayer !== 'string') {
    return null;
  }

  const nicknameField =
    (typeof (basePlayer?.nickname ?? basePlayer?.player) === 'string' &&
      (basePlayer?.nickname ?? basePlayer?.player)?.trim()) ||
    (typeof targetPlayer === 'string' ? targetPlayer : '') ||
    '';

  const fallbackPlayer = {
    nickname: displayName(nicknameField),
    canonicalNickname: resolveCanonicalNickname(nicknameField, aliasMap) || nicknameField,
    normalizedNickname: normalizeNickname(nicknameField, aliasMap),
    team: getLeagueLabel(leagueKey || FALLBACK),
    leagueKey,
    league: leagueKey
  };

  const profile = applyLeagueStats(basePlayer || fallbackPlayer, leagueKey);
  return profile;
}

function getPlayerStreaks(player, leagueValue = '') {
  const leagueKey = normalizeLeagueName(leagueValue || activeLeague);
  const aliasMap = aliasMapGlobal;
  const nicknameField =
    (typeof player?.nickname === 'string' && player.nickname.trim()) ||
    (typeof player?.canonicalNickname === 'string' && player.canonicalNickname.trim()) ||
    (typeof player?.player === 'string' && player.player.trim()) ||
    '';

  const normalizedNickname = normalizeNickname(nicknameField, aliasMap);
  if (!normalizedNickname) {
    return { winStreak: null, lossStreak: null };
  }

  const cacheKey = `${leagueKey || 'any'}:${normalizedNickname}`;
  if (streakCache.has(cacheKey)) {
    return streakCache.get(cacheKey);
  }

  const stats = getLeagueStatsForNickname(normalizedNickname, leagueKey) ?? {};
  const winStreak =
    toFiniteNumber(player?.win_streak ?? player?.bestStreak) ??
    toFiniteNumber(stats.bestStreak ?? stats.win_streak);
  const lossStreak =
    toFiniteNumber(player?.loss_streak ?? player?.lossStreak) ??
    toFiniteNumber(stats.lossStreak ?? stats.currentLossStreak);

  const streaks = { winStreak, lossStreak };
  streakCache.set(cacheKey, streaks);
  return streaks;
}

function buildProfileLookup(players = [], aliasMap = {}) {
  const map = new Map();
  players.forEach((player) => {
    const variants = getNicknameVariants(player?.nickname ?? player?.player ?? '', aliasMap);
    variants.forEach((variant) => {
      const normalized = normalizeNickname(variant, aliasMap);
      if (normalized) {
        map.set(normalized, player);
      }
    });
  });
  return map;
}

function findProfilePlayer(nickname) {
  const aliasMap = aliasMapGlobal;
  const normalized = normalizeNickname(nickname, aliasMap);
  if (!normalized) {
    return null;
  }

  if (profileLookupCurrent.has(normalized)) {
    return profileLookupCurrent.get(normalized);
  }

  if (profileLookupAll.has(normalized)) {
    return profileLookupAll.get(normalized);
  }

  if (profileLookupTop.has(normalized)) {
    return profileLookupTop.get(normalized);
  }

  return null;
}

const numberFormatter = new Intl.NumberFormat('uk-UA');
const percentFormatter0 = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 0
});
const percentFormatter1 = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 1
});
const decimalFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const pointsPluralRules = new Intl.PluralRules('uk-UA');

function formatNumberValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : numberFormatter.format(numeric);
}

function formatDecimalValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : decimalFormatter.format(numeric);
}

function formatPercentValue(value, formatter = percentFormatter0) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : formatter.format(numeric);
}

function formatPointsWord(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return 'очок';
  }
  const rule = pointsPluralRules.select(numeric);
  if (rule === 'one') {
    return 'очко';
  }
  if (rule === 'few') {
    return 'очки';
  }
  return 'очок';
}

const metricsGrid = document.getElementById('metrics-grid');
const podiumGrid = document.getElementById('podium-grid');
const leaderboardBody = document.getElementById('leaderboard-body');
const tickerEl = document.getElementById('season-ticker');
const searchInput = document.getElementById('player-search');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const leagueButtons = Array.from(document.querySelectorAll('[data-league-target]'));
const modal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = modal?.querySelector('[data-close]');

const TOP_LIMIT = 10;
const ADMIN_BLOCKLIST = new Set(['pantazi_ko', 'sem', 'bogd']);

let currentSort = 'rank';
let currentDirection = 'asc';
let PACK = null;
let EVENTS = null;
let seasonTop10ByLeague = null;
let normalizedTop10ByLeague = { kids: [], sundaygames: [] };
let rawTop10Kids = [];
let rawTop10Sunday = [];
let aliasMapGlobal = {};
let normalizedEvents = [];
let playerLeagueMap = new Map();
let topPlayers = [];
let allPlayersNormalized = [];
let packAllPlayersNormalized = [];

let top10RowsKids = [];
let top10RowsSunday = [];
let packLookupCanonical = new Map();
let packLookupRaw = new Map();
let packLookupReady = false;

let topPlayersNormalized = [];
let profileLookupAll = new Map();
let profileLookupTop = new Map();
let profileLookupCurrent = new Map();
let packPlayerIndex = new Map();
let packPlayerRawIndex = new Map();
let leagueStatsCache = new Map();
let streakCache = new Map();

let leagueOptions = [];
let activeLeague = 'sundaygames';
let activeLeaguePlayers = [];
let seasonTickerMessages = [];
let metricsSnapshot = null;
let openProfileKey = '';
let tickerTimer = null;
let controlsBound = false;
let profileBound = false;
let leagueBound = false;
let fallbackLeague = 'sundaygames';

function ensureLeagueStats(leagueKey) {
  const normalized = normalizeLeagueName(leagueKey || '');
  if (!normalized) {
    return;
  }

  if (!leagueStatsCache.has(normalized)) {
    leagueStatsCache.set(normalized, computeLeagueStats(normalizedEvents, normalized));
  }
}

function normalizeTopPlayers(top10 = [], meta = {}, aliasMap = {}) {
  return top10.map((entry, index) => {
    const nameField =
      (typeof entry?.player === 'string' && entry.player.trim() && entry.player.trim()) ||
      (typeof entry?.nickname === 'string' && entry.nickname.trim() && entry.nickname.trim()) ||
      (typeof entry?.name === 'string' && entry.name.trim() && entry.name.trim()) ||
      '';
    const nickname = nameField || FALLBACK;
    const canonicalNickname = nameField ? resolveCanonicalNickname(nameField, aliasMap) : '';
    const nicknameAliases = nameField ? getNicknameVariants(nameField, aliasMap) : [];
    const normalizedNickname = nameField ? normalizeNickname(nameField, aliasMap) : '';
    const rank = toFiniteNumber(entry?.rank) ?? index + 1;
    const games = toFiniteNumber(entry?.games);
    const wins = toFiniteNumber(entry?.wins);
    const losses = toFiniteNumber(entry?.losses);
    const draws = toFiniteNumber(entry?.draws);
    const totalPoints = toFiniteNumber(entry?.season_points);
    const averagePoints =
      games && games > 0 && totalPoints !== null ? totalPoints / games : null;
    const rounds = toFiniteNumber(entry?.rounds);
    const roundWins = toFiniteNumber(entry?.round_wins);
    const roundLosses = toFiniteNumber(entry?.round_losses);
    const roundWinRate = toFiniteNumber(entry?.roundWR);
    const winStreak = toFiniteNumber(entry?.win_streak);
    const lossStreak = toFiniteNumber(entry?.loss_streak);
    const mvpCount = toFiniteNumber(entry?.MVP);

    const teammatesMost = Array.isArray(entry?.teammates_most)
      ? entry.teammates_most
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const teammatesMostWins = Array.isArray(entry?.teammates_most_wins)
      ? entry.teammates_most_wins
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const opponentsMost = Array.isArray(entry?.opponents_most)
      ? entry.opponents_most
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const opponentsMostLosses = Array.isArray(entry?.opponents_most_losses_to)
      ? entry.opponents_most_losses_to
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const lossesTo = opponentsMostLosses.length > 0 ? opponentsMostLosses[0] : null;

    const playerLeague = resolvePlayerLeague(entry, meta.league);
    const leagueKey = normalizeLeagueName(playerLeague || meta.league);
    const leagueName = getLeagueLabel(playerLeague || meta.league || FALLBACK);

    return {
      rank,
      nickname,
      canonicalNickname: canonicalNickname || nickname,
      normalizedNickname,
      aliases: nicknameAliases,
      realName: FALLBACK,
      team: leagueName,
      leagueKey,
      isAdmin: isAdminPlayer(entry, aliasMap),
      season_points: totalPoints,
      totalPoints,
      averagePoints,
      games,
      wins,
      losses,
      draws,
      winRate: toFiniteNumber(entry?.winRate),
      roundWR: roundWinRate,
      rounds,
      round_wins: roundWins,
      round_losses: roundLosses,
      win_streak: winStreak,
      loss_streak: lossStreak,
      MVP: mvpCount,
      bestStreak: winStreak,
      lossStreak,
      rankTier:
        typeof entry?.rankTier === 'string' && entry.rankTier.trim()
          ? entry.rankTier
          : getRankTierByPlace(rank),
      role: FALLBACK,
      accuracy: toFiniteNumber(entry?.accuracy),
      tagsPerGame: toFiniteNumber(entry?.tags_per_game),
      assistsPerGame: toFiniteNumber(entry?.assists_per_game),
      clutchPlays: toFiniteNumber(entry?.clutch_plays),
      disarms: toFiniteNumber(entry?.disarms),
      highlights: [],
      story: FALLBACK,
      recentScores: [],
      recentAccuracy: [],
      teammatesMost,
      teammatesMostWins,
      opponentsMost,
      opponentsMostLosses,
      winWith: [],
      loseWith: [],
      mostLostTo: lossesTo
        ? {
            name:
              typeof lossesTo?.name === 'string' && lossesTo.name.trim()
                ? lossesTo.name
                : FALLBACK,
            count: toFiniteNumber(lossesTo?.count)
          }
        : { name: FALLBACK, count: null },
      dangerous: null,
      loadout: FALLBACK,
      favoriteArena: FALLBACK,
      timeline: null
    };
  });
}


function ensurePackLookups() {
  if (packLookupReady) {
    return;
  }

  packLookupCanonical = new Map();
  packLookupRaw = new Map();

  const aliasMap = PACK?.aliases ?? {};
  const packPlayers = normalizeTopPlayers(
    Array.isArray(PACK?.allPlayers) ? PACK.allPlayers : [],
    PACK?.meta ?? {},
    aliasMap
  );

  packPlayers.forEach((player) => {
    const canonicalKey = normalizeNickname(player?.nickname ?? player?.player ?? '', aliasMap);
    const rawKey =
      (typeof player?.nickname === 'string' && player.nickname.trim()) ||
      (typeof player?.player === 'string' && player.player.trim()) ||
      '';

    if (canonicalKey) {
      packLookupCanonical.set(canonicalKey, player);
    }

    if (rawKey) {
      packLookupRaw.set(rawKey, player);
    }
  });

  packLookupReady = true;
}


function resolveTop10EntryToPackRow(entry) {
  if (!entry) {
    return null;
  }


  const aliasMap = PACK?.aliases ?? {};
  const nick =
    (typeof entry?.player === 'string' && entry.player.trim()) ||
    (typeof entry?.nickname === 'string' && entry.nickname.trim()) ||
    '';
  const canonical = normalizeNickname(nick, aliasMap);

  const matched =
    (canonical && packLookupCanonical.get(canonical)) ||
    (nick && packLookupRaw.get(nick)) ||
    null;

  return matched ? { ...matched } : null;
}

function buildResolvedTop10Rows(rawList, normalizedLeague) {
  const source = Array.isArray(rawList) ? rawList : [];
  const normalizedLeagueKey = normalizeLeagueName(normalizedLeague || '');
  const aliasMap = aliasMapGlobal;

  return source.map((entry, index) => {
    const nicknameField =
      (typeof entry?.player === 'string' && entry.player.trim()) ||
      (typeof entry?.nickname === 'string' && entry.nickname.trim()) ||
      (typeof entry?.name === 'string' && entry.name.trim()) ||
      '';
    const nickname = nicknameField || FALLBACK;
    const canonicalNickname = nicknameField
      ? resolveCanonicalNickname(nicknameField, aliasMap)
      : nickname;
    const normalizedNickname = nicknameField
      ? normalizeNickname(nicknameField, aliasMap)
      : nicknameField;
    const aliases = nicknameField ? getNicknameVariants(nicknameField, aliasMap) : [];
    const resolvedLeague =
      normalizeLeagueName(entry?.leagueKey ?? entry?.league ?? normalizedLeagueKey) ||
      normalizedLeagueKey;
    const teamLabel = getLeagueLabel(resolvedLeague || FALLBACK);
    const pointsValue = toFiniteNumber(entry?.season_points ?? entry?.totalPoints);
    const rankValue = toFiniteNumber(entry?.rank);

    return {
      ...entry,
      nickname,
      canonicalNickname: canonicalNickname || nickname,
      normalizedNickname,
      aliases,
      leagueKey: resolvedLeague,
      league: resolvedLeague,
      team: teamLabel,
      rank: rankValue,
      season_points: pointsValue,
      totalPoints: pointsValue,
      originalIndex: index
    };
  });
}

function buildLeagueTop10(rawTop10 = [], leagueKey = '') {
  const normalizedLeague = normalizeLeagueName(leagueKey || 'sundaygames');
  ensurePackLookups();

  const resolvedRows = buildResolvedTop10Rows(rawTop10, normalizedLeague)
    .map((row) => {
      const packRow = resolveTop10EntryToPackRow(row);
      const packDisplay = (() => {
        if (!packRow) {
          return {};
        }
        const aliasMap = PACK?.aliases ?? {};
        const preferredName =
          (typeof packRow?.nickname === 'string' && packRow.nickname.trim()) ||
          (typeof packRow?.player === 'string' && packRow.player.trim()) ||
          '';
        return {
          avatar: packRow.avatar,
          profile: packRow.profile,
          profileUrl: packRow.profileUrl,
          nickname: preferredName || row.nickname,
          canonicalNickname:
            row.canonicalNickname || resolveCanonicalNickname(preferredName || row.nickname, aliasMap),
          aliases:
            Array.isArray(row.aliases) && row.aliases.length > 0
              ? row.aliases
              : getNicknameVariants(preferredName || row.nickname, aliasMap),
          rankTier: typeof packRow?.rankTier === 'string' && packRow.rankTier.trim()
            ? packRow.rankTier.trim()
            : null
        };
      })();

      const resolvedLeague =
        normalizeLeagueName(row?.leagueKey ?? row?.league ?? normalizedLeague) || normalizedLeague;

      const rankTierFromRow =
        typeof row?.rankTier === 'string' && row.rankTier.trim() ? row.rankTier.trim() : null;

      return {
        ...row,
        ...packDisplay,
        rankTier: packDisplay.rankTier || rankTierFromRow,
        leagueKey: resolvedLeague,
        league: resolvedLeague,
        team: getLeagueLabel(resolvedLeague || FALLBACK)
      };
    })
    .filter((row) => {
      const rowLeague = normalizeLeagueName(row?.leagueKey ?? row?.league ?? normalizedLeague);
      if (rowLeague !== normalizedLeague) {
        return false;
      }

      const games = toFiniteNumber(row?.games);
      const points = toFiniteNumber(row?.season_points ?? row?.totalPoints);
      if (row?.isAdmin) {
        return false;
      }
      if (games !== null) {
        return games > 0;
      }
      return points !== null && points > 0;
    })
    .sort((a, b) => {
      const pointsA = toFiniteNumber(a?.season_points ?? a?.totalPoints) ?? 0;
      const pointsB = toFiniteNumber(b?.season_points ?? b?.totalPoints) ?? 0;
      if (pointsA !== pointsB) {
        return pointsB - pointsA;
      }

      const gamesA = toFiniteNumber(a?.games) ?? 0;
      const gamesB = toFiniteNumber(b?.games) ?? 0;
      if (gamesA !== gamesB) {
        return gamesB - gamesA;
      }

      const winsA = toFiniteNumber(a?.wins) ?? 0;
      const winsB = toFiniteNumber(b?.wins) ?? 0;
      if (winsA !== winsB) {
        return winsB - winsA;
      }

      return (a?.nickname ?? '').localeCompare(b?.nickname ?? '');
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      rankTier:
        row.rankTier && row.rankTier !== FALLBACK ? row.rankTier : getRankTierByPlace(index + 1)
    }));

  return resolvedRows;
}

function buildMetrics(aggregates = {}, players = [], leagueMetrics = {}) {
  const totalGames = toFiniteNumber(leagueMetrics?.totalGames ?? aggregates?.total_games);
  const totalRounds = toFiniteNumber(leagueMetrics?.totalRounds ?? aggregates?.total_rounds);
  const avgRoundsPerGame = toFiniteNumber(
    leagueMetrics?.avgRoundsPerGame ?? aggregates?.avg_rounds_per_game
  );
  const avgPlayersPerGame = toFiniteNumber(
    leagueMetrics?.avgPlayersPerGame ?? aggregates?.avg_players_per_game
  );
  const playersWithGames = toFiniteNumber(
    leagueMetrics?.playersWithGames ?? aggregates?.players_with_games
  );
  const playersInRating = toFiniteNumber(aggregates?.players_in_rating);
  const totalPoints = toFiniteNumber(leagueMetrics?.totalPoints ?? aggregates?.points_total);
  const pointsPositiveOnly = toFiniteNumber(
    leagueMetrics?.pointsPositiveOnly ?? aggregates?.points_positive_only
  );
  const pointsNegativeOnly = toFiniteNumber(
    leagueMetrics?.pointsNegativeOnly ?? aggregates?.points_negative_only
  );
  const longestGameRounds = toFiniteNumber(
    leagueMetrics?.longestGameRounds ?? aggregates?.longest_game_rounds
  );
  const commonScore =
    typeof aggregates?.common_score === 'string' && aggregates.common_score.trim()
      ? aggregates.common_score
      : FALLBACK;

  const podiumPlayers = players.slice(0, 3);
  const pointsValues = players
    .map((player) => toFiniteNumber(player?.totalPoints))
    .filter((value) => value !== null);
  const podiumPoints = podiumPlayers.reduce(
    (sum, player) => sum + (toFiniteNumber(player?.totalPoints) ?? 0),
    0
  );
  const podiumNames = podiumPlayers.map((player) => player.nickname ?? FALLBACK);
  const averageTop10 =
    pointsValues.length > 0
      ? pointsValues.reduce((sum, value) => sum + value, 0) / pointsValues.length
      : null;
  const medianTop10 = computeMedian(pointsValues);
  const standardDeviation =
    pointsValues.length > 0 && averageTop10 !== null
      ? computeStdDev(pointsValues, averageTop10)
      : null;
  const minPoints = pointsValues.length > 0 ? Math.min(...pointsValues) : null;
  const maxPoints = pointsValues.length > 0 ? Math.max(...pointsValues) : null;
  const averagePointsPerGame =
    totalGames && totalPoints !== null && totalGames > 0 ? totalPoints / totalGames : null;
  const podiumShare =
    totalPoints && totalPoints > 0 && podiumPoints > 0 ? podiumPoints / totalPoints : null;

  return {
    totalGames,
    totalRounds,
    avgRoundsPerGame,
    avgPlayersPerGame,
    playersWithGames,
    playersInRating,
    totalPoints,
    pointsPositiveOnly,
    pointsNegativeOnly,
    longestGameRounds,
    commonScore,
    podiumPoints: podiumPlayers.length > 0 ? podiumPoints : null,
    podiumNames,
    podiumShare,
    averagePointsPerGame,
    averageTop10,
    medianTop10,
    standardDeviation,
    minPoints,
    maxPoints
  };
}

function buildTickerMessages(data) {
  return [
    `Матчів: ${formatNumberValue(data.totalGames)} · Раундів: ${formatNumberValue(data.totalRounds)}`,
    `Очки сезону: ${formatNumberValue(data.totalPoints)} (подіум ${formatPercentValue(
      data.podiumShare,
      percentFormatter1
    )})`,
    `Середні очки топ-10: ${formatNumberValue(data.averageTop10)} ±${formatDecimalValue(
      data.standardDeviation
    )}`
  ];
}
function renderMetricsFromAggregates(aggregates = {}, players = [], leagueMetrics = {}) {
  metricsSnapshot = buildMetrics(aggregates, players, leagueMetrics);
  const data = metricsSnapshot;

  const cards = [
    {
      label: 'Матчів зіграно',
      value: formatNumberValue(data.totalGames),
      delta:
        data.avgRoundsPerGame !== null
          ? `~${formatDecimalValue(data.avgRoundsPerGame)} раундів/матч`
          : '',
      footnote: `Раундів: ${formatNumberValue(data.totalRounds)}`,
      key: 'games'
    },
    {
      label: 'Активних гравців',
      value: formatNumberValue(data.playersWithGames),
      delta:
        data.playersInRating !== null
          ? `У рейтингу ${formatNumberValue(data.playersInRating)}`
          : '',
      footnote:
        data.avgPlayersPerGame !== null
          ? `Середній склад: ${formatDecimalValue(data.avgPlayersPerGame)} гравця`
          : FALLBACK,
      key: 'players'
    },
    {
      label: 'Сумарні очки',
      value: formatNumberValue(data.totalPoints),
      delta:
        data.pointsPositiveOnly !== null
          ? `Позитивні ${formatNumberValue(data.pointsPositiveOnly)}`
          : '',
      footnote:
        data.pointsNegativeOnly !== null
          ? `Негативні ${formatNumberValue(data.pointsNegativeOnly)}`
          : FALLBACK,
      key: 'points'
    },
    {
      label: 'Подіум',
      value: formatNumberValue(data.podiumPoints),
      delta:
        data.podiumShare !== null
          ? `Частка ${formatPercentValue(data.podiumShare, percentFormatter1)}`
          : '',
      footnote: data.podiumNames.length > 0 ? data.podiumNames.join(' / ') : FALLBACK,
      key: 'podium'
    },
    {
      label: 'Середні очки/матч',
      value: formatDecimalValue(data.averagePointsPerGame),
      delta: data.commonScore !== FALLBACK ? `Типовий рахунок ${data.commonScore}` : '',
      footnote:
        data.longestGameRounds !== null
          ? `Найдовший бій: ${formatNumberValue(data.longestGameRounds)} раундів`
          : FALLBACK,
      key: 'pace'
    },
    {
      label: 'Топ-10',
      value: formatNumberValue(data.averageTop10),
      delta:
        data.standardDeviation !== null ? `σ = ${formatDecimalValue(data.standardDeviation)}` : '',
      footnote:
        data.minPoints !== null && data.maxPoints !== null
          ? `Діапазон: ${formatNumberValue(data.minPoints)}–${formatNumberValue(
              data.maxPoints
            )} · Медіана ${formatNumberValue(data.medianTop10)}`
          : FALLBACK,
      key: 'top10'
    }
  ];

  if (metricsGrid) {
    metricsGrid.innerHTML = '';
    cards.forEach((card) => {
      const article = document.createElement('article');
      article.className = 'metric-card';
      article.dataset.metric = card.key;
      article.innerHTML = `
        <span class="metric-label">${card.label}</span>
        <span class="metric-value">${card.value}</span>
        ${card.delta ? `<span class="metric-delta">${card.delta}</span>` : ''}
        <span class="metric-footnote">${card.footnote}</span>
      `;
      metricsGrid.append(article);
    });
  }

  seasonTickerMessages = buildTickerMessages(data);
  startTicker(seasonTickerMessages);
}

function renderPodium(players = topPlayers) {
  if (!podiumGrid) {
    return;
  }
  podiumGrid.innerHTML = '';
  const aliasMap = aliasMapGlobal;
  players.slice(0, 3).forEach((player, index) => {
    const card = document.createElement('article');
    card.className = 'podium-card';
    card.dataset.rank = `#${index + 1}`;
    const normalizedNickname = normalizeNickname(
      player?.nickname ?? player?.player ?? '',
      aliasMap
    );
    const leagueKey = normalizeLeagueName(player?.league ?? player?.leagueKey ?? activeLeague);
    const leagueStats = normalizedNickname
      ? getLeagueStatsForNickname(normalizedNickname, leagueKey)
      : null;
    const rankTier =
      typeof player?.rankTier === 'string' && player.rankTier.trim()
        ? player.rankTier
        : getRankTierByPlace(player?.rank);

    const rankClass = getRankClass(rankTier);
    const { winStreak } = getPlayerStreaks(player, activeLeague);

    card.innerHTML = `
      <h3>${player?.nickname ?? FALLBACK}</h3>
      <ul>
        <li>${player?.team ?? FALLBACK}</li>
        <li>${formatNumberValue(player?.totalPoints)} очок</li>
        <li>Win rate ${formatPercentValue(player?.winRate)}</li>

        <li>🔥 Стрік ${formatNumberValue(winStreak)}</li>

      </ul>
    `;
    if (rankTier && rankTier !== FALLBACK) {
      card.classList.add(rankClass);
    }
    podiumGrid.append(card);
  });
}

function getSortValue(player, sortKey) {
  if (!player || !sortKey) {
    return null;
  }

  switch (sortKey) {
    case 'rank':
      return toFiniteNumber(player.rank);
    case 'season_points':
      return toFiniteNumber(player.season_points ?? player.totalPoints);
    case 'games':
      return toFiniteNumber(player.games);
    case 'wins':
      return toFiniteNumber(player.wins);
    case 'losses':
      return toFiniteNumber(player.losses);
    case 'rounds':
      return toFiniteNumber(player.rounds);
    case 'winRate':
    case 'roundWR':
      return toFiniteNumber(player[sortKey]);
    case 'MVP':
      return toFiniteNumber(player.MVP);
    case 'rankTier': {
      const tier = typeof player.rankTier === 'string' ? player.rankTier.trim() : '';
      return tier ? tier.charCodeAt(0) : null;
    }
    default:
      return toFiniteNumber(player[sortKey]);
  }
}

function renderLeaderboard(players = topPlayers) {
  if (!leaderboardBody) {
    return;
  }
  const rawSearch = searchInput?.value ?? '';
  const searchTerm = rawSearch.trim();
  const searchTermLower = searchTerm.toLowerCase();
  const aliasMap = PACK?.aliases ?? {};
  const normalizedSearch = normalizeNickname(searchTerm, aliasMap);
  const hasNormalizedSearch = Boolean(normalizedSearch);
  const sourcePlayers = searchTerm ? activeLeaguePlayers : players;
  const rowsSource = Array.isArray(sourcePlayers) ? sourcePlayers : [];
  const top10SourceRaw = activeLeague === 'kids' ? rawTop10Kids : rawTop10Sunday;

  if (!searchTerm) {
    if (activeLeague === 'kids' && top10SourceRaw.length === 0) {
      leaderboardBody.innerHTML = '';
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="10">Немає даних TOP-10 для kids у файлі підсумку</td>';
      leaderboardBody.append(emptyRow);
      return;
    }

    if (activeLeague === 'kids' && top10SourceRaw.length > 0 && rowsSource.length === 0) {
      leaderboardBody.innerHTML = '';
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="10">Не вдалося зіставити TOP-10 kids із pack</td>';
      leaderboardBody.append(emptyRow);
      return;
    }
  }
  const filtered = rowsSource.filter((player) => {
    if (player?.isAdmin && !searchTerm) {
      return false;
    }

    const aliasList = Array.isArray(player?.aliases) ? player.aliases : [];
    const textFields = [
      player?.nickname ?? '',
      player?.canonicalNickname ?? '',
      player?.realName ?? '',
      player?.team ?? '',
      player?.role ?? '',
      player?.favoriteArena ?? '',
      ...aliasList
    ].filter(Boolean);

    const plainMatch = textFields.some((value) =>
      value.toLowerCase().includes(searchTermLower)
    );
    if (plainMatch) {
      return true;
    }

    if (!hasNormalizedSearch) {
      return false;
    }

    const normalizedNicknameValue = normalizeNickname(player?.nickname ?? '', aliasMap);
    if (normalizedNicknameValue && normalizedNicknameValue === normalizedSearch) {
      return true;
    }

    return aliasList.some(
      (alias) => normalizeNickname(alias, aliasMap) === normalizedSearch
    );
  });

  const sorted = filtered
    .map((player, index) => ({ player, index }))
    .sort((a, b) => {
      const sortKey = currentSort || 'rank';
      const direction = currentDirection === 'asc' ? 1 : -1;

      if (sortKey === 'rank') {
        const pointsA = toFiniteNumber(a.player?.season_points ?? a.player?.totalPoints) ?? 0;
        const pointsB = toFiniteNumber(b.player?.season_points ?? b.player?.totalPoints) ?? 0;
        if (pointsA !== pointsB) {
          return direction * (pointsB - pointsA);
        }

        const gamesA = toFiniteNumber(a.player?.games) ?? 0;
        const gamesB = toFiniteNumber(b.player?.games) ?? 0;
        if (gamesA !== gamesB) {
          return direction * (gamesB - gamesA);
        }

        const winsA = toFiniteNumber(a.player?.wins) ?? 0;
        const winsB = toFiniteNumber(b.player?.wins) ?? 0;
        if (winsA !== winsB) {
          return direction * (winsB - winsA);
        }

        return a.index - b.index;
      }

      const valueA = getSortValue(a.player, sortKey);
      const valueB = getSortValue(b.player, sortKey);

      if (valueA === null && valueB === null) {
        return a.index - b.index;
      }
      if (valueA === null) {
        return 1;
      }
      if (valueB === null) {
        return -1;
      }

      if (valueA === valueB) {
        return a.index - b.index;
      }

      const isNumericA = typeof valueA === 'number' && Number.isFinite(valueA);
      const isNumericB = typeof valueB === 'number' && Number.isFinite(valueB);
      if (isNumericA && isNumericB) {
        return direction * (valueA - valueB);
      }

      const labelA = String(valueA);
      const labelB = String(valueB);
      return direction * labelA.localeCompare(labelB);
    })
    .map((item) => item.player);

  leaderboardBody.innerHTML = '';

  if (sorted.length === 0) {
    const emptyRow = document.createElement('tr');
    const message = searchTerm ? 'Немає гравців за цим запитом' : 'Немає гравців у цій лізі';
    emptyRow.innerHTML = `<td colspan="10">${message}</td>`;
    leaderboardBody.append(emptyRow);
    return;
  }

  sorted.forEach((player, index) => {
    const displayRank = index + 1;
    const row = document.createElement('tr');
    const rankTier =
      typeof player?.rankTier === 'string' && player.rankTier.trim()
        ? player.rankTier
        : getRankTierByPlace(displayRank);
    const rankClass = getRankClass(rankTier);
    row.classList.add(rankClass || 'rank-none');
    const badgeMarkup = rankTier
      ? `<span class="rank-badge ${rankClass}" aria-label="Ранг ${rankTier}">${rankTier}</span>`
      : `<span class="rank-badge rank-none" aria-label="Ранг відсутній">${FALLBACK}</span>`;

    const seasonPointsLabel = formatNumberValue(player?.season_points ?? player?.totalPoints);
    const gamesLabel = formatNumberValue(player?.games);
    const winsLabel = formatNumberValue(player?.wins);
    const lossesLabel = formatNumberValue(player?.losses);
    const drawsLabel = formatNumberValue(player?.draws);
    const winRateLabel = formatPercentValue(player?.winRate, percentFormatter1);
    const roundsLabel = formatNumberValue(player?.rounds);
    const roundWinsLabel = formatNumberValue(player?.round_wins);
    const roundLossesLabel = formatNumberValue(player?.round_losses);
    const streaks = getPlayerStreaks(player, activeLeague);
    const winStreakLabel = formatNumberValue(streaks.winStreak);
    const lossStreakLabel = formatNumberValue(streaks.lossStreak);
    const mvpLabel = formatNumberValue(player?.MVP);

    const gamesTooltipParts = [];
    if (winsLabel !== FALLBACK) {
      gamesTooltipParts.push(`Перемоги: ${winsLabel}`);
    }
    if (lossesLabel !== FALLBACK) {
      gamesTooltipParts.push(`Поразки: ${lossesLabel}`);
    }
    if (drawsLabel !== FALLBACK) {
      gamesTooltipParts.push(`Нічиї: ${drawsLabel}`);
    }
    const gamesTooltip = gamesTooltipParts.join(' · ');

    const roundsTooltipParts = [];
    if (roundWinsLabel !== FALLBACK) {
      roundsTooltipParts.push(`Перемоги: ${roundWinsLabel}`);
    }
    if (roundLossesLabel !== FALLBACK) {
      roundsTooltipParts.push(`Поразки: ${roundLossesLabel}`);
    }
    const roundsTooltip = roundsTooltipParts.join(' · ');

    const winRateTooltipParts = [];
    if (winStreakLabel !== FALLBACK) {
      winRateTooltipParts.push(`Стрік перемог: ${winStreakLabel}`);
    }
    if (lossStreakLabel !== FALLBACK) {
      winRateTooltipParts.push(`Стрік поразок: ${lossStreakLabel}`);
    }
    const winRateTooltip = winRateTooltipParts.join(' · ');

    const displayName =
      (typeof player?.nickname === 'string' && player.nickname.trim()) ||
      (typeof player?.canonicalNickname === 'string' && player.canonicalNickname.trim()) ||
      FALLBACK;
    const playerNickname = displayName !== FALLBACK ? displayName : '';
    const clickNickname =
      resolveCanonicalNickname(player?.player ?? playerNickname, aliasMapGlobal) || playerNickname;

    row.innerHTML = `
      <td><span class="rank-chip">${formatNumberValue(displayRank)}</span></td>
      <td>
        <div>${displayName}</div>
        <small>${player?.realName ?? FALLBACK}</small>
        <button type="button" class="pixel-button" data-player="${playerNickname}">Профіль</button>
      </td>
      <td>${seasonPointsLabel}</td>
      <td>
        <span ${gamesTooltip ? `title="${gamesTooltip}"` : ''}>${gamesLabel}</span>
      </td>
      <td>${winsLabel}</td>
      <td>${lossesLabel}</td>
      <td>
        <span ${winRateTooltip ? `title="${winRateTooltip}"` : ''}>${winRateLabel}</span>
      </td>
      <td>
        <span ${roundsTooltip ? `title="${roundsTooltip}"` : ''}>${roundsLabel}</span>
      </td>
      <td>${mvpLabel}</td>
      <td>
        <span class="role-cell">
          ${badgeMarkup}
        </span>
      </td>
    `;

    const button = row.querySelector('button');
    button?.addEventListener('click', () => {
      renderModal(clickNickname || playerNickname || player);
    });
    leaderboardBody.append(row);
  });
}

function buildPlayerTimelineData(player, events, aliasMap = {}) {
  const empty = { delta: [], cumulative: [] };
  if (!player || !events) {
    return empty;
  }

  const candidateNames = new Set();
  const addCandidate = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        candidateNames.add(trimmed);
      }
    }
  };

  addCandidate(player?.nickname);
  addCandidate(player?.canonicalNickname);
  const aliases = Array.isArray(player?.aliases) ? player.aliases : [];
  aliases.forEach(addCandidate);

  if (candidateNames.size === 0) {
    return empty;
  }

  const normalizedCandidates = new Set();
  candidateNames.forEach((name) => {
    const normalized = normName(name, aliasMap);
    if (normalized) {
      normalizedCandidates.add(normalized);
    }
  });

  if (normalizedCandidates.size === 0) {
    return empty;
  }

  const pointsLog = Array.isArray(events?.pointsLog) ? events.pointsLog : [];
  const entries = pointsLog
    .map((entry, index) => {
      const normalizedPlayer = normName(entry?.player, aliasMap);
      if (!normalizedPlayer || !normalizedCandidates.has(normalizedPlayer)) {
        return null;
      }

      const dateRaw = typeof entry?.date === 'string' ? entry.date.trim() : '';
      const deltaValue = toFiniteNumber(entry?.delta);
      if (!dateRaw || deltaValue === null) {
        return null;
      }

      const timestamp = Date.parse(dateRaw);
      return {
        x: dateRaw,
        y: deltaValue,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        order: index
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        if (a.timestamp === null) {
          return 1;
        }
        if (b.timestamp === null) {
          return -1;
        }
        return a.timestamp - b.timestamp;
      }
      return a.order - b.order;
    });

  if (entries.length === 0) {
    return empty;
  }

  const deltaSeries = entries.map(({ x, y }) => ({ x, y }));
  const cumulativeSeries = [];
  let runningTotal = 0;
  for (const point of entries) {
    runningTotal += point.y;
    cumulativeSeries.push({ x: point.x, y: runningTotal });
  }

  return { delta: deltaSeries, cumulative: cumulativeSeries };
}

function buildPlayerChart(dataset, mode = 'delta') {
  if (!dataset || typeof dataset !== 'object') {
    return '<p>ще немає змін очок за датами</p>';
  }

  const series = mode === 'cum' ? dataset.cumulative : dataset.delta;
  if (!Array.isArray(series) || series.length === 0) {
    return '<p>ще немає змін очок за датами</p>';
  }

  const values = series.map((point) => toFiniteNumber(point?.y) ?? 0);

  const width = 360;
  const height = 240;
  const paddingX = 24;
  const paddingY = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? (width - paddingX * 2) / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = paddingX + step * index;
    const normalized = (value - min) / range;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const fillPoints = [
    `${paddingX},${height - paddingY}`,
    ...points,
    `${width - paddingX},${height - paddingY}`
  ].join(' ');

  const description = series
    .map((point, index) => {
      const label = mode === 'cum' ? 'Сумарно' : 'Δ';
      return `${label} ${point.x}: ${formatNumberValue(values[index])}`;
    })
    .join(', ');

  const baselineY = height - paddingY;
  const [lastX = '0', lastY = '0'] = points[points.length - 1]?.split(',') ?? [];
  const modeTitle = mode === 'cum' ? 'Накопичені очки' : 'Очки за матч';

  return `
    <svg class="player-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${modeTitle}">
      <title>${modeTitle}</title>
      <desc>${description}</desc>
      <rect x="${paddingX}" y="${paddingY}" width="${width - paddingX * 2}" height="${
    height - paddingY * 2
  }" fill="rgba(9, 14, 32, 0.65)" stroke="rgba(157, 215, 255, 0.2)"></rect>
      <polyline points="${fillPoints}" fill="rgba(255, 102, 196, 0.15)" stroke="none"></polyline>
      <polyline points="${points.join(' ')}" fill="none" stroke="#ff66c4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line x1="${paddingX}" y1="${baselineY}" x2="${width - paddingX}" y2="${baselineY}" stroke="rgba(255, 255, 255, 0.2)" stroke-dasharray="6 6"></line>
      <circle cx="${lastX}" cy="${lastY}" r="4.5" fill="#ffd700" stroke="#05070e" stroke-width="2"></circle>
    </svg>
  `;
}

function renderPairList(items, type) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="pair-placeholder">—</p>';
  }

  const markup = items
    .map((item) => {
      const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : FALLBACK;
      const countLabel = formatNumberValue(item?.count);

      if (type === 'teammates-most') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} ігор` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'teammates-wins') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} перемог` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'opponents-most') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} дуелей` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'opponents-losses') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} поразок` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'teammate') {
        const details = [];
        const gamesLabel = formatNumberValue(item?.games);
        const winsLabel = formatNumberValue(item?.wins);
        const wrLabel = formatPercentValue(item?.wr, percentFormatter1);
        if (gamesLabel !== FALLBACK) {
          details.push(`${gamesLabel} боїв`);
        }
        if (winsLabel !== FALLBACK) {
          details.push(`${winsLabel} перемог`);
        }
        if (wrLabel !== FALLBACK) {
          details.push(`WR ${wrLabel}`);
        }
        const detailText = details.length > 0 ? details.join(' · ') : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      const details = [];
      const meetingsLabel = formatNumberValue(item?.meetings);
      const wrLabel = formatPercentValue(item?.wr, percentFormatter1);
      if (meetingsLabel !== FALLBACK) {
        details.push(`${meetingsLabel} дуелей`);
      }
      if (wrLabel !== FALLBACK) {
        details.push(`WR ${wrLabel}`);
      }
      const detailText = details.length > 0 ? details.join(' · ') : FALLBACK;
      return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
    })
    .join('');

  return `<ul class="pair-list">${markup}</ul>`;
}

function renderModal(playerInput) {
  if (!modal) {
    return;
  }

  const profile = buildProfileForLeague(playerInput, activeLeague);
  if (!profile) {
    return;
  }

  openProfileKey =
    normalizeNickname(profile?.nickname ?? profile?.player ?? '', aliasMapGlobal) || '';

  const player = profile;

  modalTitle.textContent = `${player?.nickname ?? FALLBACK} · ${player?.team ?? FALLBACK}`;
  const gamesLabel = formatNumberValue(player?.games);
  const winsLabel = formatNumberValue(player?.wins);
  const lossesLabel = formatNumberValue(player?.losses);
  const winRateLabel = formatPercentValue(player?.winRate, percentFormatter1);
  const seasonPointsLabel = formatNumberValue(player?.season_points ?? player?.totalPoints);
  const mvpLabel = formatNumberValue(player?.MVP);
  const rankTier =
    typeof player?.rankTier === 'string' && player.rankTier.trim()
      ? player.rankTier
      : getRankTierByPlace(player?.rank);
  const winStreakLabel = formatNumberValue(player?.win_streak ?? player?.bestStreak);
  const lossStreakLabel = formatNumberValue(player?.loss_streak ?? player?.lossStreak);
  const roundsLabel = formatNumberValue(player?.rounds);
  const roundWinsLabel = formatNumberValue(player?.round_wins);
  const roundLossesLabel = formatNumberValue(player?.round_losses);
  const roundWinRateLabel = formatPercentValue(player?.roundWR, percentFormatter1);
  const recentScores = Array.isArray(player?.recentScores) ? player.recentScores : [];
  const hasRecentScores = recentScores.length > 0;
  const averageRecent =
    hasRecentScores
      ? recentScores.reduce((sum, score) => sum + (toFiniteNumber(score) ?? 0), 0) /
        recentScores.length
      : null;
  const tempoSummary = hasRecentScores
    ? `Середній темп — ${formatDecimalValue(averageRecent)} очок за ${formatNumberValue(
        recentScores.length
      )} останні бої.`
    : 'Немає даних про останні бої.';
  const recentResultsParagraph = hasRecentScores
    ? `<p>Останні результати: ${recentScores
        .map((value) => `${formatNumberValue(value)} очок`)
        .join(' · ')}.</p>`
    : '';

  const timeline = buildPlayerTimelineData(player, EVENTS, aliasMapGlobal);
  const hasTimeline = Array.isArray(timeline?.delta) && timeline.delta.length > 0;
  const defaultChartMode = 'cum';
  const chartControlsMarkup = hasTimeline
    ? `<div class="chart-mode-switch" role="radiogroup" aria-label="Режим графіка">
        <label><input type="radio" name="chart-mode" value="delta" /> Δ очки</label>
        <label><input type="radio" name="chart-mode" value="cum" checked /> Σ очки</label>
      </div>`
    : '';
  const chartMarkup = hasTimeline
    ? buildPlayerChart(timeline, defaultChartMode)
    : '<p>ще немає змін очок за датами</p>';

  modalBody.innerHTML = `
    <section>
      <h3>Основні показники</h3>
      <div class="detail-grid">
        <div>
          <strong>Ігор</strong>
          ${gamesLabel}
        </div>
        <div>
          <strong>Перемог</strong>
          ${winsLabel}
        </div>
        <div>
          <strong>Поразок</strong>
          ${lossesLabel}
        </div>
        <div>
          <strong>Win rate</strong>
          ${winRateLabel}
        </div>
        <div>
          <strong>Очок сезону</strong>
          ${seasonPointsLabel}
        </div>
        <div>
          <strong>Ранг</strong>
          ${rankTier ?? FALLBACK}
        </div>
        <div>
          <strong>Win стрик</strong>
          ${winStreakLabel !== FALLBACK ? `${winStreakLabel} перемог` : FALLBACK}
        </div>
        <div>
          <strong>Loss стрик</strong>
          ${lossStreakLabel !== FALLBACK ? `${lossStreakLabel} поразок` : FALLBACK}
        </div>
        <div>
          <strong>Раундів</strong>
          ${roundsLabel}
        </div>
        <div>
          <strong>Перемог у раундах</strong>
          ${roundWinsLabel}
        </div>
        <div>
          <strong>Поразок у раундах</strong>
          ${roundLossesLabel}
        </div>
        <div>
          <strong>WR раундів</strong>
          ${roundWinRateLabel}
        </div>
        <div>
          <strong>MVP</strong>
          ${mvpLabel}
        </div>
      </div>
    </section>
    <section>
      <h3>Останні матчі</h3>
      ${chartControlsMarkup}
      <div class="chart-wrapper" data-chart-wrapper>
        ${chartMarkup}
      </div>
      <p>${tempoSummary}</p>
      ${recentResultsParagraph}
    </section>
    <section>
      <h3>Топ напарників</h3>
      <div>
        <h4>Найчастіше разом</h4>
        ${renderPairList(player?.teammatesMost, 'teammates-most')}
      </div>
      <div>
        <h4>Перемог разом</h4>
        ${renderPairList(player?.teammatesMostWins, 'teammates-wins')}
      </div>
    </section>
    <section>
      <h3>Топ суперників</h3>
      <div>
        <h4>Найчастіші дуелі</h4>
        ${renderPairList(player?.opponentsMost, 'opponents-most')}
      </div>
      <div>
        <h4>Поразок від</h4>
        ${renderPairList(player?.opponentsMostLosses, 'opponents-losses')}
      </div>
    </section>
  `;

  if (hasTimeline) {
    const chartWrapper = modalBody.querySelector('[data-chart-wrapper]');
    const modeInputs = modalBody.querySelectorAll('input[name="chart-mode"]');
    modeInputs.forEach((input) => {
      input.addEventListener('change', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.checked) {
          chartWrapper.innerHTML = buildPlayerChart(timeline, event.target.value);
        }
      });
    });
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
}

function closeModal() {
  if (!modal) {
    return;
  }
  openProfileKey = '';
  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function rerenderOpenProfile() {
  if (!openProfileKey) {
    return;
  }

  const profile = buildProfileForLeague(openProfileKey, activeLeague);
  if (profile) {
    renderModal(profile);
  } else {
    closeModal();
  }
}

function startTicker(messages = []) {
  if (!tickerEl) {
    return;
  }
  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }
  const list = Array.isArray(messages) && messages.length > 0 ? messages : [FALLBACK];
  let index = 0;
  const update = () => {
    tickerEl.textContent = list[index];
    index = (index + 1) % list.length;
  };
  update();
  if (list.length > 1) {
    tickerTimer = window.setInterval(update, 4600);
  }
}

function updateTabs(targetButton) {
  tabButtons.forEach((button) => {
    const isActive = button === targetButton;
    button.setAttribute('aria-selected', String(isActive));
  });
}

function updateLeagueButtons(activeValue = activeLeague) {
  if (!leagueButtons || leagueButtons.length === 0) {
    return;
  }

  const normalizedActive = normalizeLeagueName(activeValue);
  leagueButtons.forEach((button) => {
    const targetValue = normalizeLeagueName(
      button.dataset.leagueTarget || button.dataset.leagueValue
    );
    const isAvailable = targetValue && leagueOptions.includes(targetValue);

    button.disabled = !isAvailable;
    button.dataset.leagueValue = targetValue;
    button.textContent = getLeagueLabel(targetValue);
    const isActive = isAvailable && targetValue === normalizedActive;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function bindTableControls() {
  if (controlsBound) {
    return;
  }
  controlsBound = true;

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sortKey = button.dataset.sort;
      if (!sortKey) {
        return;
      }
      if (currentSort === sortKey) {
        currentDirection = currentDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = sortKey;
        currentDirection = sortKey === 'rank' ? 'asc' : 'desc';
      }
      updateTabs(button);
      renderLeaderboard(getTop10ForActiveLeague());
    });
  });

  searchInput?.addEventListener('input', () => {
    renderLeaderboard(getTop10ForActiveLeague());
  });

  updateTabs(tabButtons[0] ?? null);
}

function getEffectiveLeague(targetLeague) {
  if (!Array.isArray(leagueOptions) || leagueOptions.length === 0) {
    return targetLeague ?? '';
  }

  const normalizedTarget = normalizeLeagueName(targetLeague);
  if (normalizedTarget && leagueOptions.includes(normalizedTarget)) {
    return normalizedTarget;
  }

  return leagueOptions[0] ?? normalizedTarget ?? targetLeague ?? '';
}

function getTop10ForActiveLeague() {
  if (activeLeague === 'kids') {

    return normalizedTop10ByLeague?.kids ?? [];
  }
  return normalizedTop10ByLeague?.sundaygames ?? [];

}

function renderAll(targetLeague = activeLeague) {
  const effectiveLeague = getEffectiveLeague(targetLeague || 'sundaygames');
  activeLeague = effectiveLeague;
  streakCache.clear();

  const aliasMap = aliasMapGlobal;

  ['kids', 'sundaygames'].forEach((league) => ensureLeagueStats(league));
  ensureLeagueStats(effectiveLeague);

  const leagueData = leagueStatsCache.get(effectiveLeague) ?? { playerStats: new Map(), metrics: {} };

  const leagueTopPlayers = getTop10ForActiveLeague();
  const leagueTopPlayersWithStats = filterPlayersByLeague(
    leagueTopPlayers,
    effectiveLeague
  )
    .map((player) => applyLeagueStats(player, effectiveLeague))
    .filter(Boolean);

  topPlayers = leagueTopPlayersWithStats;
  activeLeaguePlayers = leagueTopPlayersWithStats;
  profileLookupCurrent = buildProfileLookup(activeLeaguePlayers, aliasMap);

  const eligible = leagueTopPlayersWithStats;
  const pointsTotal = eligible.reduce(
    (sum, player) => sum + (toFiniteNumber(player?.season_points ?? player?.totalPoints) ?? 0),
    0
  );

  const leagueAggregates =
    effectiveLeague === 'kids'
      ? {}
      : {
          total_games: leagueData.metrics.totalGames,
          total_rounds: leagueData.metrics.totalRounds,
          avg_rounds_per_game: leagueData.metrics.avgRoundsPerGame,
          avg_players_per_game: leagueData.metrics.avgPlayersPerGame,
          players_with_games: leagueData.metrics.playersWithGames,
          players_in_rating: eligible.length,
          points_total: pointsTotal > 0 ? pointsTotal : null,
          points_positive_only: null,
          points_negative_only: null,
          longest_game_rounds: PACK?.aggregates?.longest_game_rounds,
          common_score: PACK?.aggregates?.common_score
        };

  renderMetricsFromAggregates(leagueAggregates, topPlayers, {
    ...leagueData.metrics,
    totalPoints: leagueAggregates.points_total,
    pointsPositiveOnly: leagueAggregates.points_positive_only,
    pointsNegativeOnly: leagueAggregates.points_negative_only
  });
  renderPodium(topPlayers);
  renderLeaderboard(getTop10ForActiveLeague());
  rerenderOpenProfile();
  updateLeagueButtons(activeLeague);
}

function bindLeagueSwitch() {
  if (leagueBound) {
    return;
  }
  leagueBound = true;

  const adultsButton = document.querySelector('[data-league-target="sundaygames"]');
  const kidsButton = document.querySelector('[data-league-target="kids"]');

  adultsButton?.addEventListener('click', () => {

    activeLeague = 'sundaygames';

    renderAll(activeLeague);
  });

  kidsButton?.addEventListener('click', () => {

    activeLeague = 'kids';


    renderAll(activeLeague);
  });
}

function bindProfile() {
  if (profileBound) {
    return;
  }
  profileBound = true;

  closeButton?.addEventListener('click', () => {
    closeModal();
  });

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeModal();
  });
}



// ===== FETCHERS (single source of truth) =====
async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити ${url}: ${response.status}`);
  }
  return response.json();
}

function resolveSeasonAsset(pathname) {
  if (typeof pathname !== 'string' || !pathname) {
    return pathname;
  }

  if (typeof window !== 'undefined') {
    const directoryHref = (() => {
      if (typeof document !== 'undefined' && document.baseURI) {
        try {
          return new URL('.', document.baseURI).href;
        } catch (error) {
          console.warn('[autumn2025] failed to resolve document.baseURI', error);
        }
      }

      const { origin, pathname: currentPath } = window.location ?? {};
      if (origin) {
        try {
          const base = currentPath ? `${origin}${currentPath}` : origin;
          return new URL('.', base).href;
        } catch (error) {
          console.warn('[autumn2025] failed to resolve window.location', error);
          return `${origin}/`;
        }
      }

      return undefined;
    })();

    if (directoryHref) {
      try {
        return new URL(pathname, directoryHref).href;
      } catch (error) {
        console.warn('[autumn2025] failed to resolve asset URL', pathname, error);
      }
    }
  }

  return pathname;
}

// ===== BOOT (single source of truth) =====
async function boot() {
  try {
    const [packData, eventsData, top10ByLeagueData, summerPack] = await Promise.all([
      fetchJSON(resolveSeasonAsset('ocinb2025_pack.json')).catch(() => null),
      fetchJSON(resolveSeasonAsset('sunday_autumn_2025_EVENTS.json')),
      fetchJSON(resolveSeasonAsset('ocinb2025_top10_by_league.json')),
      fetchJSON(resolveSeasonAsset('SL_Summer2025_pack.json')).catch(() => null)
    ]);

    PACK = packData;
    EVENTS = eventsData;
    seasonTop10ByLeague = top10ByLeagueData;

    aliasMapGlobal = { ...(summerPack?.aliases ?? {}), ...(PACK?.aliases ?? {}) };

    fallbackLeague =
      normalizeLeagueName(PACK?.meta?.league || EVENTS?.meta?.league || 'sundaygames') ||
      'sundaygames';

    normalizedEvents = Array.isArray(EVENTS?.events)
      ? EVENTS.events.map(normalizeEventEntry).filter(Boolean)
      : [];

    playerLeagueMap = buildPlayerLeagueMap(normalizedEvents);

    const aliasMap = aliasMapGlobal;
    rawTop10Kids = Array.isArray(seasonTop10ByLeague?.top10_kids)
      ? seasonTop10ByLeague.top10_kids
      : [];
    rawTop10Sunday = Array.isArray(seasonTop10ByLeague?.top10_sundaygames)
      ? seasonTop10ByLeague.top10_sundaygames
      : [];

    const packAllPlayersBase = normalizeTopPlayers(
      Array.isArray(PACK?.allPlayers) ? PACK.allPlayers : [],
      PACK?.meta ?? {},
      aliasMap
    );
    const packTopPlayers = normalizeTopPlayers(PACK?.top10 ?? [], PACK?.meta ?? {}, aliasMap);



    packAllPlayersNormalized = mergePlayerRecords(packAllPlayersBase, packTopPlayers, aliasMap);
    allPlayersNormalized = packAllPlayersNormalized;


    packPlayerIndex = new Map();
    packPlayerRawIndex = new Map();
    packAllPlayersNormalized.forEach((player) => {
      const key = canon(player?.nickname ?? player?.player ?? '');
      const rawKey =
        (typeof player?.nickname === 'string' && player.nickname.trim()) ||
        (typeof player?.player === 'string' && player.player.trim()) ||
        '';
      if (key) {
        packPlayerIndex.set(key, player);
      }
      if (rawKey) {
        packPlayerRawIndex.set(rawKey, player);
      }
    });

    normalizedTop10ByLeague = {
      kids: buildLeagueTop10(rawTop10Kids, 'kids'),
      sundaygames: buildLeagueTop10(rawTop10Sunday, 'sundaygames')
    };

    topPlayersNormalized = [
      ...normalizedTop10ByLeague.kids,
      ...normalizedTop10ByLeague.sundaygames
    ];

    [...normalizedTop10ByLeague.kids, ...normalizedTop10ByLeague.sundaygames].forEach(
      (entry) => {
        const normalizedKey = canon(entry?.player ?? entry?.nickname ?? '');
        const explicitLeague = normalizeLeagueName(entry?.leagueKey ?? entry?.league);
        if (normalizedKey && explicitLeague) {
          playerLeagueMap.set(normalizedKey, explicitLeague);
        }
      }
    );

    profileLookupAll = buildProfileLookup(packAllPlayersNormalized, aliasMap);
    profileLookupTop = buildProfileLookup(
      [...normalizedTop10ByLeague.kids, ...normalizedTop10ByLeague.sundaygames],
      aliasMap
    );

    const leaguesFromEvents = Array.from(
      new Set(normalizedEvents.map((event) => normalizeLeagueName(event?.league)).filter(Boolean))
    );

    const availableLeagues = new Set(leaguesFromEvents);

    if (Array.isArray(seasonTop10ByLeague?.leagues)) {
      seasonTop10ByLeague.leagues
        .map((league) => normalizeLeagueName(league))
        .filter(Boolean)
        .forEach((league) => availableLeagues.add(league));
    }
    if (seasonTop10ByLeague?.top10_kids) {
      availableLeagues.add('kids');
    }
    if (seasonTop10ByLeague?.top10_sundaygames) {
      availableLeagues.add('sundaygames');
    }


    if (availableLeagues.size === 0) {
      ['sundaygames', 'kids'].forEach((league) => availableLeagues.add(league));
    }

    const leaguesForStats = new Set([...availableLeagues, 'kids', 'sundaygames']);
    leagueStatsCache = new Map();
    leaguesForStats.forEach((league) => {
      leagueStatsCache.set(league, computeLeagueStats(normalizedEvents, league));
    });

    leagueOptions = ['sundaygames', 'kids'].filter((league) => availableLeagues.has(league));

    activeLeague = getEffectiveLeague('sundaygames');

    updateLeagueButtons(activeLeague);
    renderAll(activeLeague);

    bindLeagueSwitch();
    bindTableControls();
    bindProfile();
  } catch (error) {
    console.error('[autumn2025] boot failed', error);
    if (metricsGrid) {
      metricsGrid.innerHTML =
        '<p class="error">Не вдалося завантажити дані осіннього сезону.</p>';
    }
  }
}

boot();
