const seasonsConfig = {
  currentSeasonId: 'winter-2025-26',
  endpoints: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbx4MNY6MpV90LiF9lN42BZ4CYle83dCC72WfGCINk-pTeHcpCc7WdxL2QtHGIqIBodf/exec'
  },
  leagues: {
    kids: { label: 'Молодша', aliases: [] },
    sundaygames: { label: 'Старша', aliases: ['olds', 'adults'] }
  },
  seasonSourcesMap: {
    'autumn-2025': { seasonSheet: 'ocinb2025', gamesSheet: 'games', logsSheet: 'logs' },
    'summer-2025': { seasonSheet: 'archive', gamesSheet: 'games', logsSheet: 'logs' },
    'winter-2025-26': { kidsSheet: 'kids', sundaygamesSheet: 'sundaygames', gamesSheet: 'games', logsSheet: 'logs' }
  },
  seasons: [
    { id: 'winter-2025-26', uiLabel: 'Winter 2025/26', enabled: true, dateStart: '2025-12-01', dateEnd: '2026-03-31', isStatic: false, sources: { kidsSheet: 'kids', sundaygamesSheet: 'sundaygames', gamesSheet: 'games', logsSheet: 'logs' } },
    { id: 'autumn-2025', uiLabel: 'Autumn 2025', enabled: true, dateStart: '2025-09-01', dateEnd: '2025-11-30', isStatic: true, sources: { seasonSheet: 'ocinb2025', gamesSheet: 'games', logsSheet: 'logs' } },
    { id: 'summer-2025', uiLabel: 'Summer 2025', enabled: true, dateStart: '2025-06-01', dateEnd: '2025-08-31', isStatic: true, sources: { seasonSheet: 'archive', gamesSheet: 'games', logsSheet: 'logs' } }
  ]
};

export default seasonsConfig;
