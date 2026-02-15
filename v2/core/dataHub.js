import seasonsConfig from './seasons.config.json' assert { type: 'json' };

const LEAGUES = ['kids', 'sundaygames'];

const MOCK_DATA = {
  'summer-2025': {
    kids: {
      seasonStats: { games: 24, wins: 24, draws: 3 },
      table: [
        { nick: 'BlazeKid', points: 1265, games: 31, wins: 22, draws: 2, rank: 'S', inactive: false },
        { nick: 'NovaFox', points: 1205, games: 29, wins: 20, draws: 3, rank: 'S', inactive: false },
        { nick: 'Pulse', points: 990, games: 25, wins: 16, draws: 4, rank: 'B', inactive: false },
        { nick: 'Ghost', points: 876, games: 24, wins: 14, draws: 3, rank: 'B', inactive: false },
        { nick: 'Falcon', points: 788, games: 22, wins: 12, draws: 4, rank: 'C', inactive: false },
        { nick: 'Mango', points: 701, games: 20, wins: 10, draws: 3, rank: 'C', inactive: false },
        { nick: 'Rocket', points: 612, games: 18, wins: 8, draws: 2, rank: 'C', inactive: false },
        { nick: 'Pixel', points: 525, games: 15, wins: 6, draws: 2, rank: 'D', inactive: false },
        { nick: 'Comet', points: 418, games: 13, wins: 4, draws: 1, rank: 'D', inactive: true },
        { nick: 'Tiger', points: 280, games: 9, wins: 2, draws: 1, rank: 'E', inactive: true }
      ],
      tournaments: [
        { name: 'Summer Clash', date: '2025-07-21', winner: 'BlazeKid' }
      ]
    },
    sundaygames: {
      seasonStats: { games: 20, wins: 20, draws: 2 },
      table: [
        { nick: 'Raptor', points: 1288, games: 28, wins: 21, draws: 1, rank: 'S', inactive: false },
        { nick: 'Ares', points: 1190, games: 26, wins: 18, draws: 3, rank: 'S', inactive: false },
        { nick: 'Matrix', points: 1018, games: 25, wins: 16, draws: 2, rank: 'A', inactive: false },
        { nick: 'Warden', points: 923, games: 22, wins: 14, draws: 2, rank: 'B', inactive: false },
        { nick: 'Rex', points: 834, games: 21, wins: 12, draws: 3, rank: 'B', inactive: false },
        { nick: 'Duke', points: 744, games: 19, wins: 10, draws: 2, rank: 'C', inactive: false },
        { nick: 'Titan', points: 610, games: 17, wins: 8, draws: 1, rank: 'C', inactive: false },
        { nick: 'Golem', points: 502, games: 14, wins: 6, draws: 0, rank: 'D', inactive: false },
        { nick: 'PulseX', points: 399, games: 12, wins: 3, draws: 1, rank: 'E', inactive: true },
        { nick: 'Hawk', points: 250, games: 8, wins: 1, draws: 0, rank: 'E', inactive: true }
      ],
      tournaments: [
        { name: 'Sunday Cup I', date: '2025-08-03', winner: 'Raptor' }
      ]
    }
  },
  'autumn-2025': {
    kids: {
      seasonStats: { games: 18, wins: 18, draws: 2 },
      table: [
        { nick: 'NovaFox', points: 1100, games: 24, wins: 18, draws: 2, rank: 'A', inactive: false },
        { nick: 'BlazeKid', points: 1080, games: 23, wins: 17, draws: 1, rank: 'A', inactive: false },
        { nick: 'Falcon', points: 860, games: 20, wins: 12, draws: 2, rank: 'B', inactive: false },
        { nick: 'Ghost', points: 770, games: 19, wins: 11, draws: 1, rank: 'C', inactive: false },
        { nick: 'Mango', points: 640, games: 17, wins: 9, draws: 1, rank: 'C', inactive: false }
      ],
      tournaments: []
    },
    sundaygames: {
      seasonStats: { games: 18, wins: 18, draws: 3 },
      table: [
        { nick: 'Ares', points: 1160, games: 24, wins: 18, draws: 2, rank: 'A', inactive: false },
        { nick: 'Raptor', points: 1140, games: 22, wins: 16, draws: 2, rank: 'A', inactive: false },
        { nick: 'Warden', points: 920, games: 20, wins: 13, draws: 2, rank: 'B', inactive: false },
        { nick: 'Matrix', points: 890, games: 19, wins: 12, draws: 1, rank: 'B', inactive: false },
        { nick: 'Rex', points: 700, games: 17, wins: 9, draws: 1, rank: 'C', inactive: false }
      ],
      tournaments: []
    }
  },
  'winter-2025-26': {
    kids: {
      seasonStats: { games: 12, wins: 12, draws: 1 },
      table: [
        { nick: 'NovaFox', points: 650, games: 14, wins: 10, draws: 1, rank: 'C', inactive: false },
        { nick: 'BlazeKid', points: 620, games: 13, wins: 9, draws: 1, rank: 'C', inactive: false },
        { nick: 'Pulse', points: 540, games: 13, wins: 8, draws: 1, rank: 'D', inactive: false },
        { nick: 'Falcon', points: 430, games: 11, wins: 6, draws: 1, rank: 'D', inactive: false },
        { nick: 'Ghost', points: 320, games: 10, wins: 4, draws: 1, rank: 'E', inactive: true }
      ],
      tournaments: [
        { name: 'Winter Junior Open', date: '2026-01-19', winner: 'NovaFox' }
      ]
    },
    sundaygames: {
      seasonStats: { games: 12, wins: 12, draws: 2 },
      table: [
        { nick: 'Raptor', points: 690, games: 15, wins: 11, draws: 1, rank: 'C', inactive: false },
        { nick: 'Ares', points: 670, games: 14, wins: 10, draws: 2, rank: 'C', inactive: false },
        { nick: 'Matrix', points: 570, games: 12, wins: 8, draws: 1, rank: 'D', inactive: false },
        { nick: 'Warden', points: 490, games: 12, wins: 7, draws: 1, rank: 'D', inactive: false },
        { nick: 'Rex', points: 350, games: 10, wins: 4, draws: 1, rank: 'E', inactive: false }
      ],
      tournaments: [
        { name: 'Winter Sunday Cup', date: '2026-01-26', winner: 'Raptor' }
      ]
    }
  }
};

function getCurrentSeasonId() {
  return Object.keys(seasonsConfig).find((key) => seasonsConfig[key].current) || 'winter-2025-26';
}

function getPlayerProfile(nick, seasonId, league) {
  if (!nick) return null;

  const seasonRecords = Object.entries(MOCK_DATA)
    .map(([sid, seasonData]) => {
      const leagueData = seasonData[league];
      const player = leagueData?.table.find((item) => item.nick.toLowerCase() === nick.toLowerCase());
      if (!player) return null;
      return {
        seasonId: sid,
        seasonTitle: seasonsConfig[sid]?.title || sid,
        games: player.games,
        wins: player.wins,
        draws: player.draws,
        points: player.points
      };
    })
    .filter(Boolean);

  if (!seasonRecords.length) return null;

  const totalGames = seasonRecords.reduce((sum, item) => sum + item.games, 0);
  const totalWins = seasonRecords.reduce((sum, item) => sum + item.wins, 0);
  const totalDraws = seasonRecords.reduce((sum, item) => sum + item.draws, 0);

  return {
    nick,
    currentSeason: seasonId,
    overview: {
      season: seasonRecords.find((item) => item.seasonId === seasonId) || seasonRecords[0],
      allTime: {
        games: totalGames,
        wins: totalWins,
        draws: totalDraws,
        winrate: totalGames ? totalWins / totalGames : 0
      }
    },
    statsBySeason: seasonRecords,
    insights: {
      teammateMost: 'Falcon',
      opponentMost: 'Raptor',
      winrateWith: 0.61,
      winrateAgainst: 0.54,
      form: 'WWLWW'
    }
  };
}

export function getSeasons() {
  return seasonsConfig;
}

export function getData({ seasonId, league, nick } = {}) {
  const resolvedSeasonId = seasonId && MOCK_DATA[seasonId] ? seasonId : getCurrentSeasonId();
  const resolvedLeague = LEAGUES.includes(league) ? league : 'kids';
  const seasonData = MOCK_DATA[resolvedSeasonId][resolvedLeague];

  return {
    season: {
      id: resolvedSeasonId,
      title: seasonsConfig[resolvedSeasonId].title
    },
    league: resolvedLeague,
    seasonStats: seasonData.seasonStats,
    top3: seasonData.table.slice(0, 3),
    table: seasonData.table,
    playerProfile: getPlayerProfile(nick, resolvedSeasonId, resolvedLeague),
    tournaments: seasonData.tournaments
  };
}
