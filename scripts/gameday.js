import { log } from './logger.js?v=2025-09-19-avatars-2';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js?v=2025-09-19-avatars-2';
import { getPdfLinks, fetchOnce, CSV_URLS, avatarNickKey } from "./api.js?v=2025-09-19-avatars-2";
import { rankLetterForPoints } from './rankUtils.js?v=2025-09-19-avatars-2';
import { renderAllAvatars, reloadAvatars } from './avatars.client.js';
(function () {
  const CSV_TTL = 60 * 1000;


  const alias = {
    "Zavodchanyn": "Romario",
    "Romario": "Zavodchanyn",
    "Mariko": "Gidora",
    "Timabuilding": "Бойбуд"
  };

  const MVP_FIELD_GROUPS = [
    ['MVP', 'Mvp', 'mvp', 'MVP1', 'mvp1', 'MVP 1', 'mvp 1'],
    ['MVP2', 'mvp2', 'MVP 2', 'mvp 2', 'Silver MVP', 'MVP Silver'],
    ['MVP3', 'mvp3', 'MVP 3', 'mvp 3', 'Bronze MVP', 'MVP Bronze'],
  ];

  const RANK_SEARCH_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
  const MVP_BONUS = {1: 12, 2: 7, 3: 3};
  const WIN_BONUS = 20;
  const TEAM_KEYS = ['Team1', 'Team2', 'Team3', 'Team4'];

  const leagueSel = document.getElementById('league');
  const dateInput = document.getElementById('date');
  const loadBtn   = document.getElementById('loadBtn');
  const playersTb = document.getElementById('players');
  const matchesTb = document.getElementById('matches');
  const fullscreenBtn = document.getElementById('fullscreen');
  const summarySection = document.getElementById('summarySection');
  const mvpSection = document.getElementById('mvpSection');
  const summaryMatchesEl = document.getElementById('summaryMatches');
  const summaryPlayersEl = document.getElementById('summaryPlayers');
  const summaryPointsEl = document.getElementById('summaryPoints');
  const summaryWinsEl = document.getElementById('summaryWins');
  const summaryMvp1El = document.getElementById('summaryMvp1');
  const summaryMvp2El = document.getElementById('summaryMvp2');
  const summaryMvp3El = document.getElementById('summaryMvp3');
  const topDeltaList = document.getElementById('topDeltaList');
  const topWinsList = document.getElementById('topWinsList');

  leagueSel.addEventListener('change', loadData);
  dateInput.addEventListener('change', loadData);
  if(loadBtn) loadBtn.addEventListener('click', loadData);
  document.addEventListener('DOMContentLoaded', () => {
    dateInput.value = new Date().toISOString().slice(0,10);
    loadData();
  });
  window.addEventListener('storage', e => {
    if(e.key === 'gamedayRefresh') loadData();
    if(e.key === 'avatarRefresh') reloadAvatars();
  });
  if(fullscreenBtn){
    fullscreenBtn.addEventListener('click', () => {
      if(!document.fullscreenElement){
        document.documentElement.requestFullscreen();
      }else{
        document.exitFullscreen();
      }
    });
  }

  function normName(n){ return alias[n] || n; }

  function partPoints(rank){
    return {S:-14,A:-12,B:-10,C:-8,D:-6,E:-4,F:0}[rank] || 0;
  }

  function toNumber(v){
    if(v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.+-]/g,''));
    return isNaN(n) ? 0 : n;
  }

  function normalizeHeaderKey(k){
    return String(k || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  const RANKING_FIELD_ALIASES = {
    points: ['points','pts','totalpoints','currentpoints'],
    wins: ['wins','w','totalwins'],
    delta: ['delta','daydelta','Δ','change'],
    games: ['games','g','totalgames','matches'],
    mvp1: ['mvp1','mvp','mvpgold','goldmvp','mvp_gold'],
    mvp2: ['mvp2','mvpsilver','silvermvp','mvp_silver'],
    mvp3: ['mvp3','mvpbronze','bronzemvp','mvp_bronze'],
  };

  function pickField(row, aliases){
    const keys = Object.keys(row || {});
    const map = {};
    keys.forEach(k=>{ map[normalizeHeaderKey(k)] = k; });
    for(const alias of aliases){
      const norm = normalizeHeaderKey(alias);
      if(norm && map[norm] !== undefined){
        return row[map[norm]];
      }
    }
    return undefined;
  }

  function cloneStateMap(src){
    const out = {};
    Object.keys(src || {}).forEach(nick => {
      out[nick] = {...src[nick]};
    });
    return out;
  }

  function ensurePlayerState(map, nick){
    if(!map[nick]){
      map[nick] = { points: 0, wins: 0, delta: 0, games: 0, mvp1: 0, mvp2: 0, mvp3: 0 };
    }else{
      ['points','wins','delta','games','mvp1','mvp2','mvp3'].forEach(key=>{
        map[nick][key] = toNumber(map[nick][key]);
      });
    }
    return map[nick];
  }

  function parsePlayersField(raw){
    return String(raw || '')
      .replace(/\r?\n/g, ',')
      .split(/[;,]/)
      .map(s=>normName(s.trim()))
      .filter(Boolean);
  }

  function parsePenalties(raw){
    const res = {};
    String(raw || '')
      .split(/[;,]/)
      .map(s=>s.trim())
      .filter(Boolean)
      .forEach(item => {
        const [nickPart, valuePart] = item.split(':');
        if(!nickPart || valuePart === undefined) return;
        const nick = normName(nickPart.trim());
        const val = parseInt(valuePart, 10);
        if(!nick || isNaN(val)) return;
        res[nick] = val;
      });
    return res;
  }

  function parseGameRow(row){
    const teams = TEAM_KEYS.map((key, idx) => {
      const members = parsePlayersField(row[key]);
      return {
        key: key.toLowerCase(),
        label: key,
        members,
        order: idx + 1,
      };
    }).filter(t => t.members.length > 0);

    const winnerRaw = String(row.Winner || row.winner || '').trim().toLowerCase();
    let winnerKey = '';
    if(['tie','draw','нічия','ничья'].includes(winnerRaw)){
      winnerKey = 'tie';
    }else if(winnerRaw){
      const normalized = winnerRaw.replace(/\s+/g,'');
      const found = teams.find(t => normalized.includes(String(t.order)) || normalized === t.key.toLowerCase());
      if(found){
        winnerKey = found.key;
      }else{
        if(normalized === 'team1' || normalized === '1'){ winnerKey = 'team1'; }
        else if(normalized === 'team2' || normalized === '2'){ winnerKey = 'team2'; }
        else if(normalized === 'team3' || normalized === '3'){ winnerKey = 'team3'; }
        else if(normalized === 'team4' || normalized === '4'){ winnerKey = 'team4'; }
      }
    }

    const penalties = parsePenalties(row.penalties || row.Penalties);

    const mvpPlacements = {1: [], 2: [], 3: []};
    MVP_FIELD_GROUPS.forEach((headers, idx) => {
      const place = idx + 1;
      headers.forEach(h => {
        const raw = row[h];
        if(!raw) return;
        String(raw)
          .split(/[;,]/)
          .map(s => normName(s.trim()))
          .filter(Boolean)
          .forEach(nick => {
            if(!mvpPlacements[place].includes(nick)){
              mvpPlacements[place].push(nick);
            }
          });
      });
    });

    let score1 = parseInt(row.Score1, 10);
    let score2 = parseInt(row.Score2, 10);
    if(isNaN(score1) || isNaN(score2)){
      const mScore = String(row.Series || row.series || '').match(/(\d+)\D+(\d+)/);
      if(mScore){
        score1 = parseInt(mScore[1], 10);
        score2 = parseInt(mScore[2], 10);
      }
    }

    const timestampFields = ['Timestamp', 'timestamp', 'Date', 'date'];
    let tsRaw = '';
    let tsDate = null;
    let tsIso = '';

    for (const field of timestampFields) {
      if (!(field in (row || {}))) continue;
      const value = row[field];
      if (value === undefined || value === null) continue;
      const trimmed = String(value).trim();
      if (!trimmed) continue;

      const parsedIso = parseDate(trimmed);
      const parsedFromRaw = new Date(trimmed);
      const rawIsValid = parsedFromRaw && !isNaN(parsedFromRaw);

      if (parsedIso || rawIsValid) {
        tsRaw = trimmed;
        if (parsedIso) {
          tsIso = parsedIso;
          const isoDate = new Date(parsedIso);
          if (!isNaN(isoDate)) {
            tsDate = isoDate;
          } else if (rawIsValid) {
            tsDate = parsedFromRaw;
          }
        } else if (rawIsValid) {
          tsDate = parsedFromRaw;
          tsIso = parsedFromRaw.toISOString().slice(0,10);
        }
        break;
      }
    }

    return {
      id: row.ID || row.Id || row.id || '',
      rawTimestamp: tsRaw,
      timestamp: tsDate && !isNaN(tsDate) ? tsDate : null,
      date: tsIso,
      teams,
      winnerKey,
      penalties,
      mvpPlacements,
      score1: isNaN(score1) ? null : score1,
      score2: isNaN(score2) ? null : score2,
    };
  }

  function computeKnownBonus(nick, match, teamByPlayer){
    const teamKey = teamByPlayer[nick];
    const isWinner = match.winnerKey && match.winnerKey !== 'tie' && match.winnerKey === teamKey;
    const winBonus = isWinner ? WIN_BONUS : 0;
    let mvpPlace = 0;
    for(let place = 1; place <= 3; place++){
      if(match.mvpPlacements[place]?.includes(nick)){
        mvpPlace = place;
        break;
      }
    }
    const mvpBonus = MVP_BONUS[mvpPlace] || 0;
    const penalty = match.penalties[nick] || 0;
    return { winBonus, mvpBonus, penalty, mvpPlace };
  }

  function rewindMatch(stateMap, match, options = {}){
    const { collectStats = false, statsMap = null, matchesList = null, pdfLinks = null, snapshotMap = null } = options;
    const teamByPlayer = {};
    match.teams.forEach(team => {
      team.members.forEach(nick => {
        if(!nick) return;
        ensurePlayerState(stateMap, nick);
        teamByPlayer[nick] = team.key;
      });
    });

    const participants = Object.keys(teamByPlayer);
    if(participants.length === 0) return;

    const perPlayer = {};
    participants.forEach(nick => {
      const state = ensurePlayerState(stateMap, nick);
      const afterPoints = toNumber(state.points);
      const { winBonus, mvpBonus, penalty, mvpPlace } = computeKnownBonus(nick, match, teamByPlayer);
      const known = winBonus + mvpBonus + penalty;

      let chosenRank = '';
      let partScore = 0;
      let beforePoints = afterPoints;
      for(const letter of RANK_SEARCH_ORDER){
        const pScore = partPoints(letter);
        const candidate = afterPoints - known - pScore;
        const derived = rankLetterForPoints(candidate);
        if(derived === letter){
          chosenRank = letter;
          partScore = pScore;
          beforePoints = candidate;
          break;
        }
      }
      if(!chosenRank){
        partScore = partPoints(rankLetterForPoints(afterPoints));
        beforePoints = afterPoints - known - partScore;
        chosenRank = rankLetterForPoints(beforePoints);
      }

      const delta = afterPoints - beforePoints;

      perPlayer[nick] = {
        nick,
        beforePoints,
        afterPoints,
        delta,
        rankBefore: chosenRank,
        winBonus,
        mvpBonus,
        penalty,
        mvpPlace,
        teamKey: teamByPlayer[nick],
      };

      state.points = beforePoints;
      if(winBonus > 0 && state.wins !== undefined){
        state.wins = Math.max(0, toNumber(state.wins) - 1);
      }
      if(state.games !== undefined){
        state.games = Math.max(0, toNumber(state.games) - 1);
      }
      if(mvpPlace === 1 && state.mvp1 !== undefined){
        state.mvp1 = Math.max(0, toNumber(state.mvp1) - 1);
      }
      if(mvpPlace === 2 && state.mvp2 !== undefined){
        state.mvp2 = Math.max(0, toNumber(state.mvp2) - 1);
      }
      if(mvpPlace === 3 && state.mvp3 !== undefined){
        state.mvp3 = Math.max(0, toNumber(state.mvp3) - 1);
      }
    });

    if(snapshotMap){
      participants.forEach(nick => {
        if(!snapshotMap[nick]){
          snapshotMap[nick] = { points: perPlayer[nick].afterPoints, wins: 0, delta: 0, games: 0, mvp1: 0, mvp2: 0, mvp3: 0 };
        }else if(snapshotMap[nick].points === undefined){
          snapshotMap[nick].points = perPlayer[nick].afterPoints;
        }
      });
    }

    if(!collectStats) return;

    participants.forEach(nick => {
      const info = perPlayer[nick];
      const stats = statsMap ? (statsMap[nick] = statsMap[nick] || { delta: 0, wins: 0, games: 0, mvp1: 0, mvp2: 0, mvp3: 0 }) : null;
      if(stats){
        stats.delta += info.delta;
        stats.games += 1;
        if(info.winBonus > 0) stats.wins += 1;
        if(info.mvpPlace === 1) stats.mvp1 += 1;
        if(info.mvpPlace === 2) stats.mvp2 += 1;
        if(info.mvpPlace === 3) stats.mvp3 += 1;
      }
    });

    if(matchesList){
      const byTeam = {};
      match.teams.forEach(team => {
        const players = team.members.map(nick => {
          const info = perPlayer[nick];
          if(!info) return null;
          return {
            nick,
            delta: info.delta,
            rank: info.rankBefore,
            beforePoints: info.beforePoints,
            afterPoints: info.afterPoints,
          };
        }).filter(Boolean);
        byTeam[team.key] = {
          key: team.key,
          label: team.label,
          order: team.order,
          players,
          totalBefore: players.reduce((sum,p)=>sum + p.beforePoints,0),
        };
      });

      const mvpInfo = [1,2,3].map(place => {
        return match.mvpPlacements[place].map(nick => {
          const info = perPlayer[nick];
          return {
            nick,
            rank: info ? rankLetterForPoints(info.beforePoints) : rankLetterForPoints((ensurePlayerState(stateMap, nick).points || 0)),
            place,
          };
        });
      });

      matchesList.push({
        id: match.id,
        timestamp: match.rawTimestamp,
        date: match.date,
        winnerKey: match.winnerKey,
        score1: match.score1,
        score2: match.score2,
        teams: byTeam,
        teamOrder: match.teams.map(t => t.key),
        mvp: mvpInfo,
        penalties: match.penalties,
        pdfUrl: pdfLinks ? pdfLinks[match.id] : undefined,
      });
    }
  }

  function parseDate(ts) {
    if (!ts) return '';
    const m = ts.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) {
      const [_, d, mon, y] = m;
      return `${y}-${mon.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const d = new Date(ts);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }

  if (typeof globalThis !== 'undefined' && globalThis.__gamedayTestHook) {
    globalThis.__gamedayTestHook.parseGameRow = parseGameRow;
    globalThis.__gamedayTestHook.parseDate = parseDate;
  }

  function vpIcons(n){
    return '★'.repeat(n);
  }

  function formatScore(a,b){
    if(isNaN(a) || isNaN(b)) return '-';
    return `${vpIcons(a)} - ${vpIcons(b)}`;
  }

  function toggleHidden(el, hidden){
    if(!el) return;
    el.classList.toggle('hidden', hidden);
  }

  function formatSigned(value){
    const num = toNumber(value);
    if(num > 0) return `+${num}`;
    return `${num}`;
  }

  function populateList(listEl, items, formatter){
    if(!listEl) return;
    listEl.innerHTML = '';
    if(!items.length){
      const li = document.createElement('li');
      li.className = 'summary-empty';
      li.textContent = 'Немає даних';
      listEl.appendChild(li);
      return;
    }
    items.forEach((item, idx) => {
      const { label, value } = formatter(item, idx);
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'summary-player';
      nameSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'summary-badge';
      valueSpan.textContent = value;
      li.appendChild(nameSpan);
      li.appendChild(valueSpan);
      listEl.appendChild(li);
    });
  }

  function renderDaySummary(dayStats, matches){
    if(!summarySection || !mvpSection) return;
    const entries = Object.entries(dayStats || {});
    const totals = entries.reduce((acc, [, stats]) => {
      acc.delta += toNumber(stats.delta);
      acc.wins += toNumber(stats.wins);
      acc.games += toNumber(stats.games);
      acc.mvp1 += toNumber(stats.mvp1);
      acc.mvp2 += toNumber(stats.mvp2);
      acc.mvp3 += toNumber(stats.mvp3);
      return acc;
    }, { delta: 0, wins: 0, games: 0, mvp1: 0, mvp2: 0, mvp3: 0 });
    totals.matches = matches.length;
    totals.players = entries.length;

    const hasMatches = totals.matches > 0;
    toggleHidden(summarySection, !hasMatches);
    toggleHidden(mvpSection, !hasMatches);

    if(!hasMatches){
      if(summaryMatchesEl) summaryMatchesEl.textContent = '0';
      if(summaryPlayersEl) summaryPlayersEl.textContent = '0';
      if(summaryPointsEl) summaryPointsEl.textContent = '0';
      if(summaryWinsEl) summaryWinsEl.textContent = '0';
      if(summaryMvp1El) summaryMvp1El.textContent = '0';
      if(summaryMvp2El) summaryMvp2El.textContent = '0';
      if(summaryMvp3El) summaryMvp3El.textContent = '0';
      if(topDeltaList) topDeltaList.innerHTML = '';
      if(topWinsList) topWinsList.innerHTML = '';
      return;
    }

    if(summaryMatchesEl) summaryMatchesEl.textContent = `${totals.matches}`;
    if(summaryPlayersEl) summaryPlayersEl.textContent = `${Math.max(totals.players, 0)}`;
    if(summaryPointsEl) summaryPointsEl.textContent = formatSigned(totals.delta);
    if(summaryWinsEl) summaryWinsEl.textContent = `${totals.wins}`;
    if(summaryMvp1El) summaryMvp1El.textContent = `${totals.mvp1}`;
    if(summaryMvp2El) summaryMvp2El.textContent = `${totals.mvp2}`;
    if(summaryMvp3El) summaryMvp3El.textContent = `${totals.mvp3}`;

    const topDelta = entries
      .slice()
      .sort((a,b)=>toNumber(b[1].delta) - toNumber(a[1].delta))
      .slice(0,3);
    const topWins = entries
      .slice()
      .sort((a,b)=>{
        const winDiff = toNumber(b[1].wins) - toNumber(a[1].wins);
        if(winDiff) return winDiff;
        const gameDiff = toNumber(b[1].games) - toNumber(a[1].games);
        if(gameDiff) return gameDiff;
        return toNumber(b[1].delta) - toNumber(a[1].delta);
      })
      .slice(0,3);

    populateList(topDeltaList, topDelta, ([nick, stats], idx) => ({
      label: `${idx + 1}. ${nick}`,
      value: `${formatSigned(stats.delta)} оч.`,
    }));
    populateList(topWinsList, topWins, ([nick, stats], idx) => ({
      label: `${idx + 1}. ${nick}`,
      value: `${toNumber(stats.wins)} / ${toNumber(stats.games)} ігор`,
    }));
  }

  function normalizeLeagueForFilter(v){
    return String(v || '').toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
  }

  async function loadData(){
    if(!dateInput.value) return; // require date
    const rURL = CSV_URLS[leagueSel.value].ranking;
    const gURL = CSV_URLS[leagueSel.value].games;
    let rText, gText;
    try {
      [rText, gText] = await Promise.all([
        fetchOnce(rURL, CSV_TTL),
        fetchOnce(gURL, CSV_TTL),
      ]);
    }catch(err){
      playersTb.innerHTML = '';
      matchesTb.innerHTML = '';
      renderDaySummary({}, []);
      log('[ranking]', err);
      const msg = 'Failed to load gameday data. Please try again later.';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
      return;
    }
    const ranking = Papa.parse(rText,{header:true,skipEmptyLines:true}).data;
    const games   = Papa.parse(gText,{header:true,skipEmptyLines:true}).data;
    let pdfLinks = {};
    try{
      pdfLinks = await getPdfLinks({ league: leagueSel.value, date: dateInput.value });
    }catch(err){
      log('[ranking]', err);
    }

    const baseState = {};
    ranking.forEach(row => {
      const name = normName(String(row.Nickname || row.nickname || '').trim());
      if(!name) return;
      const entry = {
        points: toNumber(pickField(row, RANKING_FIELD_ALIASES.points) ?? row.Points),
        wins: toNumber(pickField(row, RANKING_FIELD_ALIASES.wins) ?? row.Wins),
        delta: toNumber(pickField(row, RANKING_FIELD_ALIASES.delta) ?? row.Delta ?? row["Δ"]),
        games: toNumber(pickField(row, RANKING_FIELD_ALIASES.games) ?? row.Games),
        mvp1: toNumber(pickField(row, RANKING_FIELD_ALIASES.mvp1) ?? row.MVP ?? row.MVP1),
        mvp2: toNumber(pickField(row, RANKING_FIELD_ALIASES.mvp2) ?? row.MVP2),
        mvp3: toNumber(pickField(row, RANKING_FIELD_ALIASES.mvp3) ?? row.MVP3),
      };
      baseState[name] = entry;
    });

    const parsedGames = games
      .filter(g => normalizeLeagueForFilter(g.League) === leagueSel.value)
      .map(parseGameRow)
      .filter(g => g.timestamp || g.date);

    const getSortTime = (match) => {
      if(match.timestamp) return match.timestamp.getTime();
      if(match.date){
        const parsed = new Date(match.date);
        if(!isNaN(parsed)) return parsed.getTime();
      }
      return null;
    };

    parsedGames.sort((a,b)=>{
      const aTime = getSortTime(a);
      const bTime = getSortTime(b);
      if(aTime !== null && bTime !== null){
        const diff = bTime - aTime;
        if(diff) return diff;
      }else if(bTime !== null){
        return 1;
      }else if(aTime !== null){
        return -1;
      }
      return ((+b.id || 0) - (+a.id || 0));
    });

    const selectedDate = dateInput.value;
    const workingState = cloneStateMap(baseState);
    const dayStats = {};
    const preparedMatches = [];
    let stateAtDayEnd = null;

    for(const match of parsedGames){
      if(!match.date){
        continue;
      }
      if(match.date > selectedDate){
        rewindMatch(workingState, match, { collectStats: false });
        continue;
      }

      if(stateAtDayEnd === null){
        stateAtDayEnd = cloneStateMap(workingState);
      }

      if(match.date === selectedDate){
        rewindMatch(workingState, match, { collectStats: true, statsMap: dayStats, matchesList: preparedMatches, pdfLinks, snapshotMap: stateAtDayEnd });
        continue;
      }
      break;
    }

    if(stateAtDayEnd === null){
      stateAtDayEnd = cloneStateMap(workingState);
    }

    const stateBeforeDay = cloneStateMap(workingState);
    const allPlayers = Array.from(new Set([
      ...Object.keys(stateBeforeDay),
      ...Object.keys(stateAtDayEnd),
      ...Object.keys(dayStats),
    ]));

    const prevRankMap = {};
    const currRankMap = {};
    allPlayers.slice()
      .sort((a,b)=>toNumber(stateBeforeDay[b]?.points) - toNumber(stateBeforeDay[a]?.points))
      .forEach((nick, idx)=>{ prevRankMap[nick] = idx + 1; });
    allPlayers.slice()
      .sort((a,b)=>toNumber(stateAtDayEnd[b]?.points) - toNumber(stateAtDayEnd[a]?.points))
      .forEach((nick, idx)=>{ currRankMap[nick] = idx + 1; });

    const playersList = Object.keys(dayStats).map(nick => {
      const stats = dayStats[nick];
      let prevPts = toNumber(stateBeforeDay[nick]?.points);
      if(!(nick in baseState)) prevPts = 0;
      const currPts = toNumber(stateAtDayEnd[nick]?.points || (prevPts + stats.delta));
      return {
        nick,
        prevPts,
        pts: currPts,
        delta: stats.delta,
        wins: stats.wins,
        games: stats.games,
        prevRank: prevRankMap[nick] || '-',
        currRank: currRankMap[nick] || '-',
      };
    }).sort((a,b)=>{
      const rankA = Number.isFinite(a.currRank) ? a.currRank : Number.MAX_SAFE_INTEGER;
      const rankB = Number.isFinite(b.currRank) ? b.currRank : Number.MAX_SAFE_INTEGER;
      if(rankA !== rankB) return rankA - rankB;
      return b.delta - a.delta;
    });

    playersTb.innerHTML='';
    playersList.forEach(p=>{
      const tr=document.createElement('tr');
      const cls=p.delta>=0?'up':'down';
      const arrow=p.delta>0?'▲':p.delta<0?'▼':'';
      const nClass='nick-'+rankLetterForPoints(p.pts);

      const rank=document.createElement('td');
      rank.textContent=`${p.currRank} (${p.prevRank})`;

      const tdAvatar=document.createElement('td');
      const img=document.createElement('img');
      img.className='avatar-img';
      img.alt=p.nick;
      img.dataset.nick = p.nick;
      img.dataset.nickKey = avatarNickKey(p.nick);
      img.src = AVATAR_PLACEHOLDER;
      img.onerror = () => {
        img.onerror = null;
        img.src = AVATAR_PLACEHOLDER;
      };
      tdAvatar.appendChild(img);

      const nick=document.createElement('td');
      nick.className=nClass;
      nick.textContent=p.nick;

      const pts=document.createElement('td');
      pts.textContent=p.pts;

      const games=document.createElement('td');
      games.textContent=p.games;

      const wins=document.createElement('td');
      wins.textContent=p.wins;

      const delta=document.createElement('td');
      delta.className=cls;
      delta.textContent=`${arrow} ${(p.delta>0?'+':'')+p.delta}`;

      [rank,tdAvatar,nick,pts,games,wins,delta].forEach(td=>tr.appendChild(td));
      playersTb.appendChild(tr);
    });

    renderAllAvatars();

    matchesTb.innerHTML='';
    preparedMatches.reverse();
    preparedMatches.forEach(match => {
      const tr=document.createElement('tr');
      const teamKeys = match.teamOrder.length ? match.teamOrder : Object.keys(match.teams);
      const teamIcons = ['🛡️','🚀','🛰️','⚙️'];

      const teamTds = teamKeys.slice(0,2).map((teamKey, idx) => {
        const team = match.teams[teamKey];
        if(!team) return null;
        const td=document.createElement('td');
        const isWinner = match.winnerKey && match.winnerKey !== 'tie' && match.winnerKey === team.key;
        const isLoser = match.winnerKey && match.winnerKey !== 'tie' && match.winnerKey !== team.key;
        td.className='team-label '+(isWinner?'team-win':isLoser?'team-loss':'');
        td.textContent=(teamIcons[idx] || '🎯')+' ';
        team.players.forEach((p,i)=>{
          const span=document.createElement('span');
          span.className='nick-'+p.rank;
          span.textContent=p.nick;
          td.appendChild(span);
          td.appendChild(document.createTextNode(` (${p.delta>0?'+':''}${p.delta})`));
          if(i<team.players.length-1) td.appendChild(document.createTextNode(', '));
        });
        const total=document.createElement('span');
        total.className='team-total';
        total.textContent='['+Math.round(team.totalBefore)+']';
        td.appendChild(total);
        return td;
      }).filter(Boolean);

      const tdScore=document.createElement('td');
      const vs=document.createElement('span');
      vs.className='vs';
      vs.textContent=formatScore(match.score1, match.score2);
      tdScore.appendChild(vs);

      const tdMvp=document.createElement('td');
      const labels=['🏅 MVP:','⭐ Срібна зірка:','⭐ Бронзова зірка:'];
      match.mvp.forEach((mvps,idx)=>{
        const label=labels[idx];
        mvps.forEach(mv=>{
          const div=document.createElement('div');
          div.textContent=label+' ';
          const span=document.createElement('span');
          span.className='nick-'+mv.rank;
          span.textContent=mv.nick;
          div.appendChild(span);
          tdMvp.appendChild(div);
        });
      });

      const pdfTd=document.createElement('td');
      if(match.pdfUrl){
        const a=document.createElement('a');
        a.href=match.pdfUrl;
        a.textContent='PDF';
        a.target='_blank';
        pdfTd.appendChild(a);
      }

      const tds=[teamTds[0],tdScore,teamTds[1],tdMvp,pdfTd].filter(Boolean);
      tds.forEach(td=>tr.appendChild(td));
      matchesTb.appendChild(tr);
    });
    renderDaySummary(dayStats, preparedMatches);
  }
})();
