const seasonsConfig = {
  currentSeasonId: 'spring_2026',
  endpoints: {
    gasUrl: 'https://script.google.com/macros/s/AKfycbzIuGIL5xC2gIhHKypLzTcz6ORApWZ-Q3uOqSlEZvZ6DriCmOSC24NgjXSYmZVP_QLgeA/exec'
  },
  leagues: {
    kids: { label: 'Молодша', aliases: [] },
    sundaygames: { label: 'Старша', aliases: ['olds', 'adults', 'sunday'] }
  },
  seasons: [
    { id: 'spring_2026', uiLabel: 'Весна 2026', enabled: true, dateStart: '2026-03-01', dateEnd: '2026-05-31', isStatic: true },
    { id: 'winter_2025_2026', uiLabel: 'Зима 2025–2026', enabled: true, dateStart: '2025-12-01', dateEnd: '2026-02-28', isStatic: false },
    { id: 'autumn_2025', uiLabel: 'Осінь 2025', enabled: true, dateStart: '2025-09-01', dateEnd: '2025-11-30', isStatic: false },
    { id: 'summer_2025', uiLabel: 'Літо 2025', enabled: true, dateStart: '2025-06-01', dateEnd: '2025-08-31', isStatic: false }
  ]
};

export default seasonsConfig;
