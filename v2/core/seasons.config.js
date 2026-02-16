const seasonsConfig = {
  currentSeasonId: 'winter-2025-26',
  endpoints: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbz8VE2T92wCFKFU_xbiFdCg7M_-x7MS-Pg_5zMcxDTwKxVIJWpA81KPbHTa7a-G1gwKxw/exec'
  },
  leagues: {
    kids: {
      label: 'Молодша',
      aliases: []
    },
    sundaygames: {
      label: 'Старша',
      aliases: ['olds']
    }
  },
  seasons: [
    {
      id: 'winter-2025-26',
      uiLabel: 'Winter 2025/26',
      current: true,
      enabled: true,
      sources: {
        kidsSheet: 'kids',
        sundaygamesSheet: 'sundaygames',
        gamesSheet: 'games',
        logsSheet: 'logs',
        avatarsAction: 'listAvatars'
      }
    },
    {
      id: 'autumn-2025',
      uiLabel: 'Autumn 2025',
      enabled: true,
      sources: {
        seasonSheet: 'ocinb2025',
        gamesSheet: 'ocinb2025',
        logsSheet: 'ocinb2025'
      }
    },
    {
      id: 'summer-2025',
      uiLabel: 'Summer 2025',
      enabled: true,
      sources: {
        seasonSheet: 'archive',
        gamesSheet: 'archive',
        logsSheet: 'archive'
      }
    }
  ]
};

export default seasonsConfig;
