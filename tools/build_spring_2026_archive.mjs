import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzIuGIL5xC2gIhHKypLzTcz6ORApWZ-Q3uOqSlEZvZ6DriCmOSC24NgjXSYmZVP_QLgeA/exec';
const SEASON_ID = 'spring_2026';
const SEASON_TITLE = 'Весна 2026';
const DATE_START = '2026-03-01';
const DATE_END = '2026-05-31';
const GAME_WIN_POINTS = 20;
const MVP_BONUS = { mvp1: 12, mvp2: 7, mvp3: 3 };
const RANK_PENALTIES = { F: 0, E: -4, D: -6, C: -8, B: -10, A: -12, S: -14 };
const LEAGUES = [
  { id: 'sundaygames', sheet: 'sundaygames', label: 'Доросла ліга' },
  { id: 'kids', sheet: 'kids', label: 'Дитяча ліга' }
];

function normalizeKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeLeague(value = '') {
  const key = normalizeKey(value);
  if (['sundaygames', 'olds', 'old', 'adult', 'adults', 'доросла', 'дорослі'].includes(key)) return 'sundaygames';
  if (['kids', 'kid', 'child', 'діти', 'дитяча', 'молодша'].includes(key)) return 'kids';
  return key;
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : fallback;
}

function rankFromPoints(points = 0) {
  const pts = toNumber(points, 0);
  if (pts >= 1200) return 'S';
  if (pts >= 1000) return 'A';
  if (pts >= 800) return 'B';
  if (pts >= 600) return 'C';
  if (pts >= 400) return 'D';
  if (pts >= 200) return 'E';
  return 'F';
}

function rankMeta(points = 0) {
  const label = rankFromPoints(points);
  return { label, cssClass: `rank-${label}` };
}

function parseDateOnly(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function parseNickList(value = '') {
  return String(value || '')
    .split(/[,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseWinner(value = '') {
  const key = normalizeKey(value).replace(/\s+/g, '');
  if (['team1', 'команда1', '1', 'a'].includes(key)) return 'team1';
  if (['team2', 'команда2', '2', 'b'].includes(key)) return 'team2';
  if (['tie', 'draw', 'нічия', '0', '-'].includes(key)) return 'tie';
  return '';
}

function isSpringDate(date) {
  return date >= DATE_START && date <= DATE_END;
}

async function fetchSheet(sheet, limitRows = 6000) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', 'getSheetRaw');
  url.searchParams.set('sheet', sheet);
  url.searchParams.set('limitRows', String(limitRows));
  url.searchParams.set('limitCols', '40');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${sheet}: HTTP ${response.status}`);
  const payload = await response.json();
  if (String(payload?.status || '').toUpperCase() === 'ERR') {
    throw new Error(`${sheet}: ${payload?.message || 'GAS returned ERR'}`);
  }
  return {
    header: Array.isArray(payload.header) ? payload.header : [],
    rows: Array.isArray(payload.rows) ? payload.rows : []
  };
}

function indexOf(header, aliases) {
  const normalized = header.map((cell) => normalizeKey(cell));
  return normalized.findIndex((name) => aliases.includes(name));
}

function rowObject(header, row) {
  return header.reduce((acc, name, index) => {
    acc[String(name || '').trim()] = row[index];
    return acc;
  }, {});
}

function parseRoster(sheet) {
  const idxNick = indexOf(sheet.header, ['nickname', 'nick', 'player']);
  const idxPoints = indexOf(sheet.header, ['points', 'pts', 'score', 'mmr']);
  const roster = new Map();
  const trailingNickRows = [];
  sheet.rows.forEach((row, rowIndex) => {
    const rawNick = String(row[idxNick] ?? '');
    const nick = rawNick.trim();
    if (!nick) return;
    if (rawNick !== nick) trailingNickRows.push({ row: rowIndex + 2, rawNick, nick });
    roster.set(normalizeKey(nick), {
      nick,
      points: toNumber(row[idxPoints], 0),
      raw: rowObject(sheet.header, row)
    });
  });
  return { roster, trailingNickRows };
}

function parseGames(sheet) {
  const header = sheet.header;
  const idx = {
    timestamp: indexOf(header, ['timestamp', 'date', 'datetime']),
    league: indexOf(header, ['league', 'division']),
    team1: indexOf(header, ['team1', 'team 1', 'команда1', 'команда 1']),
    team2: indexOf(header, ['team2', 'team 2', 'команда2', 'команда 2']),
    winner: indexOf(header, ['winner', 'result', 'переможець']),
    mvp1: indexOf(header, ['mvp', 'mvp1', 'top1']),
    mvp2: indexOf(header, ['mvp2', 'top2']),
    mvp3: indexOf(header, ['mvp3', 'top3']),
    series: indexOf(header, ['series', 'rounds', 'score', 'points'])
  };
  return sheet.rows.map((row, rowIndex) => {
    const timestamp = String(row[idx.timestamp] || '').trim();
    const date = parseDateOnly(timestamp);
    const mvpRaw = {
      mvp1: String(row[idx.mvp1] || '').trim(),
      mvp2: String(row[idx.mvp2] || '').trim(),
      mvp3: String(row[idx.mvp3] || '').trim()
    };
    const seenMvp = new Set();
    const mvp = {};
    Object.entries(mvpRaw).forEach(([slot, nick]) => {
      const key = normalizeKey(nick);
      if (!key || seenMvp.has(key)) return;
      seenMvp.add(key);
      mvp[slot] = nick;
    });
    return {
      row: rowIndex + 2,
      timestamp,
      date,
      league: normalizeLeague(row[idx.league]),
      team1: parseNickList(row[idx.team1]),
      team2: parseNickList(row[idx.team2]),
      winner: parseWinner(row[idx.winner]),
      mvp1: mvp.mvp1 || '',
      mvp2: mvp.mvp2 || '',
      mvp3: mvp.mvp3 || '',
      rawSeries: String(row[idx.series] || '').trim()
    };
  }).filter((match) => match.date && isSpringDate(match.date) && ['sundaygames', 'kids'].includes(match.league));
}

function parseLogs(sheet) {
  const header = sheet.header;
  const idx = {
    timestamp: indexOf(header, ['timestamp', 'time', 'datetime', 'date']),
    league: indexOf(header, ['league', 'division']),
    nick: indexOf(header, ['nickname', 'nick', 'player']),
    delta: indexOf(header, ['delta', 'ratingdelta', 'pointsdelta']),
    newPoints: indexOf(header, ['newpoints', 'pointsafter', 'rating', 'points'])
  };
  return sheet.rows.map((row, rowIndex) => {
    const timestamp = String(row[idx.timestamp] || '').trim();
    return {
      row: rowIndex + 2,
      timestamp,
      date: parseDateOnly(timestamp),
      league: normalizeLeague(row[idx.league]),
      nick: String(row[idx.nick] || '').trim(),
      delta: toNumber(row[idx.delta], NaN),
      newPoints: toNumber(row[idx.newPoints], NaN)
    };
  }).filter((entry) => entry.date && isSpringDate(entry.date) && ['sundaygames', 'kids'].includes(entry.league) && entry.nick);
}

function touch(stats, nick, leagueId) {
  const key = normalizeKey(nick);
  if (!key) return null;
  if (!stats.has(key)) {
    stats.set(key, {
      nick: String(nick || '').trim(),
      league: leagueId,
      games: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      mvp: 0,
      mvp1: 0,
      mvp2: 0,
      mvp3: 0,
      computedDelta: 0
    });
  }
  return stats.get(key);
}

function computeLeague({ leagueId, roster, games, logs }) {
  const stats = new Map();
  const leagueGames = games.filter((game) => game.league === leagueId);
  const leagueLogs = logs.filter((log) => log.league === leagueId);

  leagueGames.forEach((game) => {
    const teams = { team1: game.team1, team2: game.team2 };
    Object.entries(teams).forEach(([teamKey, members]) => {
      members.forEach((nick) => {
        const row = touch(stats, nick, leagueId);
        if (!row) return;
        row.games += 1;
        row.matches += 1;
        if (game.winner === 'tie') row.draws += 1;
        else if (game.winner === teamKey) row.wins += 1;
        else row.losses += 1;

        const pointsBefore = (roster.get(normalizeKey(nick))?.points ?? 0) - row.computedDelta;
        const rank = rankFromPoints(pointsBefore);
        const winBonus = game.winner === teamKey ? GAME_WIN_POINTS : 0;
        const mvpBonus = normalizeKey(game.mvp1) === normalizeKey(nick) ? MVP_BONUS.mvp1
          : normalizeKey(game.mvp2) === normalizeKey(nick) ? MVP_BONUS.mvp2
            : normalizeKey(game.mvp3) === normalizeKey(nick) ? MVP_BONUS.mvp3
              : 0;
        row.computedDelta += winBonus + mvpBonus + (RANK_PENALTIES[rank] ?? 0);
      });
    });

    [
      ['mvp1', 'mvp'],
      ['mvp2', 'mvp2'],
      ['mvp3', 'mvp3']
    ].forEach(([slot, field]) => {
      const nick = game[slot];
      const row = touch(stats, nick, leagueId);
      if (!row) return;
      row[field] += 1;
    });
  });

  const logTotals = new Map();
  leagueLogs.forEach((log) => {
    const key = normalizeKey(log.nick);
    if (!key || !Number.isFinite(log.delta)) return;
    const current = logTotals.get(key) || { delta: 0, lastPoints: null, logs: 0 };
    current.delta += log.delta;
    current.logs += 1;
    if (Number.isFinite(log.newPoints)) current.lastPoints = log.newPoints;
    logTotals.set(key, current);
  });

  for (const [key, row] of stats.entries()) {
    const log = logTotals.get(key);
    const rosterRow = roster.get(key);
    row.loggedDelta = log?.delta ?? null;
    row.ratingDelta = Number.isFinite(log?.delta) ? log.delta : row.computedDelta;
    row.ratingStart = Number.isFinite(log?.delta)
      ? ((Number.isFinite(log?.lastPoints) ? log.lastPoints : rosterRow?.points ?? 0) - log.delta)
      : (rosterRow?.points ?? 0);
    row.points = Number.isFinite(log?.lastPoints)
      ? log.lastPoints
      : row.ratingStart + row.ratingDelta;
    row.logs = log?.logs || 0;
  }

  // Roster-only players keep their final points but do not pollute the archive leaderboard.
  for (const [key, row] of roster.entries()) {
    if (stats.has(key)) continue;
    stats.set(key, {
      nick: row.nick,
      league: leagueId,
      points: row.points,
      ratingStart: row.points,
      ratingDelta: 0,
      games: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      mvp: 0,
      mvp1: 0,
      mvp2: 0,
      mvp3: 0,
      computedDelta: 0,
      loggedDelta: null,
      logs: 0
    });
  }

  const players = [...stats.values()].map((row) => {
    const winRate = row.games > 0 ? Number(((row.wins / row.games) * 100).toFixed(1)) : 0;
    const mvpTotal = (row.mvp || 0) + (row.mvp2 || 0) + (row.mvp3 || 0);
    return {
      place: 0,
      nick: row.nick,
      nickname: row.nick,
      league: leagueId,
      points: row.points,
      rating: row.points,
      ratingStart: row.ratingStart,
      ratingEnd: row.points,
      ratingDelta: row.ratingDelta,
      delta: row.ratingDelta,
      games: row.games,
      matches: row.games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winRate,
      winrate: winRate,
      mvp: row.mvp || 0,
      mvp1: row.mvp || 0,
      mvp2: row.mvp2 || 0,
      mvp3: row.mvp3 || 0,
      mvpTotal,
      logs: row.logs || 0,
      inactive: row.games === 0,
      avatarUrl: '',
      rankLetter: rankFromPoints(row.points),
      rank: rankMeta(row.points),
      computedDelta: row.computedDelta,
      loggedDelta: row.loggedDelta
    };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.nick.localeCompare(b.nick, 'uk'));

  players.forEach((row, index) => {
    row.place = index + 1;
    row.finalPlace = row.place;
  });

  const activePlayers = players.filter((row) => row.games > 0);
  const summary = {
    league: leagueId,
    players: activePlayers.length,
    rosterPlayers: roster.size,
    games: leagueGames.length,
    matches: leagueGames.length,
    wins: activePlayers.reduce((sum, p) => sum + p.wins, 0),
    losses: activePlayers.reduce((sum, p) => sum + p.losses, 0),
    draws: activePlayers.reduce((sum, p) => sum + p.draws, 0),
    pointsDelta: activePlayers.reduce((sum, p) => sum + p.ratingDelta, 0),
    rounds: leagueGames.reduce((sum, game) => sum + Math.max(1, game.rawSeries.split(/[\/:;-]/).filter(Boolean).length || 1), 0),
    mvp: activePlayers.sort((a, b) => b.mvp - a.mvp)[0]?.nick || null
  };

  const rankDistribution = players.reduce((acc, row) => {
    acc[row.rankLetter] = (acc[row.rankLetter] || 0) + 1;
    return acc;
  }, {});

  const awards = [
    { league: leagueId, award: 'leader', label: 'Лідер сезону', nick: players[0]?.nick || '', value: players[0]?.points || 0 },
    { league: leagueId, award: 'mvp', label: 'MVP сезону', nick: [...players].sort((a, b) => b.mvp - a.mvp)[0]?.nick || '', value: [...players].sort((a, b) => b.mvp - a.mvp)[0]?.mvp || 0 },
    { league: leagueId, award: 'impact', label: 'Найбільший приріст', nick: [...players].sort((a, b) => b.ratingDelta - a.ratingDelta)[0]?.nick || '', value: [...players].sort((a, b) => b.ratingDelta - a.ratingDelta)[0]?.ratingDelta || 0 },
    { league: leagueId, award: 'winrate', label: 'Найкращий WR', nick: [...activePlayers].sort((a, b) => b.winRate - a.winRate)[0]?.nick || '', value: [...activePlayers].sort((a, b) => b.winRate - a.winRate)[0]?.winRate || 0 }
  ];

  const missingLogs = activePlayers
    .filter((row) => !row.logs)
    .map((row) => ({ nick: row.nick, computedDelta: row.computedDelta, games: row.games, wins: row.wins, losses: row.losses }));

  return { table: players, summary, rankDistribution, awards, matches: leagueGames, audit: { missingLogs } };
}

function makeMasterRows(leagues) {
  const players = [];
  const leagueSummary = [];
  const awards = [];
  Object.entries(leagues).forEach(([leagueId, leagueData]) => {
    leagueSummary.push({ league: leagueId, ...leagueData.summary });
    awards.push(...leagueData.awards);
    leagueData.table.forEach((row) => {
      if (!row.games && !row.ratingDelta) return;
      players.push({
        Season: SEASON_ID,
        League: leagueId,
        Nickname: row.nick,
        Place: row.place,
        Points: row.points,
        Rating_start: row.ratingStart,
        Rating_end: row.ratingEnd,
        Rating_delta: row.ratingDelta,
        Games: row.games,
        Wins: row.wins,
        Losses: row.losses,
        Draws: row.draws,
        Winrate: row.winRate,
        MVP1: row.mvp1,
        MVP2: row.mvp2,
        MVP3: row.mvp3,
        MVP_total: row.mvpTotal,
        Rank: row.rankLetter
      });
    });
  });
  return { players, leagueSummary, awards };
}

function toDelimited(rows, delimiter = '\t') {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const text = String(value ?? '');
    if (delimiter === ',' && /[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [
    headers.join(delimiter),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(delimiter))
  ].join('\n');
}

async function main() {
  const [gamesSheet, logsSheet, ...leagueSheets] = await Promise.all([
    fetchSheet('games', 5000),
    fetchSheet('logs', 5000),
    ...LEAGUES.map((league) => fetchSheet(league.sheet, 3000))
  ]);

  const games = parseGames(gamesSheet);
  const logs = parseLogs(logsSheet);
  const leagues = {};
  const audit = {
    generatedAt: new Date().toISOString(),
    gasUrl: GAS_URL,
    sourceRows: {
      games: gamesSheet.rows.length,
      logs: logsSheet.rows.length
    },
    corrections: [],
    warnings: []
  };

  LEAGUES.forEach((league, index) => {
    const { roster, trailingNickRows } = parseRoster(leagueSheets[index]);
    trailingNickRows.forEach((entry) => {
      audit.corrections.push({
        league: league.id,
        type: 'trimmed_roster_nickname',
        ...entry
      });
    });
    leagues[league.id] = computeLeague({
      leagueId: league.id,
      roster,
      games,
      logs
    });
  });

  Object.entries(leagues).forEach(([leagueId, leagueData]) => {
    leagueData.audit.missingLogs.forEach((entry) => {
      audit.warnings.push({
        league: leagueId,
        type: 'player_has_games_without_logs',
        ...entry
      });
    });
  });

  const master = makeMasterRows(leagues);
  const archive = {
    seasonId: SEASON_ID,
    seasonTitle: SEASON_TITLE,
    period: { dateStart: DATE_START, dateEnd: DATE_END },
    generatedAt: audit.generatedAt,
    audit,
    leagues: Object.fromEntries(Object.entries(leagues).map(([leagueId, value]) => [leagueId, {
      table: value.table,
      summary: value.summary,
      rankDistribution: value.rankDistribution,
      awards: value.awards,
      matches: value.matches
    }])),
    sections: {
      season_meta: {
        season: SEASON_ID,
        title: SEASON_TITLE,
        dateStart: DATE_START,
        dateEnd: DATE_END,
        generatedAt: audit.generatedAt
      },
      league_summary: master.leagueSummary,
      awards: master.awards,
      series_summary: [],
      players: master.players
    }
  };

  const dataDir = path.join(ROOT, 'v2', 'data', 'seasons');
  const outputDir = path.join(ROOT, 'tools', 'output');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, `${SEASON_ID}.json`), `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outputDir, `season_${SEASON_ID}_master.tsv`), toDelimited(master.players, '\t'), 'utf8');
  await fs.writeFile(path.join(outputDir, `season_${SEASON_ID}_master.csv`), toDelimited(master.players, ','), 'utf8');
  await fs.writeFile(path.join(outputDir, `season_${SEASON_ID}_audit.json`), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    seasonId: SEASON_ID,
    games: games.length,
    logs: logs.length,
    leagues: Object.fromEntries(Object.entries(leagues).map(([leagueId, value]) => [leagueId, {
      players: value.table.length,
      activePlayers: value.summary.players,
      games: value.summary.games,
      warnings: value.audit.missingLogs.length
    }])),
    warnings: audit.warnings.length,
    corrections: audit.corrections.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
