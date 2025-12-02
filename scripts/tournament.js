 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/scripts/tournament.js b/scripts/tournament.js
index 904fdf9dd9f307a60de005c632b66afbde014d9a..b320aa974ae727a78b2b407dbd070b4b05ddf53f 100644
--- a/scripts/tournament.js
+++ b/scripts/tournament.js
@@ -1,319 +1,520 @@
 // -------------------------------------------------------------
 // VARTA TOURNAMENT VIEW · ARCHIVE #01
 // Новий монолітний tournament.js з покращеною логікою та UX
 // -------------------------------------------------------------
 
-import { loadPlayers, normalizeLeague } from './api.js';
+import { loadPlayers, normalizeLeague, fetchPlayerGames } from './api.js';
 import { rankLetterForPoints } from './rankUtils.js';
 
+const DEBUG_TOURNAMENT = false;
+
 const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';
+const MVP_FIELDS = ['MVP', 'Mvp', 'mvp', 'MVP2', 'mvp2', 'MVP 2', 'mvp 2', 'MVP3', 'mvp3', 'MVP 3', 'mvp 3'];
+const TEAM_FIELDS = ['Team1', 'Team 1', 'team1', 'team 1', 'Team2', 'Team 2', 'team2', 'team 2'];
+const seasonStatsCache = new Map();
+let lastPlayerStats = [];
 
 // ---------- Нікнейми → API ----------
 const PLAYER_MAP = {
   'Юра': 'Morti',
   'Морті': 'Morti',
   'Morti': 'Morti',
+  'Сегедин': 'Morti',
 
   'Ворон': 'Voron',
   'Voron': 'Voron',
 
   'Оксана': 'Оксанка',
   'Оксанка': 'Оксанка',
 
   'Даня': 'hAppser',
+  'Happser': 'hAppser',
   'hAppser': 'hAppser',
 
   'Ластон': 'Laston',
   'Laston': 'Laston',
 
   'Лерес': 'Leres',
   'Leres': 'Leres',
 
   'Кицюня': 'Кицюня',
   'Кіцюня': 'Кицюня',
 
   'Кокосік': 'Cocosik',
   'Cocosik': 'Cocosik',
 
   'Sem': 'Sem',
+  'Сем': 'Sem',
   'Justy': 'Justy',
+  'Джасті': 'Justy',
   'Олег': 'Олег',
   'Темофій': 'Temostar',
-  'Temostar': 'Temostar'
+  'Темостар': 'Temostar',
+  'Temostar': 'Temostar',
+
+  'Остап': 'Остап',
+  'Вова': 'Вова'
 };
 
 function mapNick(name) {
-  return PLAYER_MAP[name] || name;
+  const key = String(name || '').trim();
+  return PLAYER_MAP[key] || key;
 }
 
 // DM-код → команда
 const TEAM_BY_CODE = {
   '1': 'green',
   '2': 'blue',
   '3': 'red'
 };
 
+function ktPointsForTime(timeStr) {
+  if (!timeStr || typeof timeStr !== 'string') return 0;
+  const [mPart, sPart] = timeStr.split(':');
+  const minutes = Number(mPart);
+  const seconds = Number(sPart);
+  const totalSeconds = Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 999;
+
+  if (totalSeconds <= 2 * 60 + 29) return 5;
+  if (totalSeconds <= 3 * 60) return 4;
+  if (totalSeconds <= 3 * 60 + 29) return 3;
+  if (totalSeconds <= 4 * 60) return 2;
+  return 1;
+}
+
 // ---------- Турнір ----------
 const TOURNAMENT = {
   league: 'olds',
   meta: {
     title: 'Турнір VARTA — Архів #01',
     date: '15 грудня 2024',
     format: '3×4 · DM · KT · TDM',
     map: 'Pixel-arena · Neon Raid',
     modes: ['DM', 'KT', 'TDM']
   },
   teams: {
     green: {
       name: 'Зелена команда',
       color: 'var(--team-green)',
       players: ['Морті', 'Ворон', 'Оксанка', 'hAppser']
     },
     blue: {
       name: 'Синя команда',
       color: 'var(--team-blue)',
       players: ['Laston', 'Leres', 'Кицюня', 'Cocosik']
     },
     red: {
       name: 'Червона команда',
       color: 'var(--team-red)',
       players: ['Sem', 'Justy', 'Олег', 'Temostar']
     }
   },
   modes: {
     dm: [
       {
         label: 'Раундовий DM',
         teamA: 'green',
         teamB: 'blue',
         results: ['2', '=', '2', '=', '2', '2', '2'],
-        mvp: ['Laston', 'Leres', 'Morti']
+        mvp: ['Laston', 'Leres', 'Сегедин']
       },
       {
         label: 'Раундовий DM',
         teamA: 'blue',
         teamB: 'red',
         results: ['2', '3', '2', '2', '2', '2'],
         mvp: ['Leres', 'Laston', 'Sem']
       },
       {
         label: 'Раундовий DM',
         teamA: 'red',
         teamB: 'green',
         results: ['3', '=', '3', '3', '1', '3', '1', '3'],
-        mvp: ['Morti', 'Temostar', 'Олег']
+        mvp: ['Морті', 'Temostar', 'Олег']
       }
     ],
     kt: [
       {
         label: 'Control Point',
         teamA: 'blue',
         teamB: 'green',
         rounds: [
-          { winner: 'green', time: '4:07', points: 1 },
-          { winner: 'blue', time: '3:56', points: 2 }
+          { winner: 'green', time: '4:07' },
+          { winner: 'blue', time: '3:56' }
         ],
-        mvp: ['Morti', 'Laston', 'Leres']
+        mvp: ['Юра', 'Laston', 'Вова']
       },
       {
         label: 'Control Point',
         teamA: 'blue',
         teamB: 'red',
         rounds: [
-          { winner: 'blue', time: '3:52', points: 2 },
-          { winner: 'red', time: '3:13', points: 3 }
+          { winner: 'blue', time: '3:52' },
+          { winner: 'red', time: '3:13' }
         ],
-        mvp: ['Morti', 'Laston', 'Temostar']
+        mvp: ['Остап', 'Laston', 'Темофій']
       },
       {
         label: 'Control Point',
         teamA: 'red',
         teamB: 'green',
         rounds: [
-          { winner: 'red', time: '3:06', points: 3 },
-          { winner: 'red', time: '3:09', points: 3 }
+          { winner: 'red', time: '3:06' },
+          { winner: 'red', time: '3:09' }
         ],
-        mvp: ['Morti', 'Justy', 'Temostar']
+        mvp: ['Юра', 'Остап', 'Темофій']
       }
     ],
     tdm: [
       { label: 'TDM', teamA: 'green', teamB: 'blue', scores: { green: 1, blue: 4 } },
       { label: 'TDM', teamA: 'blue', teamB: 'red', scores: { blue: 4, red: 2 } },
       { label: 'TDM', teamA: 'green', teamB: 'red', scores: { green: 3, red: 5 } }
     ]
   }
 };
 
 // ---------- Player Index ----------
 function buildPlayerIndex(players) {
   const index = new Map();
-  players.forEach((p) => index.set(p.nick.toLowerCase(), p));
+
+  players.forEach((p) => {
+    const aliases = [p.nick, p.apiNick, p.name, p.Nickname, p.nickname];
+    aliases
+      .map((v) => String(v || '').trim())
+      .filter(Boolean)
+      .forEach((alias) => {
+        const key = alias.toLowerCase();
+        if (!index.has(key)) index.set(key, p);
+      });
+  });
+
   return index;
 }
 
 function getProfile(displayNick, playerIndex) {
   const apiNick = mapNick(displayNick);
-  const p = playerIndex.get(apiNick.toLowerCase());
-  const pts = Number(p?.pts ?? 0);
+  const key = String(apiNick || '').toLowerCase();
+  const base = key ? playerIndex.get(key) : null;
+  const pts = Number(base?.pts ?? base?.points ?? base?.mmr ?? 0);
+  const rank = base?.rank || rankLetterForPoints(pts);
+  const avatar = base?.avatar || base?.avatar_url || DEFAULT_AVATAR;
+
+  if (DEBUG_TOURNAMENT && (!base || !base.avatar || !base.rank)) {
+    console.warn('[tournament] missing base data for', apiNick, { hasBase: !!base });
+  }
 
   return {
     displayNick,
     apiNick,
     points: pts,
-    rank: p?.rank || rankLetterForPoints(pts),
-    avatar: p?.avatar || DEFAULT_AVATAR,
+    rank,
+    avatar: avatar || DEFAULT_AVATAR,
     league: normalizeLeague(TOURNAMENT.league)
   };
 }
 
 // ---------- Icons (DM/TDM вьювер) ----------
 function resultIcon(code) {
   if (code === '=') return '⚪';
   if (code === '1') return '🟢';
   if (code === '2') return '🔵';
   return '🔴';
 }
 
+function rankClass(rank) {
+  const letter = String(rank || '').trim();
+  return `rank-chip rank-xs rank-${letter.toLowerCase()}`;
+}
+
+function buildPlayerIdentity(player) {
+  const nick = player.displayNick;
+  const apiNick = player.apiNick;
+  const teamClass = player.teamId ? `team--${player.teamId}` : '';
+  const rankBadge = `<span class="${rankClass(player.rank)} ${teamClass}" ${player.teamColor ? `style="--team-color:${player.teamColor}"` : ''}>${player.rank || '—'}</span>`;
+  const avatar = player.avatar || DEFAULT_AVATAR;
+
+  return `
+    <div class="player-identity">
+      <div class="player-avatar">
+        <img src="${avatar}" alt="${nick}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${DEFAULT_AVATAR}'" />
+      </div>
+      <div class="player-name-block">
+        <div class="player-name-row">${nick} ${rankBadge}</div>
+        <div class="player-meta">@${apiNick}</div>
+      </div>
+    </div>
+  `;
+}
+
+function containsNick(value, targetNick) {
+  if (!value) return false;
+  return String(value)
+    .split(/[;,]/)
+    .map((part) => part.trim().toLowerCase())
+    .filter(Boolean)
+    .some((name) => name === targetNick.toLowerCase());
+}
+
+function detectTeamSide(game, targetNick) {
+  let isTeam1 = false;
+  let isTeam2 = false;
+
+  TEAM_FIELDS.forEach((field, idx) => {
+    const val = game[field];
+    if (!val) return;
+    if (idx < 4) {
+      isTeam1 = isTeam1 || containsNick(val, targetNick);
+    } else {
+      isTeam2 = isTeam2 || containsNick(val, targetNick);
+    }
+  });
+
+  if (isTeam1) return 'team1';
+  if (isTeam2) return 'team2';
+  return null;
+}
+
+function deriveSeasonKey(game) {
+  const seasonField = game.Season || game.season || game.seasonId || game.SeasonId || game.season_id;
+  if (seasonField) return String(seasonField);
+
+  const ts = new Date(game.Timestamp || game.Date || game.date || game.time).getTime();
+  if (Number.isFinite(ts)) {
+    const d = new Date(ts);
+    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
+  }
+
+  return 'current';
+}
+
+function aggregateSeasonStats(games, targetNick) {
+  const map = new Map();
+
+  games.forEach((game) => {
+    const side = detectTeamSide(game, targetNick);
+    if (!side) return;
+
+    const key = deriveSeasonKey(game);
+    if (!map.has(key)) {
+      map.set(key, {
+        key,
+        games: 0,
+        wins: 0,
+        losses: 0,
+        draws: 0,
+        mvps: 0,
+        mmrSamples: [],
+        lastTs: 0
+      });
+    }
+
+    const rec = map.get(key);
+    rec.games += 1;
+
+    const winner = String(game.Winner || game.winner || '').toLowerCase();
+    const drawValues = ['draw', 'tie', 'ничья', 'нічию'];
+
+    if (!winner || drawValues.includes(winner)) {
+      rec.draws += 1;
+    } else if (['team1', 'team 1', '1'].includes(winner)) {
+      if (side === 'team1') rec.wins += 1; else rec.losses += 1;
+    } else if (['team2', 'team 2', '2'].includes(winner)) {
+      if (side === 'team2') rec.wins += 1; else rec.losses += 1;
+    }
+
+    const ts = new Date(game.Timestamp || game.Date || game.date || game.time).getTime();
+    if (Number.isFinite(ts) && ts > rec.lastTs) rec.lastTs = ts;
+
+    const isMvp = MVP_FIELDS.some((field) => containsNick(game[field], targetNick));
+    if (isMvp) rec.mvps += 1;
+
+    const mmrField = ['PointsDelta', 'points_delta', 'MMRΔ', 'mmr_delta', 'MMR', 'mmr', 'MMRDelta', 'rating_change']
+      .map((f) => Number(game[f]))
+      .find((val) => Number.isFinite(val));
+
+    if (Number.isFinite(mmrField)) rec.mmrSamples.push(mmrField);
+  });
+
+  return Array.from(map.values()).map((rec) => ({
+    ...rec,
+    avgMmrChange: rec.mmrSamples.length
+      ? Math.round((rec.mmrSamples.reduce((a, b) => a + b, 0) / rec.mmrSamples.length) * 10) / 10
+      : null
+  }));
+}
+
+function pickSeasonSnapshots(games, nick) {
+  const aggregated = aggregateSeasonStats(games, nick);
+  aggregated.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
+  return {
+    current: aggregated[0] || null,
+    previous: aggregated[1] || null
+  };
+}
+
+async function loadSeasonSnapshots(apiNick, league) {
+  const cacheKey = `${league}:${apiNick}`;
+  if (seasonStatsCache.has(cacheKey)) return seasonStatsCache.get(cacheKey);
+
+  try {
+    const games = await fetchPlayerGames(apiNick, league);
+    const snapshots = pickSeasonSnapshots(games, apiNick);
+    seasonStatsCache.set(cacheKey, snapshots);
+    return snapshots;
+  } catch (err) {
+    console.error('[tournament] season stats error', err);
+    const empty = { current: null, previous: null };
+    seasonStatsCache.set(cacheKey, empty);
+    return empty;
+  }
+}
+
 // ---------- Допоміжні структури ----------
 function initTeamStats(playerIndex) {
   const stats = {};
 
   Object.entries(TOURNAMENT.teams).forEach(([id, team]) => {
     const avg =
       team.players.reduce((acc, nick) => acc + getProfile(nick, playerIndex).points, 0) /
       team.players.length || 0;
 
     stats[id] = {
       id,
       name: team.name,
       color: team.color,
       players: [...team.players],
       // турнірна сітка
       games: 0,
       wins: 0,
       losses: 0,
       draws: 0,
       points: 0, // турнірні (3 за W, 1 за D)
       place: 0,
       // режимні метрики
       dmRoundsWon: 0,
       ktPoints: 0,
       tdmScore: 0,
       avgMMR: avg,
       secondPlacesDM: 0,
       thirdPlacesDM: 0
     };
   });
 
   return stats;
 }
 
 function initPlayerStats(playerIndex) {
   const stats = {};
 
   Object.entries(TOURNAMENT.teams).forEach(([teamId, team]) => {
     team.players.forEach((nick) => {
       const base = getProfile(nick, playerIndex);
       stats[nick] = {
         ...base,
         teamId,
         teamName: team.name,
+        teamColor: team.color || '',
         games: 0,
         wins: 0,
         losses: 0,
         draws: 0,
         mvps: 0,
         dmRounds: 0,
         ktPoints: 0,
         tdmScore: 0,
         impact: 0,
         mmrDelta: 0,
         secondPlaces: 0,
         thirdPlaces: 0
       };
     });
   });
 
   return stats;
 }
 
 // ---------- Підрахунок всіх статистик турніру ----------
 function buildTournamentStats(playerIndex) {
   const teamStats = initTeamStats(playerIndex);
   const playerStats = initPlayerStats(playerIndex);
 
   let totalMatches = 0;
+  let totalDmRounds = 0;
+  let totalKtRounds = 0;
+  let totalTdmCaptures = 0;
 
   const registerGameResult = (participants, outcome) => {
     const { winnerIds, drawIds, loserIds } = outcome;
 
     participants.forEach((teamId) => {
       const t = teamStats[teamId];
       if (!t) return;
       t.games += 1;
       TOURNAMENT.teams[teamId].players.forEach((nick) => {
         playerStats[nick].games += 1;
       });
     });
 
     winnerIds.forEach((teamId) => {
       const t = teamStats[teamId];
       if (!t) return;
       t.wins += 1;
       t.points += 3;
       TOURNAMENT.teams[teamId].players.forEach((nick) => {
         playerStats[nick].wins += 1;
       });
     });
 
     drawIds.forEach((teamId) => {
       const t = teamStats[teamId];
       if (!t) return;
       t.draws += 1;
       t.points += 1;
       TOURNAMENT.teams[teamId].players.forEach((nick) => {
         playerStats[nick].draws += 1;
       });
     });
 
     loserIds.forEach((teamId) => {
       const t = teamStats[teamId];
       if (!t) return;
       t.losses += 1;
       TOURNAMENT.teams[teamId].players.forEach((nick) => {
         playerStats[nick].losses += 1;
       });
     });
 
     totalMatches += 1;
   };
 
   // ---------- DM (FFA 3×3 на раунди) ----------
   TOURNAMENT.modes.dm.forEach((game) => {
     const counters = { green: 0, blue: 0, red: 0 };
 
+    totalDmRounds += game.results.length;
+
     game.results.forEach((code) => {
       if (code === '=') return;
       const teamId = TEAM_BY_CODE[code];
       if (teamId) counters[teamId] += 1;
     });
 
     // DM-раунди для команд + гравців
     Object.entries(counters).forEach(([teamId, wins]) => {
       const t = teamStats[teamId];
       if (!t) return;
       t.dmRoundsWon += wins;
       TOURNAMENT.teams[teamId].players.forEach((nick) => {
         playerStats[nick].dmRounds += wins;
       });
     });
 
     const values = Object.values(counters);
     const maxWins = Math.max(...values);
 
     if (maxWins > 0) {
       const participants = Object.keys(TOURNAMENT.teams);
       const leaders = Object.entries(counters)
         .filter(([, v]) => v === maxWins)
         .map(([id]) => id);
 
@@ -351,328 +552,590 @@ function buildTournamentStats(playerIndex) {
           });
         } else if (currentPlace === 3) {
           teamStats[teamId].thirdPlacesDM += 1;
           TOURNAMENT.teams[teamId].players.forEach((nick) => {
             playerStats[nick].thirdPlaces += 1;
           });
         }
       });
 
       registerGameResult(participants, { winnerIds, drawIds, loserIds });
     }
 
     // MVP за DM
     game.mvp.forEach((nick) => {
       const apiNick = mapNick(nick);
       const player = Object.values(playerStats).find((p) => p.apiNick === apiNick);
       if (player) player.mvps += 1;
     });
   });
 
   // ---------- KT (Control Point) ----------
   TOURNAMENT.modes.kt.forEach((game) => {
     const pts = { [game.teamA]: 0, [game.teamB]: 0 };
 
     game.rounds.forEach((round) => {
-      pts[round.winner] = (pts[round.winner] || 0) + round.points;
+      const roundPoints = ktPointsForTime(round.time);
+      pts[round.winner] = (pts[round.winner] || 0) + roundPoints;
       const t = teamStats[round.winner];
-      if (t) t.ktPoints += round.points;
+      if (t) t.ktPoints += roundPoints;
       TOURNAMENT.teams[round.winner].players.forEach((nick) => {
-        playerStats[nick].ktPoints += round.points;
+        playerStats[nick].ktPoints += roundPoints;
       });
+      totalKtRounds += 1;
     });
 
     const aPts = pts[game.teamA] || 0;
     const bPts = pts[game.teamB] || 0;
 
     let winnerIds = [];
     let drawIds = [];
     let loserIds = [];
 
     if (aPts === bPts) {
       drawIds = [game.teamA, game.teamB];
     } else if (aPts > bPts) {
       winnerIds = [game.teamA];
       loserIds = [game.teamB];
     } else {
       winnerIds = [game.teamB];
       loserIds = [game.teamA];
     }
 
     registerGameResult([game.teamA, game.teamB], { winnerIds, drawIds, loserIds });
 
     game.mvp.forEach((nick) => {
       const apiNick = mapNick(nick);
       const player = Object.values(playerStats).find((p) => p.apiNick === apiNick);
       if (player) player.mvps += 1;
     });
   });
 
   // ---------- TDM ----------
   TOURNAMENT.modes.tdm.forEach((game) => {
     const scoreA = game.scores[game.teamA] || 0;
     const scoreB = game.scores[game.teamB] || 0;
 
+    totalTdmCaptures += scoreA + scoreB;
+
     const teamAStats = teamStats[game.teamA];
     const teamBStats = teamStats[game.teamB];
 
     if (teamAStats) teamAStats.tdmScore += scoreA;
     if (teamBStats) teamBStats.tdmScore += scoreB;
 
     TOURNAMENT.teams[game.teamA].players.forEach((nick) => {
       playerStats[nick].tdmScore += scoreA;
     });
     TOURNAMENT.teams[game.teamB].players.forEach((nick) => {
       playerStats[nick].tdmScore += scoreB;
     });
 
     let winnerIds = [];
     let drawIds = [];
     let loserIds = [];
 
     if (scoreA === scoreB) {
       drawIds = [game.teamA, game.teamB];
     } else if (scoreA > scoreB) {
       winnerIds = [game.teamA];
       loserIds = [game.teamB];
     } else {
       winnerIds = [game.teamB];
       loserIds = [game.teamA];
     }
 
     registerGameResult([game.teamA, game.teamB], { winnerIds, drawIds, loserIds });
   });
 
   // ---------- Фінальні підрахунки ----------
   const teamArray = Object.values(teamStats).sort((a, b) => {
     if (b.points !== a.points) return b.points - a.points;
     if (b.wins !== a.wins) return b.wins - a.wins;
     return b.avgMMR - a.avgMMR;
   });
 
   teamArray.forEach((t, i) => {
     t.place = i + 1;
   });
 
   // Impact для гравців: на основі реальних цифр (MVP, DM, KT, TDM)
   Object.values(playerStats).forEach((p) => {
     const impact =
       p.mvps * 5 +
+      p.secondPlaces * 2 +
+      p.thirdPlaces * 1 +
       p.dmRounds * 1 +
       p.ktPoints * 2 +
       p.tdmScore * 0.3;
 
     p.impact = Math.round(impact * 10) / 10;
   });
 
   const playerArray = Object.values(playerStats).sort((a, b) => b.impact - a.impact);
 
   const topMvp = playerArray.reduce(
     (best, p) => (p.mvps > (best?.mvps || 0) ? p : best),
     null
   );
 
+  const dmBeast = playerArray.reduce((best, p) => (p.dmRounds > (best?.dmRounds || 0) ? p : best), null);
+  const ktKing = playerArray.reduce((best, p) => (p.ktPoints > (best?.ktPoints || 0) ? p : best), null);
+  const baseBreaker = playerArray.reduce((best, p) => (p.tdmScore > (best?.tdmScore || 0) ? p : best), null);
+
   const podiumPlayers = playerArray.slice(0, 3);
 
+  const summary = {
+    totalPlayers: playerArray.length,
+    totalTeams: Object.keys(teamStats).length,
+    totalMatches,
+    totalDmRounds,
+    totalKtRounds,
+    totalTdmCaptures,
+    totalWins: Object.values(teamStats).reduce((acc, t) => acc + t.wins, 0),
+    totalDraws: Object.values(teamStats).reduce((acc, t) => acc + t.draws, 0),
+    totalLosses: Object.values(teamStats).reduce((acc, t) => acc + t.losses, 0),
+    modeBreakdown: {
+      dm: TOURNAMENT.modes.dm.length,
+      kt: TOURNAMENT.modes.kt.length,
+      tdm: TOURNAMENT.modes.tdm.length
+    },
+    teamTotals: teamArray.map((t) => ({
+      id: t.id,
+      name: t.name,
+      dm: t.dmRoundsWon,
+      kt: t.ktPoints,
+      tdm: t.tdmScore,
+      total: t.dmRoundsWon + t.ktPoints + t.tdmScore,
+      record: `${t.wins}W-${t.draws}D-${t.losses}L`
+    })),
+    awards: {
+      championTeam: teamArray[0] || null,
+      topMvp,
+      dmBeast,
+      ktKing,
+      baseBreaker
+    }
+  };
+
   return {
     teamStats: teamArray,
     playerStats: playerArray,
     podiumPlayers,
     topMvp,
     totalPlayers: playerArray.length,
-    totalMatches
+    totalMatches,
+    summary
   };
 }
 
 // ---------- HERO + загальна панель ----------
 function renderHero(totals) {
   const titleEl = document.getElementById('tournament-title');
   const metaEl = document.getElementById('tournament-meta');
   const statsEl = document.getElementById('tournament-stats');
 
   if (titleEl) titleEl.textContent = TOURNAMENT.meta.title;
   if (metaEl) {
     metaEl.textContent = `${TOURNAMENT.meta.date} · ${TOURNAMENT.meta.format} · ${TOURNAMENT.meta.map}`;
   }
 
   if (!statsEl) return;
 
   statsEl.innerHTML = '';
 
   const cards = [
     {
       label: 'Гравців',
       value: totals.totalPlayers
     },
+    {
+      label: 'Команд',
+      value: totals.summary?.totalTeams ?? Object.keys(TOURNAMENT.teams).length
+    },
     {
       label: 'Матчів (DM/KT/TDM)',
       value: totals.totalMatches
     }
   ];
 
   if (totals.topMvp) {
     cards.push({
       label: 'MVP турніру',
       value: `${totals.topMvp.displayNick} (${totals.topMvp.mvps})`
     });
   }
 
   cards.forEach((card) => {
     statsEl.insertAdjacentHTML(
       'beforeend',
       `<div class='stat-card'>
          <p class='stat-label'>${card.label}</p>
          <p class='stat-value'>${card.value}</p>
        </div>`
     );
   });
 
   if (totals.podiumPlayers && totals.podiumPlayers.length) {
     const podium = totals.podiumPlayers
       .map((p, i) => {
         const place = i + 1;
         const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
         return `<li>${medal} ${p.displayNick} <span class='muted'>(ранг ${p.rank})</span></li>`;
       })
       .join('');
 
     statsEl.insertAdjacentHTML(
       'beforeend',
       `<div class='stat-card'>
          <p class='stat-label'>Топ-3 гравців турніру</p>
          <ul style='margin: 4px 0 0; padding-left: 18px;'>${podium}</ul>
        </div>`
     );
   }
 }
 
+// ---------- Інфографіка ----------
+function renderInfographic(summary) {
+  const container = document.getElementById('tournament-infographic');
+  const section = document.getElementById('tournament-infographic-section');
+  if (!container || !section) return;
+
+  if (!summary) {
+    section.classList.add('hidden');
+    return;
+  }
+
+  container.innerHTML = '';
+  section.classList.remove('hidden');
+
+  const awards = summary.awards || {};
+
+  const awardCards = [];
+  if (awards.championTeam) {
+    awardCards.push({
+      icon: '🏆',
+      title: 'Champion Team',
+      value: awards.championTeam.name,
+      meta: `DM ${awards.championTeam.dmRoundsWon} · KT ${awards.championTeam.ktPoints} · TDM ${awards.championTeam.tdmScore} = ${
+        awards.championTeam.dmRoundsWon + awards.championTeam.ktPoints + awards.championTeam.tdmScore
+      }`
+    });
+  }
+  if (awards.topMvp) awardCards.push({ icon: '⭐', title: 'MVP турніру', value: awards.topMvp.displayNick, meta: `${awards.topMvp.mvps} MVP` });
+  if (awards.dmBeast) awardCards.push({ icon: '💥', title: 'DM Beast', value: awards.dmBeast.displayNick, meta: `${awards.dmBeast.dmRounds} раундів` });
+  if (awards.ktKing) awardCards.push({ icon: '🎯', title: 'KT King', value: awards.ktKing.displayNick, meta: `${awards.ktKing.ktPoints} очок` });
+  if (awards.baseBreaker)
+    awardCards.push({ icon: '🚩', title: 'Base Breaker', value: awards.baseBreaker.displayNick, meta: `${awards.baseBreaker.tdmScore} баз` });
+
+  if (awardCards.length) {
+    const awardGrid = awardCards
+      .map(
+        (card) => `
+          <div class="award-card">
+            <div class="award-card__icon">${card.icon}</div>
+            <div class="award-card__body">
+              <p class="award-card__title">${card.title}</p>
+              <p class="award-card__value">${card.value}</p>
+              <p class="award-card__meta">${card.meta}</p>
+            </div>
+          </div>
+        `
+      )
+      .join('');
+    container.insertAdjacentHTML('beforeend', `<div class="award-grid">${awardGrid}</div>`);
+  }
+
+  const cards = [
+    { label: 'DM раундів', value: summary.totalDmRounds },
+    { label: 'KT раундів', value: summary.totalKtRounds },
+    { label: 'Знищених баз (TDM)', value: summary.totalTdmCaptures },
+    { label: 'W / D / L', value: `${summary.totalWins} / ${summary.totalDraws} / ${summary.totalLosses}` },
+    { label: 'Унікальних гравців', value: summary.totalPlayers },
+    {
+      label: 'Режими',
+      value: `DM ×${summary.modeBreakdown.dm} · KT ×${summary.modeBreakdown.kt} · TDM ×${summary.modeBreakdown.tdm}`
+    }
+  ];
+
+  const infoGrid = cards
+    .map(
+      (card) => `
+        <div class="info-chip">
+          <p class="info-chip__label">${card.label}</p>
+          <p class="info-chip__value">${card.value}</p>
+        </div>
+      `
+    )
+    .join('');
+
+  container.insertAdjacentHTML('beforeend', `<div class="infographic-grid">${infoGrid}</div>`);
+
+  const scoreCards = (summary.teamTotals || [])
+    .map(
+      (t) => `
+        <div class="score-card team-${t.id}-row">
+          <div class="score-card__row"><span class="team-chip team-chip--${t.id}"><span class="team-chip__dot"></span><span>${t.name}</span></span></div>
+          <div class="score-card__stats">DM ${t.dm} · KT ${t.kt} · TDM ${t.tdm}</div>
+          <div class="score-card__total">${t.total} очок</div>
+          <div class="score-card__meta">${t.record}</div>
+        </div>
+      `
+    )
+    .join('');
+
+  if (scoreCards) {
+    container.insertAdjacentHTML('beforeend', `<div class="score-grid">${scoreCards}</div>`);
+  }
+}
+
 // ---------- Команди (таблиця з W/L/D/Очки) ----------
 function renderTeams(teamStats) {
   const tbody = document.querySelector('#teams-table tbody');
   if (!tbody) return;
 
   tbody.innerHTML = '';
 
   teamStats.forEach((t) => {
     const nameCell = `
-      <span class='team-chip' style='background:${t.color}'></span>
-      <span>${t.name}</span>
+      <span class='team-chip team-chip--${t.id}'><span class='team-chip__dot'></span><span>${t.name}</span></span>
     `;
 
     tbody.insertAdjacentHTML(
       'beforeend',
       `<tr>
          <td>${nameCell}</td>
          <td>${t.wins}</td>
          <td>${t.losses}</td>
          <td>${t.draws}</td>
          <td>${t.points}</td>
          <td>${Math.round(t.avgMMR)}</td>
          <td>${t.place}</td>
        </tr>`
     );
   });
 }
 
 // ---------- Гравці (таблиця з рангами та Impact) ----------
 function renderPlayers(playerStats) {
   const tbody = document.querySelector('#players-table tbody');
   if (!tbody) return;
 
   tbody.innerHTML = '';
 
+  lastPlayerStats = [...playerStats];
+
   playerStats.forEach((p) => {
     const teamLabel = TOURNAMENT.teams[p.teamId]?.name || p.teamName || '';
+    const teamChip = `<span class="team-chip team-chip--${p.teamId}"><span class="team-chip__dot"></span><span>${teamLabel}</span></span>`;
+    const nickCell = buildPlayerIdentity(p);
+    const mmrDelta = p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta);
+    const row = document.createElement('tr');
+    row.classList.add('player-row', `team-${p.teamId}-row`);
+    row.dataset.nick = p.displayNick;
+    row.dataset.apiNick = p.apiNick;
+
+    row.innerHTML = `
+      <td>${nickCell}</td>
+      <td>${teamChip}</td>
+      <td>${p.games}</td>
+      <td>${p.wins}</td>
+      <td>${p.losses}</td>
+      <td>${p.draws}</td>
+      <td>${p.mvps}</td>
+      <td>${p.secondPlaces}</td>
+      <td>${p.thirdPlaces}</td>
+      <td>${p.impact}</td>
+      <td>${mmrDelta}</td>
+    `;
+
+    row.addEventListener('click', () => openPlayerModal(p));
+    tbody.appendChild(row);
+  });
+}
 
-    const nickCell = `
-      <div>
-        <span>${p.displayNick}</span>
-        <span class='badge status' style='margin-left:6px;'>${p.rank}</span>
+function statItem(label, value) {
+  return `
+    <div class="stat-item">
+      <span class="label">${label}</span>
+      <span class="value">${value}</span>
+    </div>
+  `;
+}
+
+function renderSeasonSection(title, stats) {
+  if (!stats) {
+    return `<div class="empty-note">Дані відсутні</div>`;
+  }
+
+  const mmr = stats.avgMmrChange === null || Number.isNaN(stats.avgMmrChange)
+    ? '—'
+    : `${stats.avgMmrChange > 0 ? '+' : ''}${stats.avgMmrChange}`;
+
+  return `
+    <div>
+      <h4 style="margin:0 0 8px;">${title}</h4>
+      <div class="stat-list">
+        ${statItem('Ігор', stats.games)}
+        ${statItem('W', stats.wins)}
+        ${statItem('L', stats.losses)}
+        ${statItem('D', stats.draws)}
+        ${statItem('MVP', stats.mvps)}
+        ${statItem('MMR Δ (avg)', mmr)}
       </div>
-      <div class='muted' style='font-size:11px;'>@${p.apiNick}</div>
-    `;
+    </div>
+  `;
+}
 
-    const mmrDelta = p.mmrDelta === 0 ? '—' : (p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta));
+function renderTournamentBlock(p) {
+  const mmrDelta = p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta);
+
+  return `
+    <div class="info-card">
+      <h3>Статистика турніру</h3>
+      <div class="stat-list">
+        ${statItem('Ігор', p.games)}
+        ${statItem('W', p.wins)}
+        ${statItem('L', p.losses)}
+        ${statItem('D', p.draws)}
+        ${statItem('MVP', p.mvps)}
+        ${statItem('2 місце (DM)', p.secondPlaces)}
+        ${statItem('3 місце (DM)', p.thirdPlaces)}
+        ${statItem('DM раунди', p.dmRounds)}
+        ${statItem('KT очки', p.ktPoints)}
+        ${statItem('TDM рахунок', p.tdmScore)}
+        ${statItem('Impact', p.impact)}
+        ${statItem('MMR Δ', mmrDelta)}
+      </div>
+    </div>
+  `;
+}
 
-    tbody.insertAdjacentHTML(
-      'beforeend',
-      `<tr>
-         <td>${nickCell}</td>
-         <td>${teamLabel}</td>
-         <td>${p.games}</td>
-         <td>${p.wins}</td>
-         <td>${p.losses}</td>
-         <td>${p.draws}</td>
-         <td>${p.mvps}</td>
-         <td>${p.secondPlaces}</td>
-         <td>${p.thirdPlaces}</td>
-         <td>${p.impact}</td>
-         <td>${mmrDelta}</td>
-       </tr>`
-    );
-  });
+function ensurePlayerModal() {
+  const modal = document.getElementById('player-modal');
+  const content = document.getElementById('player-modal-content');
+  const closeBtn = modal?.querySelector('.player-modal__close');
+  return { modal, content, closeBtn };
+}
+
+async function openPlayerModal(player) {
+  const { modal, content, closeBtn } = ensurePlayerModal();
+  if (!modal || !content) return;
+
+  modal.classList.remove('hidden');
+  modal.setAttribute('aria-hidden', 'false');
+  content.innerHTML = '<p class="muted">Завантаження…</p>';
+
+  const seasonSnapshots = await loadSeasonSnapshots(player.apiNick, player.league);
+
+  const header = `
+    <div class="player-modal__header">
+      <div class="player-modal__avatar"><img src="${player.avatar || DEFAULT_AVATAR}" alt="${player.displayNick}" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'"></div>
+      <div class="player-modal__title">
+        <div class="player-name-row" style="font-size:1.1rem;">${player.displayNick} <span class="${rankClass(player.rank)}">${player.rank}</span></div>
+        <div class="modal-sub">@${player.apiNick} · ${player.teamName}</div>
+      </div>
+      <span class="tag">MMR: ${player.points}</span>
+    </div>
+  `;
+
+  const tournamentBlock = renderTournamentBlock(player);
+  const seasonBlocks = `
+    <div class="info-card">
+      <h3>Сезонна статистика</h3>
+      <div class="player-modal__grid">
+        ${renderSeasonSection('Цей сезон', seasonSnapshots.current)}
+        ${renderSeasonSection('Попередній сезон', seasonSnapshots.previous)}
+      </div>
+    </div>
+  `;
+
+  content.innerHTML = `${header}<div class="player-modal__grid">${tournamentBlock}${seasonBlocks}</div>`;
+
+  const onBackdrop = (e) => {
+    if (e.target === modal) hide();
+  };
+
+  const onKey = (e) => {
+    if (e.key === 'Escape') hide();
+  };
+
+  const hide = () => {
+    modal.classList.add('hidden');
+    modal.setAttribute('aria-hidden', 'true');
+    modal.removeEventListener('click', onBackdrop);
+    document.removeEventListener('keydown', onKey);
+    if (closeBtn) closeBtn.removeEventListener('click', hide);
+  };
+
+  modal.addEventListener('click', onBackdrop);
+  document.addEventListener('keydown', onKey);
+  if (closeBtn) closeBtn.addEventListener('click', hide);
 }
 
 // ---------- Матчі (DM / KT / TDM cards) ----------
 function renderModes() {
   const container = document.getElementById('matches-container');
   if (!container) return;
 
   container.innerHTML = '';
 
   // DM
   TOURNAMENT.modes.dm.forEach((game) => {
     container.insertAdjacentHTML(
       'beforeend',
       `<article class='bal__card match-card'>
          <h3>DM · всі команди</h3>
          <p>${game.results.map(resultIcon).join(' ')}</p>
          <p class='muted'>MVP: ${game.mvp.join(', ')}</p>
        </article>`
     );
   });
 
   // KT
   TOURNAMENT.modes.kt.forEach((game) => {
     const rounds = game.rounds
       .map(
-        (r, i) =>
-          `<div class='round-row'>Раунд ${i + 1}: <strong>${r.time}</strong> → ${TOURNAMENT.teams[r.winner].name} (+${r.points})</div>`
+        (r, i) => {
+          const points = ktPointsForTime(r.time);
+          return `<div class='round-row'>Раунд ${i + 1}: <strong>${r.time}</strong> → ${TOURNAMENT.teams[r.winner].name} (+${points})</div>`;
+        }
       )
       .join('');
 
     container.insertAdjacentHTML(
       'beforeend',
       `<article class='bal__card match-card'>
          <h3>KT · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
          ${rounds}
          <p class='muted'>MVP: ${game.mvp.join(', ')}</p>
        </article>`
     );
   });
 
   // TDM
   TOURNAMENT.modes.tdm.forEach((game) => {
     container.insertAdjacentHTML(
       'beforeend',
       `<article class='bal__card match-card'>
          <h3>TDM · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
          <p>${game.scores[game.teamA]} — ${game.scores[game.teamB]}</p>
        </article>`
     );
   });
 }
 
 // ---------- INIT ----------
 async function initPage() {
   const players = await loadPlayers(TOURNAMENT.league);
   const index = buildPlayerIndex(players);
 
   const totals = buildTournamentStats(index);
 
   renderHero(totals);
   renderTeams(totals.teamStats);
   renderPlayers(totals.playerStats);
   renderModes();
+  renderInfographic(totals.summary);
 }
 
 document.addEventListener('DOMContentLoaded', initPage);
diff --git a/styles/rank-badges.css b/styles/rank-badges.css
new file mode 100644
index 0000000000000000000000000000000000000000..7892569c5b3363d60015c3684d319039ebc58871
--- /dev/null
+++ b/styles/rank-badges.css
@@ -0,0 +1,100 @@
+:root {
+  --rank-s-color: #9c27b0;
+  --rank-a-color: #e91e63;
+  --rank-b-color: #ffb300;
+  --rank-c-color: #4fc3f7;
+  --rank-d-color: #777;
+  --rank-e-color: #666;
+  --rank-f-color: #444;
+}
+
+.rank-chip,
+.rank-badge {
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  padding: 6px 10px;
+  border-radius: 8px;
+  border: 2px solid var(--border, rgba(255, 255, 255, 0.15));
+  background: rgba(255, 255, 255, 0.05);
+  font-weight: 700;
+  color: #fff;
+  font-size: 0.9rem;
+}
+
+.rank-badge {
+  padding: 4px 8px;
+  border-radius: 8px;
+}
+
+.rank-chip.rank-xs,
+.rank-badge.rank-xs {
+  font-size: 0.8rem;
+  padding: 4px 8px;
+}
+
+.rank-chip.rank-s,
+.rank-badge.rank-s,
+.rank-chip.rank-S,
+.rank-badge.rank-S {
+  border-color: var(--rank-s-color);
+  background: color-mix(in srgb, var(--rank-s-color) 15%, transparent);
+}
+
+.rank-chip.rank-a,
+.rank-badge.rank-a,
+.rank-chip.rank-A,
+.rank-badge.rank-A {
+  border-color: var(--rank-a-color);
+  background: color-mix(in srgb, var(--rank-a-color) 15%, transparent);
+}
+
+.rank-chip.rank-b,
+.rank-badge.rank-b,
+.rank-chip.rank-B,
+.rank-badge.rank-B {
+  border-color: var(--rank-b-color);
+  background: color-mix(in srgb, var(--rank-b-color) 15%, transparent);
+}
+
+.rank-chip.rank-c,
+.rank-badge.rank-c,
+.rank-chip.rank-C,
+.rank-badge.rank-C {
+  border-color: var(--rank-c-color);
+  background: color-mix(in srgb, var(--rank-c-color) 15%, transparent);
+}
+
+.rank-chip.rank-d,
+.rank-badge.rank-d,
+.rank-chip.rank-D,
+.rank-badge.rank-D {
+  border-color: var(--rank-d-color);
+  background: color-mix(in srgb, var(--rank-d-color) 20%, transparent);
+}
+
+.rank-chip.rank-e,
+.rank-badge.rank-e,
+.rank-chip.rank-E,
+.rank-badge.rank-E {
+  border-color: var(--rank-e-color);
+  background: color-mix(in srgb, var(--rank-e-color) 20%, transparent);
+}
+
+.rank-chip.rank-f,
+.rank-badge.rank-f,
+.rank-chip.rank-F,
+.rank-badge.rank-F {
+  border-color: var(--rank-f-color);
+  background: color-mix(in srgb, var(--rank-f-color) 20%, transparent);
+}
+
+.rank-chip.team--green,
+.rank-badge.team--green,
+.rank-chip.team--blue,
+.rank-badge.team--blue,
+.rank-chip.team--red,
+.rank-badge.team--red {
+  border-color: color-mix(in srgb, var(--team-color, #8f9bbd) 50%, rgba(255, 255, 255, 0.15));
+  color: #fff;
+}
diff --git a/tournament.html b/tournament.html
index 0d4174a67a8b9efcbbac9a86ee304d9a5054ea77..ff4863058c465aab2e02fa7d8e3c33b58dec6212 100644
--- a/tournament.html
+++ b/tournament.html
@@ -1,39 +1,43 @@
 <!DOCTYPE html>
 <html lang="uk">
 <head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <title>Турнір</title>
   <link rel="stylesheet" href="balancer.css">
   <link rel="stylesheet" href="styles/balance.css">
+  <link rel="stylesheet" href="styles/rank-badges.css">
   <style>
     :root {
       --green: #2ecc71;
       --red: #e74c3c;
       --yellow: #f1c40f;
       --blue: #3498db;
+      --team-green: #2ecc71;
+      --team-blue: #3498db;
+      --team-red: #e74c3c;
       --gray: #2d2f36;
       --card: #1f2229;
     }
     body.bal {
       background: #0e0f14;
       color: #f3f4f6;
     }
     .bal__card {
       background: var(--card);
       border: 1px solid #2f333c;
       box-shadow: 0 6px 18px rgba(0,0,0,0.35);
     }
     #tournament-view {
       display: flex;
       flex-direction: column;
       gap: 16px;
       padding: 16px;
     }
     .header-card h1 {
       margin: 0 0 4px;
       color: #fff;
     }
     .muted {
       color: #a2a5ad;
       margin: 0;
@@ -74,83 +78,146 @@
     .stat-value { color: #fff; font-size: 20px; font-weight: 700; margin: 0; }
 
     h2.section-title {
       margin: 0 0 8px;
       color: #fff;
       display: flex;
       align-items: center;
       gap: 8px;
     }
     .badge {
       display: inline-flex;
       align-items: center;
       padding: 2px 8px;
       border-radius: 999px;
       font-size: 12px;
       text-transform: uppercase;
       letter-spacing: 0.3px;
       font-weight: 700;
     }
     .badge.mode-tr { background: rgba(52,152,219,0.18); color: var(--blue); border: 1px solid rgba(52,152,219,0.45); }
     .badge.mode-dm { background: rgba(241,196,15,0.18); color: var(--yellow); border: 1px solid rgba(241,196,15,0.45); }
     .badge.mode-kt { background: rgba(231,76,60,0.18); color: var(--red); border: 1px solid rgba(231,76,60,0.45); }
     .badge.status { background: rgba(19,179,107,0.16); color: var(--green); border: 1px solid rgba(19,179,107,0.5); }
 
     .table-responsive { overflow-x: auto; }
-    table { width: 100%; border-collapse: collapse; }
-    th, td { padding: 10px 12px; text-align: left; }
-    th { color: #c8ccd6; font-weight: 700; background: #141721; position: sticky; top: 0; }
+    table { width: 100%; border-collapse: collapse; min-width: 720px; }
+    th, td { padding: 10px 12px; text-align: left; vertical-align: middle; }
+    th { color: #c8ccd6; font-weight: 700; background: #141721; position: sticky; top: 0; z-index: 2; }
     tbody tr:nth-child(odd) { background: #161924; }
     tbody tr:nth-child(even) { background: #12141c; }
     tbody tr:hover { background: #1f2433; }
 
+    .team-green-row { border-left: 4px solid var(--green); box-shadow: inset 4px 0 0 color-mix(in srgb, var(--green) 50%, transparent); background: rgba(46, 204, 113, 0.04); }
+    .team-blue-row { border-left: 4px solid var(--blue); box-shadow: inset 4px 0 0 color-mix(in srgb, var(--blue) 50%, transparent); background: rgba(52, 152, 219, 0.04); }
+    .team-red-row { border-left: 4px solid var(--red); box-shadow: inset 4px 0 0 color-mix(in srgb, var(--red) 50%, transparent); background: rgba(231, 76, 60, 0.04); }
+    .player-row { cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
+    .player-row:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.35); }
+
+    .team-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #fff; font-weight: 700; letter-spacing: 0.2px; }
+    .team-chip__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--chip-color, #888); box-shadow: 0 0 10px color-mix(in srgb, var(--chip-color, #888) 60%, transparent); }
+    .team-chip--green { --chip-color: var(--team-green); }
+    .team-chip--blue { --chip-color: var(--team-blue); }
+    .team-chip--red { --chip-color: var(--team-red); }
+
+    .player-identity { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; }
+    .player-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.08); background: #0f1118; }
+    .player-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
+    .player-name-block { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
+    .player-name-row { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #fff; }
+    .player-meta { color: #9ea2ae; font-size: 12px; }
+
+    .player-modal { position: fixed; inset: 0; background: rgba(3, 5, 12, 0.7); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1200; }
+    .player-modal.hidden { display: none; }
+    .player-modal__card { background: #0f1118; border: 1px solid #202432; box-shadow: 0 16px 42px rgba(0,0,0,0.5); border-radius: 14px; width: min(900px, 100%); max-height: 90vh; overflow: auto; position: relative; padding: 16px; }
+    .player-modal__close { position: absolute; top: 10px; right: 12px; border: none; background: none; color: #fff; font-size: 22px; cursor: pointer; }
+    .player-modal__header { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; margin-bottom: 14px; }
+    .player-modal__avatar { width: 72px; height: 72px; border-radius: 16px; overflow: hidden; border: 2px solid rgba(255,255,255,0.08); }
+    .player-modal__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
+    .player-modal__title { display: flex; flex-direction: column; gap: 4px; }
+    .modal-sub { color: #9ea2ae; font-size: 13px; }
+    .tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #fff; font-weight: 700; }
+    .player-modal__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
+    .info-card { background: #0b0d14; border: 1px solid #1d202c; border-radius: 10px; padding: 12px; display: grid; gap: 10px; }
+    .info-card h3 { margin: 0; font-size: 15px; }
+    .stat-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
+    .stat-item { border: 1px solid #202432; border-radius: 8px; padding: 8px 10px; background: rgba(255,255,255,0.02); }
+    .stat-item .label { color: #9ea2ae; font-size: 12px; display: block; margin-bottom: 4px; }
+    .stat-item .value { color: #fff; font-weight: 700; font-size: 16px; }
+    .empty-note { color: #9ea2ae; font-size: 13px; }
+
+    .table-responsive::-webkit-scrollbar { height: 10px; }
+    .table-responsive::-webkit-scrollbar-thumb { background: #333a4a; border-radius: 8px; }
+
     .match-section { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
     .match-card {
       border: 1px solid #2b2f3b;
       border-radius: 12px;
       padding: 12px;
       background: #131621;
       display: grid;
       gap: 6px;
     }
     .match-title { font-weight: 700; color: #fff; margin: 0; }
     .match-meta { color: #9ea2ae; margin: 0; }
     .result-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; color: #e5e7eb; }
     .result-line strong { color: #fff; }
     .mmr-diff { color: var(--green); font-weight: 700; }
     .mmr-negative { color: var(--red); }
 
     .hidden { display: none !important; }
     #tournament-selector ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
     #tournament-selector li { display: flex; align-items: center; justify-content: space-between; background: #141721; padding: 10px 12px; border-radius: 10px; border: 1px solid #202432; }
     #tournament-selector .t-info { display: flex; flex-direction: column; gap: 2px; }
     #tournament-selector .t-name { font-weight: 700; color: #fff; }
     #tournament-selector .t-meta { color: #9ea2ae; font-size: 13px; }
 
+    .infographic-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 10px; }
+    .info-chip { background: linear-gradient(135deg, rgba(19, 179, 107, 0.08), rgba(52, 152, 219, 0.08)); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px; box-shadow: 0 0 20px rgba(19,179,107,0.08), 0 0 24px rgba(52,152,219,0.06); }
+    .info-chip__label { margin: 0 0 4px; color: #9ea2ae; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
+    .info-chip__value { margin: 0; color: #fff; font-weight: 800; font-size: 18px; text-shadow: 0 0 8px rgba(0,255,153,0.3); }
+
+    .award-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 10px; }
+    .award-card { display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 12px; border-radius: 12px; background: radial-gradient(circle at 20% 20%, rgba(52,152,219,0.08), transparent 45%), #0f131c; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 0 24px rgba(52,152,219,0.06); }
+    .award-card__icon { font-size: 24px; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05); }
+    .award-card__title { margin: 0; color: #9ea2ae; font-size: 12px; letter-spacing: 0.3px; text-transform: uppercase; }
+    .award-card__value { margin: 4px 0; color: #fff; font-weight: 800; font-size: 18px; }
+    .award-card__meta { margin: 0; color: #8fb8ff; font-size: 13px; }
+
+    .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
+    .score-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; background: linear-gradient(135deg, rgba(19,179,107,0.06), rgba(52,152,219,0.08)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 18px rgba(0,0,0,0.45); }
+    .score-card__stats { color: #c6d4ff; font-size: 13px; margin: 6px 0 4px; }
+    .score-card__total { color: #fff; font-weight: 900; font-size: 20px; text-shadow: 0 0 12px rgba(0,255,153,0.25); }
+    .score-card__meta { color: #9ea2ae; font-size: 12px; }
+
     @media (max-width: 720px) {
       #tournament-view { padding: 12px; }
-      th, td { padding: 8px; }
+      th, td { padding: 10px; }
+      table { min-width: 640px; }
+      .player-modal__card { width: 100%; }
+      .player-modal__header { grid-template-columns: auto 1fr; }
+      .player-modal__close { top: 6px; right: 8px; }
     }
   </style>
 </head>
 <body class="bal" data-app-mode="tournament">
   <main class="bal__main" id="tournament-view">
     <header class="bal__card header-card">
       <h1 id="tournament-title">Турнір</h1>
       <p id="tournament-meta" class="muted"></p>
       <div class="actions">
         <button id="refresh-tournament" class="btn">Оновити</button>
         <button id="back-to-selector" class="btn secondary hidden">Список турнірів</button>
       </div>
       <div class="stats-grid" id="tournament-stats"></div>
     </header>
 
     <section class="bal__card hidden" id="tournament-selector">
       <h2 class="section-title">Обрати турнір</h2>
       <div id="tournaments-empty" class="muted hidden">Немає доступних турнірів</div>
       <ul id="tournament-list"></ul>
     </section>
 
     <section class="bal__card" id="tournament-teams-section" data-requires-id="true">
       <h2 class="section-title">Команди</h2>
       <div class="table-responsive">
         <table id="teams-table">
@@ -176,36 +243,47 @@
         <table id="players-table">
           <thead>
             <tr>
               <th>Нік</th>
               <th>Команда</th>
               <th>Ігор</th>
               <th>W</th>
               <th>L</th>
               <th>D</th>
               <th>MVP</th>
               <th>2 місце</th>
               <th>3 місце</th>
               <th>Impact</th>
               <th>MMR Δ</th>
             </tr>
           </thead>
           <tbody></tbody>
         </table>
       </div>
     </section>
 
     <section class="bal__card" id="tournament-games-section" data-requires-id="true">
       <h2 class="section-title">Матчі</h2>
       <div id="matches-container"></div>
     </section>
+
+    <section class="bal__card" id="tournament-infographic-section" data-requires-id="true">
+      <h2 class="section-title">Інфографіка турніру</h2>
+      <div class="infographic-grid" id="tournament-infographic"></div>
+    </section>
+    <div id="player-modal" class="player-modal hidden" aria-hidden="true">
+      <div class="player-modal__card" role="dialog" aria-modal="true">
+        <button class="player-modal__close" aria-label="Закрити">×</button>
+        <div id="player-modal-content"></div>
+      </div>
+    </div>
   </main>
 
   <script type="module" src="scripts/config.js?v=2025-09-19-balance-hotfix-1"></script>
   <script type="module" src="scripts/logger.js?v=2025-09-19-balance-hotfix-1"></script>
   <script type="module" src="scripts/api.js?v=2025-09-19-balance-hotfix-1"></script>
   <script type="module" src="scripts/tournament.js"></script>
   <script type="module" src="scripts/rankUtils.js"></script>
 
 
 </body>
 </html>
 
EOF
)