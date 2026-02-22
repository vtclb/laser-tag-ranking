const seasonsConfig = {
  currentSeasonId: 'winter-2025-26',
  endpoints: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbx4MNY6MpV90LiF9lN42BZ4CYle83dCC72WfGCINk-pTeHcpCc7WdxL2QtHGIqIBodf/exec'
  },
  leagues: {
    kids: { label: 'Молодша', aliases: [] },
    sundaygames: { label: 'Старша', aliases: ['olds', 'adults'] }
  },
  seasons: [
    { id: 'winter-2025-26', uiLabel: 'Winter 2025/26', enabled: true, dateStart: '2025-12-01', dateEnd: '2026-03-31', sources: { kidsSheet: 'kids', sundaygamesSheet: 'sundaygames', gamesSheet: 'games' } },
    { id: 'autumn-2025', uiLabel: 'Autumn 2025', enabled: true, dateStart: '2025-09-01', dateEnd: '2025-11-30', sources: { seasonSheet: 'autumn2025', gamesSheet: 'autumn2025' } },
    { id: 'summer-2025', uiLabel: 'Summer 2025', enabled: true, dateStart: '2025-06-01', dateEnd: '2025-08-31', sources: { seasonSheet: 'archive', gamesSheet: 'archive' } }
  ]
};

export default seasonsConfig;
