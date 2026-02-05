'use strict';

const FALLBACK = '—';
const MIN_MATCHES_FOR_WINRATE = 3;

const numberFormatter = new Intl.NumberFormat('uk-UA');
const percentFormatter1 = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 1
});
const decimalFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatNumberValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : numberFormatter.format(numeric);
}

function formatPercentValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : percentFormatter1.format(numeric);
}

function formatDecimalValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : decimalFormatter.format(numeric);
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

function normalizeNick(nick) {
  return typeof nick === 'string' ? nick.trim() : '';
}

function normalizeNickKey(nick) {
  return normalizeNick(nick).toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

const KIDS_LEAGUE_ALIASES = ['kids', 'kid', 'children', 'junior', 'youth', 'young', 'дит', 'діт'];
const ADULT_LEAGUE_ALIASES = ['sundaygames', 'sunday', 'adult', 'olds', 'old', 'дорос', 'старш'];

function normalizeLeagueName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const compact = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  if (KIDS_LEAGUE_ALIASES.some((token) => compact.includes(token))) {
    return 'kids';
  }
  if (ADULT_LEAGUE_ALIASES.some((token) => compact.includes(token))) {
    return 'sundaygames';
  }
  return trimmed;
}

function normalizePackPlayersForLeague(players = [], leagueKey = '', aliasMap = {}) {
  const normalizedLeague = normalizeLeagueName(leagueKey || 'kids');

  // намагаємось зрозуміти, чи в pack-рядках взагалі є маркер ліги
  const hasLeagueMarkers = (players || []).some((p) =>
    p && (p.league != null || p.leagueKey != null || p.sheet != null || p.tab != null || p.scope != null || p.mode != null)
  );

  const pickLeague = (p) => {
    const raw = (p && (p.league ?? p.leagueKey ?? p.sheet ?? p.tab ?? p.scope ?? p.mode)) ?? '';
    return normalizeLeagueName(String(raw));
  };

  // якщо маркери ліги є — фільтруємо строго
  // якщо маркерів нема — НЕ ріжемо (щоб нічого випадково не зникло)
  const filtered = hasLeagueMarkers
    ? (players || []).filter((p) => pickLeague(p) === normalizedLeague)
    : (players || []);

  const normalized = normalizeTopPlayers(
    filtered,
    { ...(PACK?.meta ?? {}), league: normalizedLeague },
    aliasMap
  );

  // підписуємо правильну лігу (тільки для цієї сторінки/виводу)
  return normalized.map((player) => ({
    ...player,
    leagueKey: normalizedLeague,
    league: normalizedLeague,
    team: getLeagueLabel(normalizedLeague || FALLBACK)
  }));
}

function parseWinner(rawWinner) {
  if (typeof rawWinner === 'number') {
    if (rawWinner === 1) {
      return 'team1';
    }
    if (rawWinner === 2) {
      return 'team2';
    }
  }
  if (typeof rawWinner !== 'string') {
    return '';
  }
  const normalized = rawWinner.trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  if (['team1', 'team 1', '1'].includes(normalized)) {
    return 'team1';
  }
  if (['team2', 'team 2', '2'].includes(normalized)) {
    return 'team2';
  }
  if (['tie', 'draw', 'нічия', 'drawn'].includes(normalized)) {
    return 'tie';
  }
  return normalized;
}

function coerceArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function collectStatValue(statMap, nick) {
  if (!statMap || typeof statMap !== 'object') {
    return null;
  }
  const direct = statMap[nick];
  const numeric = toFiniteNumber(direct);
  if (numeric !== null) {
    return numeric;
  }
  const fallbackKey = Object.keys(statMap).find((key) => normalizeNickKey(key) === normalizeNickKey(nick));
  return fallbackKey ? toFiniteNumber(statMap[fallbackKey]) : null;
}

function normalizeEvent(event, leagueOverride = '') {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const leagueRaw =
    event?.meta?.league || event?.league || event?.meta?.division || event?.division || leagueOverride;
  const league = normalizeLeagueName(leagueRaw);
  const ts = typeof event?.ts === 'string' ? event.ts : typeof event?.date === 'string' ? event.date : '';
  const matchId =
    (typeof event?.matchId === 'string' && event.matchId.trim()) ||
    (typeof event?.id === 'string' && event.id.trim()) ||
    '';
  const teams = event?.teams ?? {};
  const team1 = coerceArray(teams?.team1 ?? event?.team1).map(normalizeNick).filter(Boolean);
  const team2 = coerceArray(teams?.team2 ?? event?.team2).map(normalizeNick).filter(Boolean);
  const playersRaw = coerceArray(event?.players).map(normalizeNick).filter(Boolean);
  const stats = event?.stats ?? {};

  const statsPlayers = new Set([
    ...Object.keys(stats?.kills ?? {}),
    ...Object.keys(stats?.deaths ?? {}),
    ...Object.keys(stats?.shots ?? {}),
    ...Object.keys(stats?.hits ?? {})
  ]);
  const players = Array.from(new Set([...playersRaw, ...team1, ...team2, ...statsPlayers]));

  const mvps = [event?.mvp, event?.mvp2, event?.mvp3]
    .flatMap((value) => {
      if (typeof value === 'string') {
        return value
          .split(/[;,]/)
          .map((item) => normalizeNick(item))
          .filter(Boolean);
      }
      if (Array.isArray(value)) {
        return value.map(normalizeNick).filter(Boolean);
      }
      return [];
    })
    .filter(Boolean);

  return {
    ts,
    matchId,
    league,
    winner: parseWinner(event?.winner ?? event?.winnerTeam),
    team1,
    team2,
    players,
    mvps,
    stats
  };
}

function buildReport(events, leagueKey) {
  const statsMap = new Map();
  const matches = [];
  const totals = {
    wins: 0,
    losses: 0,
    ties: 0,
    rounds: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0
  };

  const leagueEvents = events
    .filter((event) => event && event.league === leagueKey)
    .sort((a, b) => (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0));

  leagueEvents.forEach((event, index) => {
    const eventPlayers = event.players.length > 0 ? event.players : [...event.team1, ...event.team2];
    const winner = event.winner;
    const roundsValue = toFiniteNumber(event.stats?.rounds);
    if (roundsValue !== null) {
      totals.rounds += roundsValue;
    }

    const normalizePlayerRecord = (playerNick) => {
      const key = normalizeNickKey(playerNick);
      if (!key) {
        return null;
      }
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          nickname: normalizeNick(playerNick),
          key,
          matches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          rounds: 0,
          kills: 0,
          deaths: 0,
          shots: 0,
          hits: 0,
          mvpScore: 0,
          mvpCount: 0,
          lastSeen: null
        });
      }
      return statsMap.get(key);
    };

    eventPlayers.forEach((player) => {
      const record = normalizePlayerRecord(player);
      if (!record) {
        return;
      }

      record.matches += 1;
      record.rounds += roundsValue ?? 0;
      record.lastSeen = event.ts || record.lastSeen;

      const inTeam1 = event.team1.some((member) => normalizeNickKey(member) === record.key);
      const inTeam2 = event.team2.some((member) => normalizeNickKey(member) === record.key);

      if (winner === 'tie' || !winner) {
        record.ties += 1;
        totals.ties += 1;
      } else if (winner === 'team1' && inTeam1) {
        record.wins += 1;
        totals.wins += 1;
      } else if (winner === 'team2' && inTeam2) {
        record.wins += 1;
        totals.wins += 1;
      } else if ((winner === 'team1' && inTeam2) || (winner === 'team2' && inTeam1)) {
        record.losses += 1;
        totals.losses += 1;
      } else if (!inTeam1 && !inTeam2) {
        record.ties += 1;
        totals.ties += 1;
      }

      const kills = collectStatValue(event.stats?.kills, player);
      const deaths = collectStatValue(event.stats?.deaths, player);
      const shots = collectStatValue(event.stats?.shots, player);
      const hits = collectStatValue(event.stats?.hits, player);

      if (kills !== null) {
        record.kills += kills;
        totals.kills += kills;
      }
      if (deaths !== null) {
        record.deaths += deaths;
        totals.deaths += deaths;
      }
      if (shots !== null) {
        record.shots += shots;
        totals.shots += shots;
      }
      if (hits !== null) {
        record.hits += hits;
        totals.hits += hits;
      }
    });

    const weights = [3, 2, 1];
    event.mvps.forEach((mvp, idx) => {
      const record = normalizePlayerRecord(mvp);
      if (!record) {
        return;
      }
      const weight = weights[idx] ?? 1;
      record.mvpScore += weight;
      record.mvpCount += 1;
    });

    const playersCount = eventPlayers.length;
    matches.push({
      ts: event.ts,
      matchId: event.matchId || `match-${index + 1}`,
      winner,
      mvps: event.mvps,
      playersCount,
      teams: { team1: event.team1, team2: event.team2 }
    });
  });

  const players = Array.from(statsMap.values()).map((player) => {
    const winRate = player.matches > 0 ? player.wins / player.matches : null;
    const kd = player.deaths > 0 ? player.kills / player.deaths : player.kills > 0 ? player.kills : null;
    const accuracy = player.shots > 0 ? player.hits / player.shots : null;
    const score = player.wins * 3 + player.ties;

    return {
      ...player,
      winRate,
      kd,
      accuracy,
      score
    };
  });

  const summary = {
    matchesTotal: leagueEvents.length,
    uniquePlayers: players.length,
    roundsTotal: totals.rounds || null,
    winRate:
      totals.wins + totals.losses + totals.ties > 0
        ? totals.wins / (totals.wins + totals.losses + totals.ties)
        : null,
    kd: totals.deaths > 0 ? totals.kills / totals.deaths : totals.kills > 0 ? totals.kills : null,
    accuracy: totals.shots > 0 ? totals.hits / totals.shots : null
  };

  return {
    league: leagueKey,
    players,
    matches,
    summary,
    totals
  };
}

function mergeReports(kidsReport, sundayReport) {
  const combined = new Map();
  const totals = {
    wins: 0,
    losses: 0,
    ties: 0,
    rounds: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0
  };
  const mergePlayer = (player) => {
    const key = player.key;
    if (!combined.has(key)) {
      combined.set(key, { ...player });
      return;
    }
    const record = combined.get(key);
    record.matches += player.matches;
    record.wins += player.wins;
    record.losses += player.losses;
    record.ties += player.ties;
    record.rounds += player.rounds;
    record.kills += player.kills;
    record.deaths += player.deaths;
    record.shots += player.shots;
    record.hits += player.hits;
    record.mvpScore += player.mvpScore;
    record.mvpCount += player.mvpCount;
  };

  kidsReport.players.forEach(mergePlayer);
  sundayReport.players.forEach(mergePlayer);
  const accumulateTotals = (report) => {
    totals.wins += report.totals?.wins ?? 0;
    totals.losses += report.totals?.losses ?? 0;
    totals.ties += report.totals?.ties ?? 0;
    totals.rounds += report.totals?.rounds ?? 0;
    totals.kills += report.totals?.kills ?? 0;
    totals.deaths += report.totals?.deaths ?? 0;
    totals.shots += report.totals?.shots ?? 0;
    totals.hits += report.totals?.hits ?? 0;
  };
  accumulateTotals(kidsReport);
  accumulateTotals(sundayReport);

  const mergedPlayers = Array.from(combined.values()).map((player) => {
    const winRate = player.matches > 0 ? player.wins / player.matches : null;
    const kd = player.deaths > 0 ? player.kills / player.deaths : player.kills > 0 ? player.kills : null;
    const accuracy = player.shots > 0 ? player.hits / player.shots : null;
    const score = player.wins * 3 + player.ties;
    return { ...player, winRate, kd, accuracy, score };
  });

  const summary = {
    matchesTotal: kidsReport.summary.matchesTotal + sundayReport.summary.matchesTotal,
    uniquePlayers: mergedPlayers.length,
    roundsTotal: (kidsReport.summary.roundsTotal ?? 0) + (sundayReport.summary.roundsTotal ?? 0) || null,
    winRate:
      totals.wins + totals.losses + totals.ties > 0
        ? totals.wins / (totals.wins + totals.losses + totals.ties)
        : null,
    kd: totals.deaths > 0 ? totals.kills / totals.deaths : totals.kills > 0 ? totals.kills : null,
    accuracy: totals.shots > 0 ? totals.hits / totals.shots : null
  };

  return {
    league: 'all',
    players: mergedPlayers,
    matches: [...kidsReport.matches, ...sundayReport.matches],
    summary,
    totals
  };
}

function buildTopLists(players) {
  const byMvp = [...players]
    .filter((player) => player.mvpScore > 0)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount || b.matches - a.matches);
  const byWinrate = [...players]
    .filter((player) => player.matches >= MIN_MATCHES_FOR_WINRATE && player.winRate !== null)
    .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches);
  const byMatches = [...players].sort((a, b) => b.matches - a.matches || b.wins - a.wins);
  const byKd = [...players]
    .filter((player) => player.kd !== null)
    .sort((a, b) => b.kd - a.kd || b.kills - a.kills);
  const byAccuracy = [...players]
    .filter((player) => player.accuracy !== null)
    .sort((a, b) => b.accuracy - a.accuracy || b.shots - a.shots);

  return {
    mvp: byMvp,
    winrate: byWinrate,
    matches: byMatches,
    kd: byKd,
    accuracy: byAccuracy
  };
}

const metricsGrid = document.getElementById('metrics-grid');
const podiumGrid = document.getElementById('podium-grid');
const leaderboardBody = document.getElementById('leaderboard-body');
const matchlogBody = document.getElementById('matchlog-body');
const tickerEl = document.getElementById('season-ticker');
const searchInput = document.getElementById('player-search');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const leagueButtons = Array.from(document.querySelectorAll('[data-league-target]'));
const downloadButton = document.getElementById('download-report');
const seasonSubtitle = document.getElementById('season-subtitle');
const modal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = modal?.querySelector('[data-close]');

let PACK = null;
let activeLeague = 'sundaygames';
let AUTUMN_REPORT = null;
let currentSort = 'rank';
let currentDirection = 'desc';

function getLeagueLabel(league) {
  if (league === 'kids') {
    return 'Дитяча ліга';
  }
  if (league === 'sundaygames') {
    return 'Доросла ліга';
  }
  return league || FALLBACK;
}

function renderMetrics(summary) {
  if (!metricsGrid) {
    return;
  }
  const cards = [
    { label: 'Матчів', value: formatNumberValue(summary.matchesTotal) },
    { label: 'Гравців', value: formatNumberValue(summary.uniquePlayers) },
    { label: 'Раундів', value: formatNumberValue(summary.roundsTotal) },
    { label: 'Win rate', value: formatPercentValue(summary.winRate) },
    { label: 'K/D', value: formatDecimalValue(summary.kd) },
    { label: 'Accuracy', value: formatPercentValue(summary.accuracy) }
  ];

  metricsGrid.innerHTML = '';
  cards.forEach((card) => {
    const article = document.createElement('article');
    article.className = 'metric-card';
    article.innerHTML = `
      <span class="metric-label">${card.label}</span>
      <span class="metric-value">${card.value}</span>
      <span class="metric-footnote">Сезонна статистика</span>
    `;
    metricsGrid.append(article);
  });

  if (tickerEl) {
    tickerEl.textContent = `Матчів ${formatNumberValue(summary.matchesTotal)} · Гравців ${formatNumberValue(
      summary.uniquePlayers
    )} · Раундів ${formatNumberValue(summary.roundsTotal)}`;
  }
}

function renderTopLists(players) {
  if (!podiumGrid) {
    return;
  }
  const lists = buildTopLists(players);

  const cards = [
    {
      title: 'Top MVP',
      player: lists.mvp[0],
      value: (player) => `${formatNumberValue(player.mvpCount)} MVP`
    },
    {
      title: `Top Winrate (≥${MIN_MATCHES_FOR_WINRATE})`,
      player: lists.winrate[0],
      value: (player) => formatPercentValue(player.winRate)
    },
    {
      title: 'Most matches',
      player: lists.matches[0],
      value: (player) => `${formatNumberValue(player.matches)} матчів`
    },
    {
      title: 'Best K/D',
      player: lists.kd[0],
      value: (player) => formatDecimalValue(player.kd)
    },
    {
      title: 'Best Accuracy',
      player: lists.accuracy[0],
      value: (player) => formatPercentValue(player.accuracy)
    }
  ];

  podiumGrid.innerHTML = '';
  cards.forEach((card, idx) => {
    const article = document.createElement('article');
    article.className = 'podium-card';
    article.dataset.rank = `#${idx + 1}`;
    if (!card.player) {
      article.innerHTML = `<h3>${card.title}</h3><ul><li>${FALLBACK}</li></ul>`;
      podiumGrid.append(article);
      return;
    }
    article.innerHTML = `
      <h3>${card.title}</h3>
      <ul>
        <li>${card.player.nickname}</li>
        <li><strong>${card.value(card.player)}</strong></li>
        <li>Матчів: ${formatNumberValue(card.player.matches)}</li>
      </ul>
    `;
    podiumGrid.append(article);
  });
}

function sortPlayers(players, sortKey, direction) {
  const dir = direction === 'asc' ? 1 : -1;
  const sorted = [...players].sort((a, b) => {
    const getValue = (player) => {
      switch (sortKey) {
        case 'rank':
          return player.score;
        case 'matches':
          return player.matches;
        case 'winRate':
          return player.winRate ?? -1;
        case 'kd':
          return player.kd ?? -1;
        case 'accuracy':
          return player.accuracy ?? -1;
        case 'mvp':
          return player.mvpScore;
        default:
          return player.score;
      }
    };

    const valueA = getValue(a);
    const valueB = getValue(b);
    if (valueA !== valueB) {
      return dir * (valueA - valueB);
    }
    return a.nickname.localeCompare(b.nickname);
  });

  return sorted;
}

function renderLeaderboard(report) {
  if (!leaderboardBody) {
    return;
  }
  const searchTerm = normalizeNick(searchInput?.value ?? '').toLowerCase();
  const source = report.players;
  const filtered = searchTerm
    ? source.filter((player) => player.nickname.toLowerCase().includes(searchTerm))
    : source;

  const sorted = sortPlayers(filtered, currentSort, currentDirection);

  leaderboardBody.innerHTML = '';
  if (sorted.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="9">Немає гравців у цій лізі</td>`;
    leaderboardBody.append(row);
    return;
  }

  sorted.forEach((player, index) => {
    const row = document.createElement('tr');
    const rank = index + 1;
    const rankLabel = player.score > 0 ? formatNumberValue(rank) : FALLBACK;

    row.innerHTML = `
      <td><span class="rank-chip">${formatNumberValue(rank)}</span></td>
      <td><span class="avatar-chip">${player.nickname.slice(0, 2)}</span></td>
      <td>
        <button type="button" class="player-link" data-player="${player.key}">
          ${player.nickname}
        </button>
      </td>
      <td>${rankLabel}</td>
      <td>${formatNumberValue(player.matches)}</td>
      <td>${formatPercentValue(player.winRate)}</td>
      <td>${formatNumberValue(player.mvpCount)}</td>
      <td>${formatDecimalValue(player.kd)}</td>
      <td>${formatPercentValue(player.accuracy)}</td>
    `;
    const button = row.querySelector('.player-link');
    button?.addEventListener('click', () => openModal(player));
    leaderboardBody.append(row);
  });
}

function renderMatchLog(report) {
  if (!matchlogBody) {
    return;
  }
  matchlogBody.innerHTML = '';
  if (!report.matches || report.matches.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5">Немає матчів</td>`;
    matchlogBody.append(row);
    return;
  }

  report.matches.forEach((match) => {
    const row = document.createElement('tr');
    const dateLabel = match.ts ? new Date(match.ts).toLocaleDateString('uk-UA') : FALLBACK;
    const winnerLabel = (() => {
      if (match.winner === 'team1') {
        return 'Team 1';
      }
      if (match.winner === 'team2') {
        return 'Team 2';
      }
      if (match.winner === 'tie') {
        return 'Tie';
      }
      return match.winner || FALLBACK;
    })();
    const mvpLabel = match.mvps.length > 0 ? match.mvps.join(', ') : FALLBACK;
    row.innerHTML = `
      <td>${dateLabel}</td>
      <td>${match.matchId}</td>
      <td>${winnerLabel}</td>
      <td>${mvpLabel}</td>
      <td>${formatNumberValue(match.playersCount)}</td>
    `;
    matchlogBody.append(row);
  });
}

function updateLeagueButtons(activeValue) {
  leagueButtons.forEach((button) => {
    const target = normalizeLeagueName(button.dataset.leagueTarget || '');
    const isActive = target === activeValue;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function openModal(player) {
  if (!modal || !modalTitle || !modalBody || !player) {
    return;
  }
  modalTitle.textContent = `${player.nickname} · ${getLeagueLabel(activeLeague)}`;
  modalBody.innerHTML = `
    <section>
      <h3>Сезонні показники</h3>
      <div class="detail-grid">
        <div><strong>Матчів</strong>${formatNumberValue(player.matches)}</div>
        <div><strong>Перемог</strong>${formatNumberValue(player.wins)}</div>
        <div><strong>Поразок</strong>${formatNumberValue(player.losses)}</div>
        <div><strong>Нічиї</strong>${formatNumberValue(player.ties)}</div>
        <div><strong>Win rate</strong>${formatPercentValue(player.winRate)}</div>
        <div><strong>MVP</strong>${formatNumberValue(player.mvpCount)}</div>
        <div><strong>K/D</strong>${formatDecimalValue(player.kd)}</div>
        <div><strong>Accuracy</strong>${formatPercentValue(player.accuracy)}</div>
        <div><strong>Раундів</strong>${formatNumberValue(player.rounds)}</div>
      </div>
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

function renderAll() {
  if (!AUTUMN_REPORT) {
    return;
  }
  const report = AUTUMN_REPORT[activeLeague];
  renderMetrics(report.summary);
  renderTopLists(report.players);
  renderLeaderboard(report);
  renderMatchLog(report);
  updateLeagueButtons(activeLeague);
}

function bindControls() {
  closeButton?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

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
        currentDirection = sortKey === 'rank' ? 'desc' : 'desc';
      }
      tabButtons.forEach((btn) => btn.setAttribute('aria-selected', String(btn === button)));
      renderLeaderboard(AUTUMN_REPORT[activeLeague]);
    });
  });

  searchInput?.addEventListener('input', () => {
    renderLeaderboard(AUTUMN_REPORT[activeLeague]);
  });

  leagueButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = normalizeLeagueName(button.dataset.leagueTarget || '');
      if (!target || target === activeLeague) {
        return;
      }
      activeLeague = target;
      renderAll();
    });
  });

  downloadButton?.addEventListener('click', () => {
    if (!AUTUMN_REPORT) {
      return;
    }
    const blob = new Blob([JSON.stringify(AUTUMN_REPORT, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `autumn-2025-report-${activeLeague}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити ${url}: ${response.status}`);
  }
  return response.json();
}

async function boot() {
  try {
    const [kidsEventsRaw, sundayEventsRaw, packData] = await Promise.all([
      fetchJSON('kids_autumn_2025_EVENTS.json').catch(() => null),
      fetchJSON('sunday_autumn_2025_EVENTS.json').catch(() => null),
      fetchJSON('ocinb2025_pack.json').catch(() => null)
    ]);

    PACK = packData;

    if (PACK?.meta?.season && seasonSubtitle) {
      seasonSubtitle.textContent = `Сезон ${PACK.meta.season} · ${PACK?.meta?.league ?? 'Autumn'}`;
    }

    const kidsEvents = Array.isArray(kidsEventsRaw?.events)
      ? kidsEventsRaw.events.map((event) => normalizeEvent(event, 'kids')).filter(Boolean)
      : [];
    const sundayEvents = Array.isArray(sundayEventsRaw?.events)
      ? sundayEventsRaw.events.map((event) => normalizeEvent(event, 'sundaygames')).filter(Boolean)
      : [];

    const kidsReport = buildReport(kidsEvents, 'kids');
    const sundayReport = buildReport(sundayEvents, 'sundaygames');
    const allReport = mergeReports(kidsReport, sundayReport);

    AUTUMN_REPORT = { kids: kidsReport, sundaygames: sundayReport, all: allReport };
    window.AUTUMN_REPORT = AUTUMN_REPORT;

    if (sundayReport.matches.length === 0 && kidsReport.matches.length > 0) {
      activeLeague = 'kids';
    }

    renderAll();
    bindControls();
  } catch (error) {
    console.error('[autumn2025] boot failed', error);
    if (metricsGrid) {
      metricsGrid.innerHTML = '<p class="error">Не вдалося завантажити дані осіннього сезону.</p>';
    }
  }
}

boot();
