const seasonsConfig = {
  currentSeasonId: 'spring_2026',
  endpoints: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbyDdfnyXW_RPX3TWN-WLK5whqS366ZhacX1nYJ4tVkfx898_CHhAZDB13eTYKgn5n7Q/exec'
  },
  leagues: {
    kids: { label: 'Молодша', aliases: [] },
    sundaygames: { label: 'Старша', aliases: ['olds', 'adults', 'sunday'] }
  },
  seasons: [
    { id: 'spring_2026', uiLabel: 'Весна 2026', enabled: true, dateStart: '2026-03-01', dateEnd: '2026-06-30', isStatic: false },
    { id: 'winter_2025_2026', uiLabel: 'Зима 2025/26', enabled: true, dateStart: '2025-12-01', dateEnd: '2026-02-28', isStatic: false },
    { id: 'autumn_2025', uiLabel: 'Autumn 2025', enabled: true, dateStart: '2025-09-01', dateEnd: '2025-11-30', isStatic: false },
    { id: 'summer_2025', uiLabel: 'Summer 2025', enabled: true, dateStart: '2025-06-01', dateEnd: '2025-08-31', isStatic: false }
  ]
};

export default seasonsConfig;
