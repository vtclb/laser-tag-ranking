'use strict';

/**
 * Sunday League · Season 1 · Summer 2025
 * Реальні дані для старшої ліги (Sunday League).
 * Bogd виключений із ТОП-10, але врахований у загальній статистиці (у вихідних таблицях).
 *
 * Цей скрипт:
 *  - малює метрики сезону, подіум, таблицю ТОП-10;
 *  - дає пошук, сортування, модалку профілю гравця;
 *  - показує нагороди (вбудовані в метрики/подіум/модалку);
 *  - без зовнішніх залежностей.
 *
 * Якщо деякі поля seasonGeneral не задані — показує '—'
 * (все інше працює на основі масиву topPlayers).
 */

// ====== 1) Дані сезону (загальні) ======
const seasonGeneral = {
  // ці поля відображаються у картках метрик; якщо якесь невідоме — лишай null
  season: 'Season 1 · Summer 2025',
  league: 'Sunday League',
  games: null,        // загальна кількість матчів сезону
  rounds: null,       // сума раундів (усіх матчів)
  avgRounds: null,    // середня кількість раундів на гру
  avgPlayers: null,   // середня кількість гравців у матчі
  uniquePlayers: null,// кількість унікальних гравців
  commonScore: null,  // найчастіший рахунок (наприклад "7-5")
  longestGame: null   // макс. кількість раундів у грі
};

// ====== 2) ТОП-10 за поінтами (реальні цифри; Bogd виключений) ======
const topPlayers = [
  // rank заповнимо динамічно, але лишаю тут порядок 1..10 для ясності
  { nickname:'Laston',      realName:'Laston',      team:'Sunday League', totalPoints:1180, games:136, wins:81,  winRate:0.5956, bestStreak:7, lossStreak:5, MVP:45, rankTier:'S' },
  { nickname:'Leres',       realName:'Leres',       team:'Sunday League', totalPoints:1099, games:136, wins:85,  winRate:0.6250, bestStreak:7, lossStreak:4, MVP:17, rankTier:'S' },
  { nickname:'Zavodchanyn', realName:'Zavodchanyn', team:'Sunday League', totalPoints:995,  games:137, wins:73,  winRate:0.5328, bestStreak:7, lossStreak:6, MVP:31, rankTier:'S' },
  { nickname:'Justy',       realName:'Justy',       team:'Sunday League', totalPoints:965,  games:151, wins:78,  winRate:0.5166, bestStreak:6, lossStreak:6, MVP:27, rankTier:'A' },
  { nickname:'Slavon',      realName:'Slavon',      team:'Sunday League', totalPoints:955,  games:167, wins:85,  winRate:0.5090, bestStreak:5, lossStreak:4, MVP:17, rankTier:'A' },
  { nickname:'Kumar',       realName:'Kumar',       team:'Sunday League', totalPoints:920,  games:185, wins:91,  winRate:0.4919, bestStreak:5, lossStreak:7, MVP:12, rankTier:'A' },
  { nickname:'Кицюня',      realName:'Кицюня',      team:'Sunday League', totalPoints:895,  games:124, wins:59,  winRate:0.4758, bestStreak:7, lossStreak:7, MVP:8,  rankTier:'A' },
  { nickname:'RuBisCo',     realName:'RuBisCo',     team:'Sunday League', totalPoints:851,  games:71,  wins:40,  winRate:0.5634, bestStreak:8, lossStreak:6, MVP:18, rankTier:'B' },
  { nickname:'Оксанка',     realName:'Оксанка',     team:'Sunday League', totalPoints:850,  games:197, wins:74,  winRate:0.3756, bestStreak:5, lossStreak:9, MVP:7,  rankTier:'B' },
  { nickname:'Voron',       realName:'Voron',       team:'Sunday League', totalPoints:830,  games:118, wins:63,  winRate:0.5339, bestStreak:7, lossStreak:4, MVP:16, rankTier:'B' }
].map((p, i) => ({
  rank: i + 1,
  averagePoints: p.games ? Math.round(p.totalPoints / p.games) : 0,
  role: 'Гравець',
  highlights: [],
  story: '',
  recentScores: [],
  recentAccuracy: [],
  // блочок для парної статистики — заповню, як тільки підвезеш з таблиці (або вшити мої JSON)
  teammateTop: [],
  opponentTop: [],
  winWith: [],
  loseWith: [],
  mostLostTo: { name: '—', count: 0 },
  dangerous:  { name: '—', meetings: 0, wr: '—' },
  ...p
}));

// ====== 3) Нагороди сезону (розраховано по ТОП-10; глобальні нагороди теж можна підставити) ======
const awards = (() => {
  const byMVP   = topPlayers.slice().sort((a,b) => b.MVP - a.MVP)[0];
  const wr80    = topPlayers.filter(p => p.games >= 80).slice().sort((a,b) => b.winRate - a.winRate)[0] || topPlayers[0];
  const iron    = topPlayers.slice().sort((a,b) => b.games - a.games)[0];
  const streak  = topPlayers.slice().sort((a,b) => b.bestStreak - a.bestStreak)[0];
  return {
    champion:         { player: topPlayers[0].nickname, points: topPlayers[0].totalPoints },
    mvpKing:          { player: byMVP.nickname, MVP: byMVP.MVP },
    winrateBeast:     { player: wr80.nickname, WR: +(wr80.winRate*100).toFixed(2), games: wr80.games },
    ironman:          { player: iron.nickname, games: iron.games },
    longestWinStreak: { player: streak.nickname, streak: streak.bestStreak }
  };
})();

// ====== 4) Утиліти форматування ======
const nf = new Intl.NumberFormat('uk-UA');
const pf0 = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 0 });
const pf1 = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 1 });
const fmt = {
  num: (v) => (v == null ? '—' : nf.format(v)),
  pct0: (v) => (v == null ? '—' : pf0.format(v)),
  pct1: (v) => (v == null ? '—' : pf1.format(v))
};

// ====== 5) Захоплення DOM ======
const metricsGrid   = document.getElementById('metrics-grid');
const podiumGrid    = document.getElementById('podium-grid');
const leaderboardBody = document.getElementById('leaderboard-body');
const tickerEl      = document.getElementById('season-ticker');
const searchInput   = document.getElementById('player-search');
const tabButtons    = Array.from(document.querySelectorAll('.tab-button'));
const modal         = document.getElementById('player-modal');
const modalTitle    = document.getElementById('modal-title');
const modalBody     = document.getElementById('modal-body');
const closeButton   = modal?.querySelector('[data-close]');

// ====== 6) Стан сортування ======
let currentSort = 'rank';
let currentDirection = 'asc';

// ====== 7) Обчислення метрик для карток ======
function calcMetrics() {
  const totalGames = seasonGeneral.games ?? '—';
  const uniquePlayers = seasonGeneral.uniquePlayers ?? '—';
  const totalPoints = topPlayers.reduce((s,p)=> s + p.totalPoints, 0);
  const avgWR = topPlayers.reduce((s,p)=> s + p.winRate, 0) / topPlayers.length;
  const longestStreakPlayer = topPlayers.slice().sort((a,b)=> b.bestStreak - a.bestStreak)[0];
  const strongestWR = topPlayers.slice().sort((a,b)=> b.winRate - a.winRate)[0];
  const podiumPoints = topPlayers.slice(0,3).reduce((s,p)=> s + p.totalPoints, 0);
  return { totalGames, uniquePlayers, totalPoints, avgWR, longestStreakPlayer, strongestWR, podiumPoints };
}

function renderMetrics() {
  const m = calcMetrics();
  const cards = [
    {
      label: 'Матчів сезону',
      value: m.totalGames === '—' ? '—' : fmt.num(m.totalGames),
      footnote: `Раундів: ${seasonGeneral.rounds == null ? '—' : fmt.num(seasonGeneral.rounds)}`,
      key: 'games'
    },
    {
      label: 'Унікальних гравців',
      value: m.uniquePlayers === '—' ? '—' : fmt.num(m.uniquePlayers),
      footnote: `Середньо гравців/матч: ${seasonGeneral.avgPlayers == null ? '—' : seasonGeneral.avgPlayers}`,
      key: 'players'
    },
    {
      label: 'Сумарні очки ТОП-10',
      value: fmt.num(m.totalPoints),
      footnote: `Очки подіуму: ${fmt.num(podiumPoints(topPlayers))}`,
      key: 'points'
    },
    {
      label: 'Середній WR у ТОП-10',
      value: fmt.pct1 ? fmt.pct1(m.avgWR) : pf1.format(m.avgWR),
      footnote: `Найвищий WR: ${pf1.format(m.strongestWR.winRate)} (${m.strongestWR.nickname})`,
      key: 'wr'
    },
    {
      label: 'Найдовша серія',
      value: `${m.longestStreakPlayer.bestStreak} перемог`,
      footnote: `${m.longestStreakPlayer.nickname}`,
      key: 'streak'
    },
    {
      label: 'Найчастіший рахунок',
      value: seasonGeneral.commonScore ?? '—',
      footnote: `Найдовша гра: ${seasonGeneral.longestGame ?? '—'} раундів`,
      key: 'score'
    }
  ];

  metricsGrid.innerHTML = '';
  for (const c of cards) {
    const el = document.createElement('article');
    el.className = 'card metric-card';
    el.dataset.metric = c.key;
    el.innerHTML = `
      <span class="metric-label">${c.label}</span>
      <span class="metric-value">${c.value}</span>
      <span class="metric-footnote">${c.footnote}</span>
    `;
    metricsGrid.append(el);
  }
}

function podiumPoints(arr) {
  return arr.slice(0,3).reduce((s,p)=> s + p.totalPoints, 0);
}

// ====== 8) Подіум ======
function renderPodium() {
  podiumGrid.innerHTML = '';
  topPlayers.slice(0,3).forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card podium-card';
    card.dataset.rank = `#${i+1}`;
    card.innerHTML = `
      <h3>${p.nickname}</h3>
      <ul>
        <li>Очки: ${fmt.num(p.totalPoints)}</li>
        <li>WR ${pf1.format(p.winRate)}</li>
        <li>Стрік ${p.bestStreak}</li>
        <li>Ігор ${fmt.num(p.games)}</li>
      </ul>
    `;
    podiumGrid.append(card);
  });
}

// ====== 9) Таблиця ======
function renderLeaderboard() {
  const direction = (currentDirection === 'asc') ? 1 : -1;
  const query = (searchInput?.value || '').trim().toLowerCase();

  const sorted = topPlayers.slice().sort((a, b) => {
    const key = currentSort;
    if (key === 'rank') return direction * (a.rank - b.rank);
    const va = a[key], vb = b[key];
    if (va === vb) return a.rank - b.rank;
    return direction * ((va > vb) ? 1 : -1);
  });

  const filtered = sorted.filter(p =>
    !query || [p.nickname, p.realName].join(' ').toLowerCase().includes(query)
  );

  leaderboardBody.innerHTML = '';
  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9">Немає гравців за цим запитом</td>`;
    leaderboardBody.append(tr);
    return;
  }

  for (const p of filtered) {
    const tr = document.createElement('tr');
    tr.classList.add(`tier-${p.rankTier}`);
    tr.innerHTML = `
      <td><span class="rank-chip">${p.rank}</span></td>
      <td><div>${p.nickname}</div><small>${p.realName}</small></td>
      <td>${fmt.num(p.totalPoints)}</td>
      <td>${fmt.num(p.averagePoints)}</td>
      <td>${fmt.num(p.games)}</td>
      <td>${pf1.format(p.winRate)}</td>
      <td>${p.MVP} MVP</td>
      <td>${p.role}</td>
      <td><button type="button" class="pixel-button" data-player="${p.nickname}">Профіль</button></td>
    `;
    const btn = tr.querySelector('button');
    btn?.addEventListener('click', () => openModal(p));
    leaderboardBody.append(tr);
  }
}

// ====== 10) Модалка профілю ======
function openModal(p) {
  modalTitle.textContent = `${p.nickname} · профіль`;

  const list = (title, arr) => `
    <section>
      <h3 style="margin:0 0 6px 0;font-family:'Press Start 2P',monospace;font-size:12px;">${title}</h3>
      <ul class="detail-list">
        ${arr && arr.length ? arr.map(i => `<li>${i.name} — ${i.count}</li>`).join('') : '<li>—</li>'}
      </ul>
    </section>
  `;

  modalBody.innerHTML = `
    <section>
      <h3 style="margin:0 0 6px 0;font-family:'Press Start 2P',monospace;font-size:12px;">Основні показники</h3>
      <div class="detail-grid">
        <div><strong>Ігор</strong><br/>${fmt.num(p.games)}</div>
        <div><strong>Перемог</strong><br/>${fmt.num(p.wins)} (${pf1.format(p.winRate)})</div>
        <div><strong>Очки сезону</strong><br/>${fmt.num(p.totalPoints)}</div>
        <div><strong>Сер. очки</strong><br/>${fmt.num(p.averagePoints)}</div>
        <div><strong>Win-streak</strong><br/>${fmt.num(p.bestStreak)}</div>
        <div><strong>Lose-streak</strong><br/>${fmt.num(p.lossStreak)}</div>
        <div><strong>MVP</strong><br/>${fmt.num(p.MVP)}</div>
        <div><strong>Найчастіше програвав</strong><br/>${p.mostLostTo?.name ?? '—'} (${p.mostLostTo?.count ?? 0})</div>
        <div><strong>Грізний суперник</strong><br/>${p.dangerous?.name ?? '—'} (${p.dangerous?.meetings ?? 0}), WR ${p.dangerous?.wr ?? '—'}%</div>
      </div>
    </section>
    ${list('Топ напарників', p.teammateTop)}
    ${list('Топ суперників', p.opponentTop)}
    ${list('Перемог разом', p.winWith)}
    ${list('Поразок разом', p.loseWith)}
  `;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
}

function closeModal() {
  if (typeof modal.close === 'function') modal.close();
  else modal.removeAttribute('open');
}

// ====== 11) Тікер ======
function startTicker() {
  const names = topPlayers.slice(0,3).map(p => p.nickname).join(' / ');
  const msgs = [
    `Подіум сезону: ${names}`,
    `Чемпіон: ${topPlayers[0].nickname} (${nf.format(topPlayers[0].totalPoints)} очок)`,
    `Найдовша серія: ${topPlayers.slice().sort((a,b)=>b.bestStreak-a.bestStreak)[0].bestStreak}`,
    `Матчів у сезоні: ${seasonGeneral.games == null ? '—' : nf.format(seasonGeneral.games)}`
  ];
  let i = 0;
  const update = () => { tickerEl.textContent = msgs[i]; i = (i + 1) % msgs.length; };
  update();
  if (msgs.length > 1) setInterval(update, 4600);
}

// ====== 12) Взаємодія: вкладки сортування та пошук ======
function selectTab(btn) { tabButtons.forEach(b => b.setAttribute('aria-selected', String(b === btn))); }

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (!key) return;
    if (currentSort === key) {
      currentDirection = (currentDirection === 'asc') ? 'desc' : 'asc';
    } else {
      currentSort = key;
      currentDirection = key === 'rank' ? 'asc' : 'desc';
    }
    selectTab(button);
    renderLeaderboard();
  });
});

searchInput?.addEventListener('input', renderLeaderboard);

closeButton?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
modal?.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });

// ====== 13) Старт рендера ======
selectTab(tabButtons[0] ?? null);
renderMetrics();
renderPodium();
renderLeaderboard();
startTicker();
