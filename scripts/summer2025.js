'use strict';

function nameAlias(nickname) {
  return nickname === 'Kуmar' ? 'Kumar' : nickname;
}

function getRankTierByPlace(place) {
  const rank = Number(place);
  if (!Number.isFinite(rank) || rank <= 0) {
    return '—';
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

const topPlayers = [
  {
    rank: 1,
    nickname: 'Laston',
    realName: 'Владислав Ластон',
    team: 'Sunday League',
    totalPoints: 1180,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'S',
    role: 'Капітан',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 2,
    nickname: 'Leres',
    realName: 'Олексій Лерес',
    team: 'Sunday League',
    totalPoints: 1099,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'S',
    role: 'Снайпер',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 3,
    nickname: 'Zavodchanyn',
    realName: 'Дмитро Заводчанин',
    team: 'Sunday League',
    totalPoints: 995,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'S',
    role: 'Штурмовик',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 4,
    nickname: 'Justy',
    realName: 'Юстина Justy',
    team: 'Sunday League',
    totalPoints: 965,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'A',
    role: 'Ігровий лідер',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 5,
    nickname: 'Slavon',
    realName: 'В’ячеслав Славон',
    team: 'Sunday League',
    totalPoints: 955,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'A',
    role: 'Стратег',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 6,
    nickname: 'Kуmar',
    realName: 'Роман Кумар',
    team: 'Sunday League',
    totalPoints: 920,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'A',
    role: 'Фронтлайн',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 7,
    nickname: 'Кицюня',
    realName: 'Катерина «Кицюня»',
    team: 'Sunday League',
    totalPoints: 895,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'A',
    role: 'Плеймейкер',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 8,
    nickname: 'RuBisCo',
    realName: 'Роман RuBisCo',
    team: 'Sunday League',
    totalPoints: 851,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'B',
    role: 'Аналітик',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 9,
    nickname: 'Оксанка',
    realName: 'Оксана П.',
    team: 'Sunday League',
    totalPoints: 850,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'B',
    role: 'Підтримка',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  },
  {
    rank: 10,
    nickname: 'Voron',
    realName: 'Андрій Ворон',
    team: 'Sunday League',
    totalPoints: 830,
    averagePoints: 0,
    games: 0,
    wins: 0,
    winRate: 0,
    bestStreak: 0,
    lossStreak: 0,
    MVP: 0,
    rankTier: 'B',
    role: 'Розвідник',
    accuracy: 0,
    tagsPerGame: 0,
    assistsPerGame: 0,
    clutchPlays: 0,
    disarms: 0,
    highlights: [],
    story: '',
    recentScores: [],
    recentAccuracy: [],
    teammateTop: [],
    opponentTop: [],
    winWith: [],
    loseWith: [],
    mostLostTo: { name: '—', count: 0 },
    dangerous: { name: '—', meetings: 0, wr: '—' },
    loadout: '',
    favoriteArena: ''
  }
];

const seasonGeneral = {
  title: 'Літній сезон 2025',
  tours: 12,
  finals: 2,
  totalGamesLogged: 1422,
  totalRounds: 4266,
  totalPointsScored: 9540,
  totalWins: 729,
  overtimeMatches: 32,
  uniquePlayers: 64,
  newcomers: 19,
  activeTeams: 14,
  averageWinRate: 0.512,
  averageAccuracy: 0.463,
  averagePointsPerGame: 6.7,
  arenas: ['LaserTown', 'SKY Arena', 'Арсенал'],
  podium: ['Laston', 'Leres', 'Zavodchanyn']
};

const seasonPointsSummary = {
  podiumPoints: 3274,
  podiumShare: 0.3431,
  averageTop10: 954,
  medianTop10: 938,
  standardDeviation: 108.3,
  minPoints: 830,
  maxPoints: 1180,
  pointsByTier: [
    { tier: 'S', players: 3, total: 3274 },
    { tier: 'A', players: 4, total: 3735 },
    { tier: 'B', players: 3, total: 2531 }
  ],
  biggestClimb: { player: 'Voron', positions: 6 },
  closestRace: { players: ['RuBisCo', 'Оксанка'], diff: 1 }
};

const gamesPlayedByPlayer = {
  Laston: {
    games: 136,
    wins: 81,
    losses: 55,
    winRate: 0.5956,
    bestStreak: 7,
    lossStreak: 5,
    mvp: 45,
    accuracy: 0.482,
    tagsPerGame: 21.7,
    assistsPerGame: 6.8,
    clutchPlays: 21,
    disarms: 18,
    favoriteArena: 'LaserTown',
    loadout: 'Fang v5 + Proton Shield',
    highlights: [
      '45 MVP-виступів за сезон',
      'Серія з 7 перемог у червні',
      'Найкращий камбек сезону у фіналі'
    ],
    story: 'Капітан Sunday League, який тримає стабільний темп від першої до останньої гри.'
  },
  Leres: {
    games: 136,
    wins: 85,
    losses: 51,
    winRate: 0.625,
    bestStreak: 7,
    lossStreak: 4,
    mvp: 17,
    accuracy: 0.497,
    tagsPerGame: 22.4,
    assistsPerGame: 5.1,
    clutchPlays: 18,
    disarms: 14,
    favoriteArena: 'LaserTown',
    loadout: 'Nova Carbine + Cryo Vest',
    highlights: [
      '85 перемог — найкращий показник сезону',
      '120 очок у вирішальному турі',
      'Понад 50% точності зі снайперки'
    ],
    story: 'Холоднокровний снайпер, який контролює центр арени навіть у найнапруженіші хвилини.'
  },
  Zavodchanyn: {
    games: 137,
    wins: 73,
    losses: 64,
    winRate: 0.5328,
    bestStreak: 7,
    lossStreak: 6,
    mvp: 31,
    accuracy: 0.471,
    tagsPerGame: 20.3,
    assistsPerGame: 6.4,
    clutchPlays: 16,
    disarms: 11,
    favoriteArena: 'SKY Arena',
    loadout: 'Atlas Rifle + Recon Drone',
    highlights: [
      '31 раз виходив MVP',
      'Серія контратак у півфіналі',
      'Найвищий середній по асистах серед штурмовиків'
    ],
    story: 'Найагресивніший штурмовик сезону, що першим відкриває проходи для команди.'
  },
  Justy: {
    games: 151,
    wins: 78,
    losses: 73,
    winRate: 0.5166,
    bestStreak: 6,
    lossStreak: 6,
    mvp: 27,
    accuracy: 0.458,
    tagsPerGame: 19.8,
    assistsPerGame: 7.2,
    clutchPlays: 19,
    disarms: 13,
    favoriteArena: 'Арсенал',
    loadout: 'Tempest SMG + Nano Shield',
    highlights: [
      'Очолювала команду в усіх 12 турах',
      'Переломний клатч у фіналі з RuBisCo',
      'Лідерка за результативними передачами'
    ],
    story: 'Розуміє карту краще за всіх і задає темп у ключових розіграшах.'
  },
  Slavon: {
    games: 167,
    wins: 85,
    losses: 82,
    winRate: 0.509,
    bestStreak: 5,
    lossStreak: 4,
    mvp: 17,
    accuracy: 0.452,
    tagsPerGame: 18.9,
    assistsPerGame: 6.1,
    clutchPlays: 14,
    disarms: 15,
    favoriteArena: 'LaserTown',
    loadout: 'Marauder Shotgun + EMP Grenades',
    highlights: [
      'Виграв 10 з 12 турів у якості капітана',
      'Найменше програних овертаймів',
      'Створив 15 комбінацій із саппортами'
    ],
    story: 'Тактик, який навчив Sunday League дисциплінованій обороні та швидким ротаціям.'
  },
  Kumar: {
    games: 185,
    wins: 91,
    losses: 94,
    winRate: 0.4919,
    bestStreak: 5,
    lossStreak: 7,
    mvp: 12,
    accuracy: 0.447,
    tagsPerGame: 18.3,
    assistsPerGame: 5.4,
    clutchPlays: 11,
    disarms: 12,
    favoriteArena: 'Арсенал',
    loadout: 'Jolt Carbine + Heavy Armor',
    highlights: [
      '185 зіграних матчів — рекорд сезону',
      'Найкращий показник блоків у фіналах',
      'Тримає лінію навіть у меншині'
    ],
    story: 'Фронтлайн, який приймає перший контакт і розчищає простір для нападників.'
  },
  'Кицюня': {
    games: 124,
    wins: 59,
    losses: 65,
    winRate: 0.4758,
    bestStreak: 7,
    lossStreak: 7,
    mvp: 8,
    accuracy: 0.438,
    tagsPerGame: 17.6,
    assistsPerGame: 7.9,
    clutchPlays: 9,
    disarms: 8,
    favoriteArena: 'Арсенал',
    loadout: 'Saber Pistol + Support Drone',
    highlights: [
      'Зробила 7 серій асистів поспіль',
      'Перший female MVP сезону',
      'Рекорд за стабільністю точності у плей-офф'
    ],
    story: 'Плеймейкерка, що тримає команду в тонусі, відкриваючи позиції для снайперів.'
  },
  RuBisCo: {
    games: 71,
    wins: 40,
    losses: 31,
    winRate: 0.5634,
    bestStreak: 8,
    lossStreak: 6,
    mvp: 18,
    accuracy: 0.514,
    tagsPerGame: 23.5,
    assistsPerGame: 4.8,
    clutchPlays: 13,
    disarms: 10,
    favoriteArena: 'SKY Arena',
    loadout: 'Ionic Rifle + Phase Boots',
    highlights: [
      'Найточніший гравець сезону — 51.4%',
      '8 перемог поспіль у фінальній серії',
      '18 MVP при мінімальній кількості ігор'
    ],
    story: 'Аналітик і шутер, що читає суперника ще до стартового свистка.'
  },
  'Оксанка': {
    games: 197,
    wins: 74,
    losses: 123,
    winRate: 0.3756,
    bestStreak: 5,
    lossStreak: 9,
    mvp: 7,
    accuracy: 0.429,
    tagsPerGame: 16.1,
    assistsPerGame: 6.3,
    clutchPlays: 7,
    disarms: 9,
    favoriteArena: 'Арсенал',
    loadout: 'Pulse SMG + Tactical Scanner',
    highlights: [
      '197 матчів стабільної гри у саппорт-ролі',
      '7 клатчів у вирішальних раундах',
      'Провела 9 навчальних буткемпів для новачків'
    ],
    story: 'Підтримка, яка закриває тила і підказує партнерам кожен рух суперника.'
  },
  Voron: {
    games: 118,
    wins: 63,
    losses: 55,
    winRate: 0.5339,
    bestStreak: 7,
    lossStreak: 4,
    mvp: 16,
    accuracy: 0.461,
    tagsPerGame: 19.1,
    assistsPerGame: 5.7,
    clutchPlays: 12,
    disarms: 11,
    favoriteArena: 'LaserTown',
    loadout: 'Longbow Rifle + Cloak Module',
    highlights: [
      'Найкращий скаут у трансляціях сезону',
      'Переможний фланговий прорив у фіналі',
      '12 клатчів та 16 MVP-плашок'
    ],
    story: 'Розвідник, який ловить суперників на ротаціях і ставить команду в вигідні позиції.'
  }
};

const timeSeries = {
  Laston: {
    scores: [112, 98, 104, 121, 109, 115, 107, 114],
    accuracy: [0.47, 0.48, 0.49, 0.5, 0.49, 0.5, 0.51, 0.52]
  },
  Leres: {
    scores: [108, 111, 117, 120, 113, 118, 116, 122],
    accuracy: [0.49, 0.5, 0.51, 0.52, 0.5, 0.51, 0.52, 0.53]
  },
  Zavodchanyn: {
    scores: [96, 101, 99, 105, 98, 103, 107, 110],
    accuracy: [0.46, 0.47, 0.47, 0.48, 0.47, 0.48, 0.49, 0.49]
  },
  Justy: {
    scores: [88, 94, 101, 97, 103, 109, 104, 106],
    accuracy: [0.44, 0.45, 0.46, 0.46, 0.47, 0.47, 0.48, 0.49]
  },
  Slavon: {
    scores: [92, 95, 98, 101, 96, 99, 103, 100],
    accuracy: [0.43, 0.44, 0.44, 0.45, 0.44, 0.45, 0.46, 0.46]
  },
  Kumar: {
    scores: [84, 90, 87, 93, 95, 88, 91, 97],
    accuracy: [0.42, 0.43, 0.43, 0.44, 0.44, 0.45, 0.45, 0.46]
  },
  'Кицюня': {
    scores: [79, 83, 88, 85, 90, 94, 92, 96],
    accuracy: [0.41, 0.41, 0.42, 0.43, 0.43, 0.44, 0.44, 0.45]
  },
  RuBisCo: {
    scores: [115, 118, 110, 123, 119, 116, 122, 125],
    accuracy: [0.5, 0.51, 0.52, 0.53, 0.52, 0.53, 0.54, 0.55]
  },
  'Оксанка': {
    scores: [72, 75, 78, 81, 80, 82, 79, 83],
    accuracy: [0.4, 0.41, 0.41, 0.42, 0.42, 0.43, 0.43, 0.44]
  },
  Voron: {
    scores: [94, 98, 101, 103, 99, 105, 108, 110],
    accuracy: [0.45, 0.45, 0.46, 0.47, 0.46, 0.47, 0.48, 0.48]
  }
};

const pairStats = {
  Laston: {
    teammateTop: [
      { name: 'Leres', games: 38, wins: 28, wr: 0.737 },
      { name: 'Justy', games: 31, wins: 20, wr: 0.645 },
      { name: 'RuBisCo', games: 18, wins: 15, wr: 0.833 }
    ],
    opponentTop: [
      { name: 'Slavon', meetings: 30, wr: 0.53 },
      { name: 'Кицюня', meetings: 24, wr: 0.58 },
      { name: 'Voron', meetings: 18, wr: 0.61 }
    ],
    winWith: [
      { name: 'Дует з Leres', record: '28-10' },
      { name: 'Комбінація з Justy', record: '20-11' }
    ],
    loseWith: [{ name: 'Експериментальна лінія', record: '6-12' }],
    mostLostTo: { name: 'Slavon', count: 12 },
    dangerous: { name: 'Justy', meetings: 22, wr: '45%' }
  },
  Leres: {
    teammateTop: [
      { name: 'Laston', games: 38, wins: 28, wr: 0.737 },
      { name: 'RuBisCo', games: 21, wins: 16, wr: 0.762 },
      { name: 'Кицюня', games: 19, wins: 13, wr: 0.684 }
    ],
    opponentTop: [
      { name: 'Voron', meetings: 26, wr: 0.58 },
      { name: 'Slavon', meetings: 29, wr: 0.55 },
      { name: 'Justy', meetings: 24, wr: 0.5 }
    ],
    winWith: [
      { name: 'Комбінація Laston/Leres', record: '28-10' },
      { name: 'Дует з RuBisCo', record: '16-5' }
    ],
    loseWith: [{ name: 'Формат без саппорту', record: '7-12' }],
    mostLostTo: { name: 'Voron', count: 11 },
    dangerous: { name: 'Slavon', meetings: 29, wr: '55%' }
  },
  Zavodchanyn: {
    teammateTop: [
      { name: 'Justy', games: 24, wins: 16, wr: 0.667 },
      { name: 'Kumar', games: 25, wins: 14, wr: 0.56 },
      { name: 'Оксанка', games: 28, wins: 14, wr: 0.5 }
    ],
    opponentTop: [
      { name: 'Laston', meetings: 27, wr: 0.48 },
      { name: 'RuBisCo', meetings: 18, wr: 0.52 },
      { name: 'Кицюня', meetings: 21, wr: 0.49 }
    ],
    winWith: [
      { name: 'Команда Justy', record: '16-8' },
      { name: 'Пара з Kumar', record: '14-11' }
    ],
    loseWith: [{ name: 'Експериментальна четвірка', record: '5-13' }],
    mostLostTo: { name: 'Laston', count: 12 },
    dangerous: { name: 'RuBisCo', meetings: 18, wr: '52%' }
  },
  Justy: {
    teammateTop: [
      { name: 'Zavodchanyn', games: 24, wins: 16, wr: 0.667 },
      { name: 'Кицюня', games: 22, wins: 15, wr: 0.682 },
      { name: 'Voron', games: 20, wins: 13, wr: 0.65 }
    ],
    opponentTop: [
      { name: 'Laston', meetings: 26, wr: 0.46 },
      { name: 'Leres', meetings: 24, wr: 0.5 },
      { name: 'Kumar', meetings: 29, wr: 0.48 }
    ],
    winWith: [
      { name: 'Склади з Zavodchanyn', record: '16-8' },
      { name: 'Фінальні спринти', record: '12-6' }
    ],
    loseWith: [{ name: 'Подвійний саппорт', record: '6-14' }],
    mostLostTo: { name: 'Laston', count: 14 },
    dangerous: { name: 'Kumar', meetings: 29, wr: '48%' }
  },
  Slavon: {
    teammateTop: [
      { name: 'Оксанка', games: 34, wins: 19, wr: 0.559 },
      { name: 'Kumar', games: 27, wins: 15, wr: 0.556 },
      { name: 'Voron', games: 25, wins: 13, wr: 0.52 }
    ],
    opponentTop: [
      { name: 'Laston', meetings: 30, wr: 0.47 },
      { name: 'Leres', meetings: 29, wr: 0.45 },
      { name: 'Justy', meetings: 28, wr: 0.49 }
    ],
    winWith: [
      { name: 'Defence stack', record: '21-12' },
      { name: 'Соло спринти', record: '18-10' }
    ],
    loseWith: [{ name: 'Агресивний склад', record: '9-16' }],
    mostLostTo: { name: 'Leres', count: 13 },
    dangerous: { name: 'RuBisCo', meetings: 19, wr: '42%' }
  },
  Kumar: {
    teammateTop: [
      { name: 'Slavon', games: 27, wins: 15, wr: 0.556 },
      { name: 'Оксанка', games: 31, wins: 17, wr: 0.548 },
      { name: 'Zavodchanyn', games: 25, wins: 14, wr: 0.56 }
    ],
    opponentTop: [
      { name: 'Justy', meetings: 29, wr: 0.52 },
      { name: 'Laston', meetings: 28, wr: 0.49 },
      { name: 'Voron', meetings: 23, wr: 0.5 }
    ],
    winWith: [
      { name: 'Блок Slavon/Kumar', record: '15-12' },
      { name: 'Тріо з Оксанкою', record: '17-14' }
    ],
    loseWith: [{ name: 'Експериментальні склади', record: '8-17' }],
    mostLostTo: { name: 'Justy', count: 15 },
    dangerous: { name: 'Laston', meetings: 28, wr: '49%' }
  },
  'Кицюня': {
    teammateTop: [
      { name: 'Justy', games: 22, wins: 15, wr: 0.682 },
      { name: 'Leres', games: 19, wins: 13, wr: 0.684 },
      { name: 'Оксанка', games: 24, wins: 12, wr: 0.5 }
    ],
    opponentTop: [
      { name: 'Laston', meetings: 24, wr: 0.42 },
      { name: 'Slavon', meetings: 26, wr: 0.46 },
      { name: 'RuBisCo', meetings: 17, wr: 0.53 }
    ],
    winWith: [
      { name: 'Дует з Justy', record: '15-7' },
      { name: 'Контроль карти', record: '13-9' }
    ],
    loseWith: [{ name: 'Стійкий захист', record: '7-14' }],
    mostLostTo: { name: 'Laston', count: 14 },
    dangerous: { name: 'RuBisCo', meetings: 17, wr: '53%' }
  },
  RuBisCo: {
    teammateTop: [
      { name: 'Leres', games: 21, wins: 16, wr: 0.762 },
      { name: 'Laston', games: 18, wins: 15, wr: 0.833 },
      { name: 'Voron', games: 14, wins: 10, wr: 0.714 }
    ],
    opponentTop: [
      { name: 'Slavon', meetings: 19, wr: 0.58 },
      { name: 'Кицюня', meetings: 17, wr: 0.47 },
      { name: 'Оксанка', meetings: 20, wr: 0.6 }
    ],
    winWith: [
      { name: 'Аналітичні склади', record: '18-6' },
      { name: 'Турнірні фінали', record: '12-4' }
    ],
    loseWith: [{ name: 'Атака без саппорту', record: '5-9' }],
    mostLostTo: { name: 'Кицюня', count: 8 },
    dangerous: { name: 'Slavon', meetings: 19, wr: '58%' }
  },
  'Оксанка': {
    teammateTop: [
      { name: 'Slavon', games: 34, wins: 19, wr: 0.559 },
      { name: 'Kumar', games: 31, wins: 17, wr: 0.548 },
      { name: 'Кицюня', games: 24, wins: 12, wr: 0.5 }
    ],
    opponentTop: [
      { name: 'Laston', meetings: 22, wr: 0.41 },
      { name: 'Leres', meetings: 21, wr: 0.44 },
      { name: 'RuBisCo', meetings: 20, wr: 0.4 }
    ],
    winWith: [
      { name: 'Збалансований захист', record: '22-18' },
      { name: 'Фінальні сетапи', record: '16-14' }
    ],
    loseWith: [{ name: 'Агресивна трійка', record: '10-22' }],
    mostLostTo: { name: 'Laston', count: 13 },
    dangerous: { name: 'RuBisCo', meetings: 20, wr: '40%' }
  },
  Voron: {
    teammateTop: [
      { name: 'Laston', games: 18, wins: 11, wr: 0.611 },
      { name: 'Justy', games: 20, wins: 13, wr: 0.65 },
      { name: 'Slavon', games: 25, wins: 13, wr: 0.52 }
    ],
    opponentTop: [
      { name: 'Leres', meetings: 26, wr: 0.42 },
      { name: 'Kumar', meetings: 23, wr: 0.48 },
      { name: 'RuBisCo', meetings: 18, wr: 0.47 }
    ],
    winWith: [
      { name: 'Флангові атаки', record: '19-11' },
      { name: 'Збірні тріо', record: '15-9' }
    ],
    loseWith: [{ name: 'Оборонні сетапи', record: '8-15' }],
    mostLostTo: { name: 'Leres', count: 12 },
    dangerous: { name: 'Kumar', meetings: 23, wr: '48%' }
  }
};

function enrichTopPlayers() {
  topPlayers.forEach((player) => {
    const alias = nameAlias(player.nickname);
    const volume = gamesPlayedByPlayer[alias];
    if (volume) {
      Object.assign(player, {
        games: volume.games,
        wins: volume.wins,
        winRate: volume.winRate,
        bestStreak: volume.bestStreak,
        lossStreak: volume.lossStreak,
        MVP: volume.mvp,
        accuracy: volume.accuracy,
        tagsPerGame: volume.tagsPerGame,
        assistsPerGame: volume.assistsPerGame,
        clutchPlays: volume.clutchPlays,
        disarms: volume.disarms,
        highlights: volume.highlights,
        story: volume.story,
        loadout: volume.loadout,
        favoriteArena: volume.favoriteArena,
        averagePoints: Math.round(player.totalPoints / volume.games)
      });
    }

    const timeline = timeSeries[alias];
    if (timeline) {
      player.recentScores = timeline.scores;
      player.recentAccuracy = timeline.accuracy;
    }

    const pairs = pairStats[alias];
    if (pairs) {
      player.teammateTop = pairs.teammateTop;
      player.opponentTop = pairs.opponentTop;
      player.winWith = pairs.winWith;
      player.loseWith = pairs.loseWith;
      player.mostLostTo = pairs.mostLostTo;
      player.dangerous = pairs.dangerous;
    }
  });
}

enrichTopPlayers();

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

function formatPointsWord(value) {
  const rule = pointsPluralRules.select(Number(value));
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
const modal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = modal?.querySelector('[data-close]');

let currentSort = 'rank';
let currentDirection = 'asc';

function formatPercent(value, formatter = percentFormatter0) {
  return formatter.format(value);
}

function getGamesPlayedValue(player) {
  const alias = nameAlias(player.nickname);
  const stats = gamesPlayedByPlayer[alias];
  return stats?.games ?? player.games ?? 0;
}

function getSortValue(player, sortKey) {
  if (sortKey === 'games') {
    return getGamesPlayedValue(player);
  }
  return player[sortKey];
}

const seasonTickerMessages = [
  `Матчів: ${numberFormatter.format(seasonGeneral.totalGamesLogged)} · Раундів: ${numberFormatter.format(seasonGeneral.totalRounds)}`,
  `Очки сезону: ${numberFormatter.format(seasonGeneral.totalPointsScored)} (подіум ${formatPercent(seasonPointsSummary.podiumShare, percentFormatter1)})`,
  `Середні очки топ-10: ${numberFormatter.format(seasonPointsSummary.averageTop10)} ±${decimalFormatter.format(seasonPointsSummary.standardDeviation)}`,
  `Найтісніша гонка: ${seasonPointsSummary.closestRace.players.join(' vs ')} (${seasonPointsSummary.closestRace.diff} ${formatPointsWord(seasonPointsSummary.closestRace.diff)})`
];

function calculateMetrics() {
  return {
    totalGames: seasonGeneral.totalGamesLogged,
    totalRounds: seasonGeneral.totalRounds,
    totalPoints: seasonGeneral.totalPointsScored,
    averageWinRate: seasonGeneral.averageWinRate,
    averageAccuracy: seasonGeneral.averageAccuracy,
    averagePointsPerGame: seasonGeneral.averagePointsPerGame,
    uniquePlayers: seasonGeneral.uniquePlayers,
    newcomers: seasonGeneral.newcomers,
    activeTeams: seasonGeneral.activeTeams,
    tours: seasonGeneral.tours,
    finals: seasonGeneral.finals,
    totalWins: seasonGeneral.totalWins,
    overtimeMatches: seasonGeneral.overtimeMatches,
    podiumNames: seasonGeneral.podium,
    podiumPoints: seasonPointsSummary.podiumPoints,
    podiumShare: seasonPointsSummary.podiumShare,
    averageTop10: seasonPointsSummary.averageTop10,
    medianTop10: seasonPointsSummary.medianTop10,
    standardDeviation: seasonPointsSummary.standardDeviation,
    minPoints: seasonPointsSummary.minPoints,
    maxPoints: seasonPointsSummary.maxPoints,
    pointsByTier: seasonPointsSummary.pointsByTier,
    biggestClimb: seasonPointsSummary.biggestClimb,
    closestRace: seasonPointsSummary.closestRace
  };
}

function renderMetrics() {
  const data = calculateMetrics();
  const roundsLabel = `${numberFormatter.format(data.totalRounds)} раундів`;
  const seasonPhases = `${numberFormatter.format(data.tours)} турів · ${numberFormatter.format(data.finals)} фінали`;
  const overtimeLabel = `${numberFormatter.format(data.overtimeMatches)} овертайми`;
  const teamsLabel = `${numberFormatter.format(data.activeTeams)} команд`;
  const newcomersLabel = `${numberFormatter.format(data.newcomers)} новачків`;
  const podiumNames = Array.isArray(data.podiumNames) ? data.podiumNames.join(' / ') : '';
  const closestRaceLabel = `${data.closestRace.players.join(' vs ')} (+${data.closestRace.diff} ${formatPointsWord(data.closestRace.diff)})`;
  const top10Plus = Math.max(0, data.maxPoints - data.averageTop10);
  const top10Minus = Math.max(0, data.averageTop10 - data.minPoints);
  const top10Spread = `+${numberFormatter.format(top10Plus)} / -${numberFormatter.format(top10Minus)} очок`;

  const cards = [
    {
      label: 'Матчів зіграно',
      value: numberFormatter.format(data.totalGames),
      delta: seasonPhases,
      footnote: `${roundsLabel} · ${overtimeLabel}`,
      key: 'games'
    },
    {
      label: 'Унікальних гравців',
      value: numberFormatter.format(data.uniquePlayers),
      delta: teamsLabel,
      footnote: newcomersLabel,
      key: 'players'
    },
    {
      label: 'Сумарні очки',
      value: numberFormatter.format(data.totalPoints),
      delta: `${formatPercent(data.podiumShare, percentFormatter1)} частка`,
      footnote: `Подіум ${podiumNames}: ${numberFormatter.format(data.podiumPoints)} очок`,
      key: 'points'
    },
    {
      label: 'Середній win rate',
      value: formatPercent(data.averageWinRate, percentFormatter1),
      delta: `${numberFormatter.format(data.totalWins)} перемог`,
      footnote: `Найтісніша гонка: ${closestRaceLabel}`,
      key: 'winrate'
    },
    {
      label: 'Середня точність',
      value: formatPercent(data.averageAccuracy, percentFormatter1),
      delta: `≈${decimalFormatter.format(data.averagePointsPerGame)} очка/матч`,
      footnote: `Діапазон очок топ-10: ${numberFormatter.format(data.minPoints)}–${numberFormatter.format(data.maxPoints)}`,
      key: 'accuracy'
    },
    {
      label: 'Середні очки топ-10',
      value: numberFormatter.format(data.averageTop10),
      delta: top10Spread,
      footnote: `σ = ${decimalFormatter.format(data.standardDeviation)} · Медіана ${numberFormatter.format(data.medianTop10)}`,
      key: 'top10avg'
    }
  ];

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

function renderPodium() {
  podiumGrid.innerHTML = '';
  topPlayers.slice(0, 3).forEach((player, index) => {
    const card = document.createElement('article');
    card.className = 'podium-card';
    card.dataset.rank = `#${index + 1}`;
    card.innerHTML = `
      <h3>${player.nickname}</h3>
      <ul>
        <li>${player.team}</li>
        <li>${numberFormatter.format(player.totalPoints)} очок</li>
        <li>Win rate ${formatPercent(player.winRate)}</li>
        <li>Стрік ${player.bestStreak}</li>
      </ul>
    `;
    podiumGrid.append(card);
  });
}

function renderSparkline(values, label) {
  const width = 320;
  const height = 120;
  const paddingX = 14;
  const paddingY = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x =
        paddingX + (index / Math.max(values.length - 1, 1)) * (width - paddingX * 2);
      const normalized = (value - min) / range;
      const y = height - paddingY - normalized * (height - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${
    width - paddingX
  },${height - paddingY}`;

  const description = values
    .map((value, index) => `Раунд ${index + 1}: ${value}`)
    .join(', ');

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Динаміка очок ${label}">
      <title>Очки ${label}</title>
      <desc>${description}</desc>
      <polyline points="${fillPoints}" fill="rgba(255, 102, 196, 0.15)" stroke="none"></polyline>
      <polyline points="${points}" fill="none" stroke="#ff66c4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="rgba(255, 255, 255, 0.2)" stroke-dasharray="6 6"></line>
      <circle cx="${points.split(' ').slice(-1)[0].split(',')[0]}" cy="${
    points.split(' ').slice(-1)[0].split(',')[1]
  }" r="5" fill="#ffd700" stroke="#05070e" stroke-width="2"></circle>
    </svg>
  `;
}

function renderModal(player) {
  if (!modal) {
    return;
  }

  modalTitle.textContent = `${player.nickname} · ${player.team}`;
  const alias = nameAlias(player.nickname);
  const rawBattles = gamesPlayedByPlayer[alias] ?? player.games;
  const battles =
    (typeof rawBattles === 'number' ? rawBattles : rawBattles?.games) ??
    player.games ??
    0;
  const rankTier = player.rankTier || getRankTierByPlace(player.rank);
  const recentScores = Array.isArray(player.recentScores) ? player.recentScores : [];
  const hasRecentScores = recentScores.length > 0;
  const averageRecent = hasRecentScores
    ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    : 0;
  const sparklineMarkup = hasRecentScores
    ? renderSparkline(recentScores, player.nickname)
    : '<p>Немає даних для графіка.</p>';
  const tempoSummary = hasRecentScores
    ? `Середній темп — ${decimalFormatter.format(averageRecent)} очок за ${recentScores.length} останні бої.`
    : 'Немає даних про останні бої.';
  const recentResultsParagraph = hasRecentScores
    ? `<p>Останні результати: ${recentScores
        .map((value) => `${numberFormatter.format(value)} очок`)
        .join(' · ')}.</p>`
    : '';

  modalBody.innerHTML = `
    <section>
      <h3>Основні показники</h3>
      <div class="detail-grid">
        <div>
          <strong>Бої (зіграні)</strong>
          ${numberFormatter.format(battles)}
        </div>
        <div>
          <strong>Перемог</strong>
          ${numberFormatter.format(player.wins)} (${formatPercent(player.winRate, percentFormatter1)})
        </div>
        <div>
          <strong>Очок за сезон</strong>
          ${numberFormatter.format(player.totalPoints)}
        </div>
        <div>
          <strong>Сер. очки</strong>
          ${numberFormatter.format(player.averagePoints)}
        </div>
        <div>
          <strong>Ранг</strong>
          ${rankTier}
        </div>
        <div>
          <strong>Стрік</strong>
          ${player.bestStreak} поспіль
        </div>
        <div>
          <strong>Tags/гра</strong>
          ${decimalFormatter.format(player.tagsPerGame)}
        </div>
        <div>
          <strong>Асисти/гра</strong>
          ${decimalFormatter.format(player.assistsPerGame)}
        </div>
        <div>
          <strong>Clutch</strong>
          ${numberFormatter.format(player.clutchPlays)} сейви
        </div>
        <div>
          <strong>Обеззброєнь</strong>
          ${numberFormatter.format(player.disarms)}
        </div>
        <div>
          <strong>Роль</strong>
          ${player.role}
        </div>
        <div>
          <strong>Улюблена арена</strong>
          ${player.favoriteArena}
        </div>
      </div>
    </section>
    <section>
      <h3>Останні матчі</h3>
      ${sparklineMarkup}
      <p>${tempoSummary}</p>
      ${recentResultsParagraph}
    </section>
    <section>
      <h3>Фішки гравця</h3>
      <ul class="detail-list">
        ${player.highlights.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <p>${player.story}</p>
      <p>Набір: ${player.loadout}</p>
    </section>
  `;

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
  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function renderLeaderboard() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const sorted = [...topPlayers].sort((a, b) => {
    const direction = currentDirection === 'asc' ? 1 : -1;
    if (currentSort === 'rank') {
      return direction * (a.rank - b.rank);
    }
    const valueA = getSortValue(a, currentSort);
    const valueB = getSortValue(b, currentSort);
    if (valueA === valueB) {
      return a.rank - b.rank;
    }
    return direction * (valueA > valueB ? 1 : -1);
  });

  const filtered = sorted.filter((player) => {
    if (!searchTerm) {
      return true;
    }
    const haystack = [
      player.nickname,
      player.realName,
      player.team,
      player.role,
      player.favoriteArena
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm);
  });

  leaderboardBody.innerHTML = '';

  if (filtered.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="9">Немає гравців за цим запитом</td>`;
    leaderboardBody.append(emptyRow);
    return;
  }

  filtered.forEach((player) => {
    const row = document.createElement('tr');
    row.classList.add(`tier-${player.rankTier}`);
    const gamesPlayed = getGamesPlayedValue(player);
    const rankBadge = `<span class="role-badge tier-${player.rankTier}" aria-label="Ранг ${player.rankTier}">${player.rankTier}</span>`;
    row.innerHTML = `
      <td><span class="rank-chip">${player.rank}</span></td>
      <td>
        <div>${player.nickname}</div>
        <small>${player.realName}</small>
      </td>
      <td>${numberFormatter.format(player.totalPoints)}</td>
      <td>${numberFormatter.format(player.averagePoints)}</td>
      <td>${numberFormatter.format(player.games)}</td>
      <td>${formatPercent(player.winRate)}</td>
      <td>${numberFormatter.format(gamesPlayed)}</td>
      <td>
        <span class="role-cell">
          <span>${player.role}</span>
          ${rankBadge}
        </span>
      </td>
      <td><button type="button" class="pixel-button" data-player="${player.nickname}">Профіль</button></td>
    `;

    const button = row.querySelector('button');
    button?.addEventListener('click', () => renderModal(player));
    leaderboardBody.append(row);
  });
}

function startTicker() {
  if (!tickerEl) {
    return;
  }
  const messages = seasonTickerMessages;

  let index = 0;
  const update = () => {
    tickerEl.textContent = messages[index];
    index = (index + 1) % messages.length;
  };
  update();
  if (messages.length > 1) {
    setInterval(update, 4600);
  }
}

function updateTabs(targetButton) {
  tabButtons.forEach((button) => {
    const isActive = button === targetButton;
    button.setAttribute('aria-selected', String(isActive));
  });
}

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
    renderLeaderboard();
  });
});

searchInput?.addEventListener('input', () => {
  renderLeaderboard();
});

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

updateTabs(tabButtons[0] ?? null);
renderMetrics();
renderPodium();
renderLeaderboard();
startTicker();
