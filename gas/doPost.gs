***********************
 * LaserTag doPost.gs  *
 * (з розширеннями під балансер, аватарки, PDF, кабінет)
 ***********************/
const SPREADSHEET_ID = '19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw';

// Script Properties: вкажи ID папок у Google Drive
const PKEY_AVATARS_FOLDER_ID = 'LT_AVATARS_FOLDER_ID'; // 1UdG7dhV7iT1a5H2HkvjYxV711hT_ahhn
const PKEY_PDFS_FOLDER_ID    = 'LT_PDFS_FOLDER_ID';    // 1l3uM7cRTPe4aUclZ874hYz_LxrZV4riP

function log(...args) {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug(...args);
  } else if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log(...args);
  }
}

function rankLetterForPoints(p) {
  p = Number(p) || 0;
  if (p >= 1200) return 'S';
  if (p >= 1000) return 'A';
  if (p >= 800)  return 'B';
  if (p >= 600)  return 'C';
  if (p >= 400)  return 'D';
  if (p >= 200)  return 'E';
  return 'F';
}

function doPost(e) {
  try {
    // ---------- JSON API ----------
    if (e.postData) {
      const body = e.postData.contents || '';
      const type = String(e.postData.type || '').toLowerCase();
      if (type.includes('json') || /^\s*[\{\[]/.test(body)) {
        const payload = JSON.parse(body || '{}');
      const mode = (payload.mode || '').trim();
      if (mode === 'tournament') {
        return handleTournamentRequest_(payload);
      }

      const action = (payload.action || '').trim();

        // 0) техсервісні
        if (action === 'ping') {
          return JsonOK({pong: true, ts: new Date().toISOString()});
        }

        // 1) існуючі
        if (action === 'importStats') return handleImportStats_(payload);
        if (action === 'register')    return handleRegister_(payload);
        if (action === 'getStats')    return handleGetStats_(payload);

        // 2) НОВЕ: адміністратор створює гравця з балансера
        // payload: { league:'kids'|'sundaygames', nick, gender?, contact?, experience?, age? }
        if (action === 'adminCreatePlayer') return handleAdminCreatePlayer_(payload);

        // 3) НОВЕ: видати/оновити accessKey для профілю
        // payload: { league, nick } -> { key }
        if (action === 'issueAccessKey') return handleIssueAccessKey_(payload);

        // 4) НОВЕ: профіль гравця (з ключем або без)
        // payload: { league?, nick, key? } -> повертає points, abonement_*, avatarUrl, тощо
        if (action === 'getProfile') return handleGetProfile_(payload);

        // 5) НОВЕ: аватарки (Drive avatars/)
        // uploadAvatar: { nick, mime, data(base64) } -> { url }
        if (action === 'uploadAvatar') return handleUploadAvatar_(payload);
        // getAvatarUrl: { nick } -> { url|null, updatedAt? }
        if (action === 'getAvatarUrl') return handleGetAvatarUrl_(payload);

        // 6) НОВЕ: PDF links з Drive /pdfs/{league}/{YYYY-MM-DD}/<matchId>.pdf
        // getPdfLinks: { league, date:'YYYY-MM-DD' } -> { links: {matchId:url} }
        if (action === 'getPdfLinks') return handleGetPdfLinks_(payload);

        // Unknown
        return JsonErr(new Error('Unknown action'));
      }
    }

    // ---------- FORM-URLENCODED: зберегти гру (твоя робоча логіка без змін) ----------
    const raw = e.postData && e.postData.contents;
    if (!raw) throw new Error('postData empty');
    const params = raw.split('&').map(p => p.split('=')).reduce((o, [k, v]) => {
      o[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      return o;
    }, {});

    return handleRegularGame_(params);
  } catch (err) {
    log('[ranking]', err);
    return JsonErr(err);
  }
}

/* ===================== JSON HANDLERS ===================== */

function handleImportStats_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let statsSheet = ss.getSheetByName('detailedStats');
  if (!statsSheet) {
    statsSheet = ss.insertSheet('detailedStats');
    statsSheet.appendRow(['matchId','Nickname','Kills','Deaths','Shots','Hits','Accuracy']);
  }
  (payload.stats || []).forEach(r => {
    statsSheet.appendRow([
      payload.matchId,
      r.nick,
      r.kills,
      r.deaths,
      r.shots,
      r.hits,
      r.accuracy
    ]);
  });
  return TextPlain('OK');
}

function handleRegister_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const age = parseInt(payload.age, 10) || 0;
  const league = age < 14 ? 'kids' : 'sundaygames';
  const sheet = ss.getSheetByName(league);
  if (!sheet) throw new Error('Sheet not found');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Nickname', 'Points', 'Gender', 'Contact', 'Experience', 'Age',
                     'abonement_type','abonement_start','abonement_usage','access_key']);
  }

  const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nickCol = hdr.indexOf('Nickname') + 1;
  if (nickCol < 1) throw new Error('Nickname column missing');

  const existing = sheet.getRange(2, nickCol, Math.max(sheet.getLastRow() - 1, 0), 1)
    .createTextFinder(payload.nick).matchEntireCell(true).findNext();
  if (existing) return TextPlain('DUPLICATE');

  const points = 100;
  const row = [
    new Date(),
    payload.nick || '',
    points,
    payload.gender || '',
    payload.contact || '',
    payload.experience || '',
    payload.age || ''
  ];

  // опційні
  ensureOptionalCols_(sheet, hdr);
  const hdr2 = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const hasAb = hdr2.indexOf('abonement_type') > -1 && hdr2.indexOf('abonement_start') > -1 && hdr2.indexOf('abonement_usage') > -1;
  const hasKey = hdr2.indexOf('access_key') > -1;

  if (hasAb) row.push('none', '', 0);
  if (hasKey) row.push('');

  sheet.appendRow(row);
  return TextPlain('OK');
}

// адмінське створення гравця з балансера
function handleAdminCreatePlayer_(payload) {
  const league = String(payload.league || '').toLowerCase();
  if (!league || (league !== 'kids' && league !== 'sundaygames')) throw new Error('Invalid league');
  const nick = (payload.nick || '').trim();
  if (!nick) throw new Error('Empty nick');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(league);
  if (!sheet) throw new Error('Sheet not found');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Nickname', 'Points', 'Gender', 'Contact', 'Experience', 'Age',
                     'abonement_type','abonement_start','abonement_usage','access_key']);
  }
  const hdr = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  ensureOptionalCols_(sheet, hdr);
  const hdr2 = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];

  const nickCol = hdr2.indexOf('Nickname') + 1;
  if (nickCol < 1) throw new Error('Nickname column missing');

  const existing = sheet.getRange(2, nickCol, Math.max(sheet.getLastRow() - 1, 0), 1)
    .createTextFinder(nick).matchEntireCell(true).findNext();
  if (existing) return JsonOK({status:'DUPLICATE'});

  const points = Number(payload.points) || 100;
  const row = [
    new Date(),
    nick,
    points,
    payload.gender || '',
    payload.contact || '',
    payload.experience || '',
    payload.age || ''
  ];

  const hasAb = hdr2.indexOf('abonement_type') > -1 && hdr2.indexOf('abonement_start') > -1 && hdr2.indexOf('abonement_usage') > -1;
  const hasKey = hdr2.indexOf('access_key') > -1;

  if (hasAb) row.push('none', '', 0);
  if (hasKey) row.push('');

  sheet.appendRow(row);

  return JsonOK({status:'OK', player:{league, nick, points}});
}

// видати / оновити access_key
function handleIssueAccessKey_(payload) {
  const league = String(payload.league || '').toLowerCase();
  const nick = (payload.nick || '').trim();
  if (!league || !nick) throw new Error('league/nick required');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(league);
  if (!sheet) throw new Error('Sheet not found');

  const hdr = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  ensureOptionalCols_(sheet, hdr);
  const hdr2 = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const nickCol = hdr2.indexOf('Nickname') + 1;
  const keyCol  = hdr2.indexOf('access_key') + 1;
  if (nickCol < 1 || keyCol < 1) throw new Error('Columns missing');

  const cell = sheet.getRange(2, nickCol, Math.max(sheet.getLastRow()-1,0), 1)
    .createTextFinder(nick).matchEntireCell(true).findNext();
  if (!cell) throw new Error('Player not found');

  const row = cell.getRow();
  const newKey = makeKey_(10);
  sheet.getRange(row, keyCol).setValue(newKey);

  return JsonOK({status:'OK', key: newKey});
}

// профіль гравця (мінімум: points, abonement_*, avatarUrl). Якщо передано key — можна робити приватні дані.
function handleGetProfile_(payload) {
  const nick = (payload.nick || '').trim();
  if (!nick) throw new Error('nick required');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leagues = ['kids','sundaygames'];
  let found = null, leagueUsed = null;

  for (let lg of leagues) {
    const sheet = ss.getSheetByName(lg);
    if (!sheet) continue;
    const hdr = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const nickCol = hdr.indexOf('Nickname') + 1;
    if (nickCol < 1) continue;

    const cell = sheet.getRange(2, nickCol, Math.max(sheet.getLastRow()-1,0),1)
      .createTextFinder(nick).matchEntireCell(true).findNext();
    if (cell) {
      const row = cell.getRow();
      const rowVals = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
      const pointsCol = hdr.indexOf('Points');
      const typeCol   = hdr.indexOf('abonement_type');
      const startCol  = hdr.indexOf('abonement_start');
      const usageCol  = hdr.indexOf('abonement_usage');
      const keyCol    = hdr.indexOf('access_key');

      // перевірка ключа (якщо передано)
      if (payload.key && keyCol > -1) {
        const currentKey = String(rowVals[keyCol] || '');
        if (currentKey && currentKey !== String(payload.key)) {
          return JsonOK({status:'DENIED'}); // ключ невірний
        }
      }

      found = {
        points: pointsCol>-1 ? Number(rowVals[pointsCol] || 0) : null,
        abonement: {
          type:  typeCol>-1  ? String(rowVals[typeCol]  || 'none') : 'none',
          start: startCol>-1 ? (rowVals[startCol] || '')           : '',
          usage: usageCol>-1 ? Number(rowVals[usageCol] || 0)      : 0
        }
      };
      leagueUsed = lg;
      break;
    }
  }

  // avatar
  const avatar = lookupAvatarUrl_(nick);

  return JsonOK({
    status: 'OK',
    league: leagueUsed,
    nick,
    avatarUrl: avatar ? avatar.url : null,
    avatarUpdatedAt: avatar ? avatar.updatedAt : null,
    profile: found
  });
}

/* ===================== REGULAR GAME (form-urlencoded) ===================== */
function handleRegularGame_(params) {
  const payload = params || {};
  const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  const now = new Date();

  // 1) Game log
  const gamesSheet = ss.getSheetByName('games');
  if (!gamesSheet) throw new Error('games not found');
  const hdrGames = gamesSheet.getRange(1, 1, 1, gamesSheet.getLastColumn()).getValues()[0]
    .map(h => h.toString().trim().toLowerCase());
  ['mvp2', 'mvp3'].forEach(col => {
    if (!hdrGames.includes(col)) {
      gamesSheet.getRange(1, gamesSheet.getLastColumn() + 1, 1, 1).setValue(col);
      hdrGames.push(col);
    }
  });
  const rowGames = hdrGames.map(h => {
    switch (h) {
      case 'timestamp': return now;
      case 'league':    return payload.league || '';
      case 'team1':     return payload.team1  || '';
      case 'team2':     return payload.team2  || '';
      case 'team3':     return payload.team3  || '';
      case 'team4':     return payload.team4  || '';
      case 'winner':    return payload.winner || '';
      case 'mvp':       return payload.mvp1 || payload.mvp || '';
      case 'mvp2':      return payload.mvp2 || '';
      case 'mvp3':      return payload.mvp3 || '';
      case 'series':    return payload.series || '';
      case 'penalties': return payload.penalties || '';
      default:          return '';
    }
  });
  gamesSheet.appendRow(rowGames);

  // 2) Ranking update
  const rankName  = (payload.league === 'kids') ? 'kids' : 'sundaygames';
  const rankSheet = ss.getSheetByName(rankName);
  if (!rankSheet) throw new Error(rankName + ' not found');
  const hdrRank = rankSheet.getRange(1, 1, 1, rankSheet.getLastColumn()).getValues()[0];
  const nickCol = hdrRank.indexOf('Nickname') + 1;
  const ptsCol  = hdrRank.indexOf('Points') + 1;
  if (nickCol < 1 || ptsCol < 1) throw new Error('Nickname/Points columns missing');

  // опційні колонки абонемента (лише якщо вони існують)
  const typeCol  = hdrRank.indexOf('abonement_type') + 1;
  const startCol = hdrRank.indexOf('abonement_start') + 1;
  const usageCol = hdrRank.indexOf('abonement_usage') + 1;

  // Penalties map
  const penaltyMap = {};
  (payload.penalties || '').split(',').forEach(p => {
    const [nick, val] = p.split(':');
    if (nick && val) penaltyMap[nick.trim()] = parseInt(val, 10) || 0;
  });

  // Teams
  const teams = {};
  ['team1','team2','team3','team4'].forEach(key => {
    teams[key] = (payload[key] || '')
      .replace(/\r?\n/g, ',')
      .split(/[;,]/).map(s => s.trim()).filter(Boolean);
  });
  const allPlayers = Array.from(new Set(Object.values(teams).flat()));

  // Delta log
  let logS = ss.getSheetByName('logs');
  if (!logS) {
    logS = ss.insertSheet('logs');
    logS.appendRow(['Timestamp','League','Nickname','Delta','NewPoints']);
  }

  const winnerKey = payload.winner;
  let mvp1 = (payload.mvp1 || payload.mvp || '').trim();
  let mvp2 = (payload.mvp2 || payload.mvp || '').trim();
  let mvp3 = (payload.mvp3 || payload.mvp || '').trim();
  if (mvp2 && mvp2 === mvp1) mvp2 = '';
  if (mvp3 && (mvp3 === mvp1 || mvp3 === mvp2)) mvp3 = '';

  const updatedPlayers = [];

  allPlayers.forEach(nick => {
    const cell = rankSheet.getRange(2, nickCol, Math.max(rankSheet.getLastRow() - 1, 0), 1)
      .createTextFinder(nick).matchEntireCell(true).findNext();
    if (!cell) return;
    const row = cell.getRow();
    const cur = Number(rankSheet.getRange(row, ptsCol).getValue()) || 0;

    // ранг на момент цього матчу (за поточними очками до оновлення)
    const rl = rankLetterForPoints(cur);
    const partScore = ({F:0, E:-4, D:-6, C:-8, B:-10, A:-12, S:-14})[rl] || 0;
    const winScore  = (winnerKey !== 'tie' && teams[winnerKey]?.includes(nick)) ? 20 : 0;
    const mvpBonus = (nick === mvp1 ? 12 : 0) + (nick === mvp2 ? 7 : 0) + (nick === mvp3 ? 3 : 0);
    const penScore  = penaltyMap[nick] || 0;

    const delta   = partScore + winScore + mvpBonus + penScore;
    const updated = cur + delta;

    rankSheet.getRange(row, ptsCol).setValue(updated);
    logS.appendRow([now, payload.league, nick, delta, updated]);

    // --- Абонемент (опційно) ---
    if (typeCol > 0 && startCol > 0 && usageCol > 0) {
      const aType = String(rankSheet.getRange(row, typeCol).getValue() || '').trim().toLowerCase();
      if (aType && aType !== 'none') {
        const startVal = rankSheet.getRange(row, startCol).getValue();
        if (!startVal) {
          rankSheet.getRange(row, startCol).setValue(now); // виставляємо початок при першій зафіксованій грі
        }
        const usageCell = rankSheet.getRange(row, usageCol);
        usageCell.setValue((Number(usageCell.getValue()) || 0) + 1);
      }
    }

    const rankLetter = rankLetterForPoints(updated);
    updatedPlayers.push({nick: nick, points: updated, rank: rankLetter});
  });

  return JsonOK({status:'OK', players: updatedPlayers});
}

/* ===================== AVATARS (Drive + sheet 'avatars') ===================== */
function handleUploadAvatar_(payload) {
  const nick = (payload.nick || '').trim();
  if (!nick) throw new Error('nick required');
  const mime = payload.mime || 'image/jpeg';
  const data = payload.data; // base64 без префікса
  if (!data) throw new Error('no data');

  const bytes = Utilities.base64Decode(data);
  const blob  = Utilities.newBlob(bytes, mime, nick + '.jpg');

  const url = saveAvatarBlob_(nick, blob); // save to Drive/avatars
  if (!url) return JsonErr(new Error('Missing Script Property ' + PKEY_AVATARS_FOLDER_ID));
  const isoTime = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  upsertAvatarUrl_(nick, url, isoTime);

  return JsonOK({status:'OK', url, updatedAt: isoTime});
}

function handleGetAvatarUrl_(payload) {
  const nick = (payload.nick || '').trim();
  if (!nick) throw new Error('nick required');
  const rec = lookupAvatarUrl_(nick);
  return JsonOK({status:'OK', url: rec ? rec.url : null, updatedAt: rec ? rec.updatedAt : null});
}

// зберегти в Drive/avatars та повернути публічний URL
function saveAvatarBlob_(nick, blob) {
  const folder = getFolderByPropKey_(PKEY_AVATARS_FOLDER_ID);
  if (!folder) return null;
  const name = String(nick).trim() + '.jpg';
  const it = folder.getFilesByName(name);
  while (it.hasNext()) it.next().setTrashed(true);
  const file = folder.createFile(blob.setName(name));
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  return thumbnailUrl_(file.getId());
}

/* ===================== TOURNAMENT MODE ===================== */
function handleTournamentRequest_(payload) {
  const action = (payload.action || '').trim();
  switch (action) {
    case 'createTournament':
      return createTournament_(payload);
    case 'saveTeams':
      return saveTournamentTeams_(payload);
    case 'createGames':
      return createTournamentGames_(payload);
    case 'saveGame':
      return saveTournamentGame_(payload);
    case 'getTournamentData':
      return getTournamentData_(payload);
    case 'listTournaments':
      return listTournaments_(payload);
    default:
      return JsonErr(new Error('Unknown tournament action'));
  }
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase();
}

function buildHeaderIndex_(sheet) {
  const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  hdr.forEach((h, i) => {
    map[normalizeHeader_(h)] = i;
  });
  return { hdr, map };
}

function getIdx_(map, name) {
  const idx = map[normalizeHeader_(name)];
  return typeof idx === 'number' ? idx : -1;
}

function rowsToObjects_(hdr, rows) {
  return rows.map(row => {
    const obj = {};
    hdr.forEach((key, i) => {
      obj[key] = row[i];
    });
    return obj;
  });
}

function createTournament_(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tournaments');
  if (!sheet) throw new Error('tournaments not found');

  const { hdr, map } = buildHeaderIndex_(sheet);
  const name = (payload.name || '').trim();
  const league = String(payload.league || 'kids').trim();
  const baseSlug = (name || 'TRN').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'TRN';
  const leagueSlug = league.toUpperCase().slice(0, 3) || 'LG';
  const ts = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd_HHmmss');
  const tournamentId = `${baseSlug}_${leagueSlug}_${ts}`;

  const row = hdr.map(h => {
    switch (normalizeHeader_(h)) {
      case 'tournamentid': return tournamentId;
      case 'name': return name;
      case 'league': return league;
      case 'datestart': return payload.dateStart || '';
      case 'dateend': return payload.dateEnd || '';
      case 'status': return payload.status || 'ACTIVE';
      case 'notes': return payload.notes || '';
      default: return '';
    }
  });
  sheet.appendRow(row);

  return JsonOK({ status: 'OK', tournamentId });
}

function saveTournamentTeams_(payload) {
  const tournamentId = (payload.tournamentId || '').trim();
  if (!tournamentId) throw new Error('tournamentId required');
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  if (!teams.length) throw new Error('teams required');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tournament_teams');
  if (!sheet) throw new Error('tournament_teams not found');
  const { hdr, map } = buildHeaderIndex_(sheet);

  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const keyToRowIndex = new Map();
  rows.forEach((row, i) => {
    const key = `${row[getIdx_(map, 'tournamentid')]}::${row[getIdx_(map, 'teamid')]}`;
    keyToRowIndex.set(key, i + 2); // 1-based with header row
  });

  teams.forEach(team => {
    const teamId = String(team.teamId || '').trim();
    const teamName = team.teamName || teamId;
    const players = Array.isArray(team.players) ? team.players : [];
    const playersStr = players.map(p => String(p || '').trim()).filter(Boolean).join(',');
    if (!teamId) return;

    const key = `${tournamentId}::${teamId}`;
    const existingRow = keyToRowIndex.get(key);
    const defaultValues = {
      mmrStart: 1000,
      mmrCurrent: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      rank: ''
    };

    if (existingRow) {
      // update teamName/players only
      sheet.getRange(existingRow, getIdx_(map, 'teamname') + 1).setValue(teamName);
      sheet.getRange(existingRow, getIdx_(map, 'players') + 1).setValue(playersStr);
    } else {
      const row = hdr.map(h => {
        switch (normalizeHeader_(h)) {
          case 'tournamentid': return tournamentId;
          case 'teamid': return teamId;
          case 'teamname': return teamName;
          case 'players': return playersStr;
          case 'mmrstart': return defaultValues.mmrStart;
          case 'mmrcurrent': return defaultValues.mmrCurrent;
          case 'wins': return defaultValues.wins;
          case 'losses': return defaultValues.losses;
          case 'draws': return defaultValues.draws;
          case 'points': return defaultValues.points;
          case 'rank': return defaultValues.rank;
          default: return '';
        }
      });
      sheet.appendRow(row);
    }
  });

  return JsonOK({ status: 'OK' });
}

function createTournamentGames_(payload) {
  const tournamentId = (payload.tournamentId || '').trim();
  if (!tournamentId) throw new Error('tournamentId required');
  const games = Array.isArray(payload.games) ? payload.games : [];
  if (!games.length) throw new Error('games required');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tournament_games');
  if (!sheet) throw new Error('tournament_games not found');
  const { hdr, map } = buildHeaderIndex_(sheet);

  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const keyToRowIndex = new Map();
  rows.forEach((row, i) => {
    const key = `${row[getIdx_(map, 'tournamentid')]}::${row[getIdx_(map, 'gameid')]}`;
    keyToRowIndex.set(key, i + 2);
  });

  games.forEach(game => {
    const gameId = String(game.gameId || '').trim();
    if (!gameId) return;
    const key = `${tournamentId}::${gameId}`;
    const baseRow = hdr.map(h => {
      switch (normalizeHeader_(h)) {
        case 'tournamentid': return tournamentId;
        case 'gameid': return gameId;
        case 'mode': return game.mode || '';
        case 'teamaid': return game.teamAId || '';
        case 'teambid': return game.teamBId || '';
        case 'winnerteamid': return '';
        case 'isdraw': return 'FALSE';
        case 'mvpnick': return '';
        case 'secondnick': return '';
        case 'thirdnick': return '';
        case 'teamammrbefore': return '';
        case 'teambmmrbefore': return '';
        case 'teamammrdelta': return '';
        case 'teambmmrdelta': return '';
        case 'timestamp': return '';
        case 'notes': return '';
        default: return '';
      }
    });

    const rowIndex = keyToRowIndex.get(key);
    if (rowIndex) {
      sheet.getRange(rowIndex, 1, 1, baseRow.length).setValues([baseRow]);
    } else {
      sheet.appendRow(baseRow);
    }
  });

  return JsonOK({ status: 'OK' });
}

function readTournamentConfigMap_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tournament_config');
  if (!sheet) return {};
  const { hdr } = buildHeaderIndex_(sheet);
  const data = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).getValues();
  const modeIdx = hdr.findIndex(h => normalizeHeader_(h) === 'mode');
  const allowIdx = hdr.findIndex(h => normalizeHeader_(h) === 'allowdraw');
  const map = {};
  data.forEach(row => {
    const mode = String(row[modeIdx] || '').trim();
    if (!mode) return;
    map[mode.toUpperCase()] = String(row[allowIdx]).toUpperCase() === 'TRUE';
  });
  return map;
}

function ensureTournamentRow_(sheet, map, tournamentId, gameId, rowValues) {
  const key = `${tournamentId}::${gameId}`;
  const existing = map.get(key);
  if (existing) {
    sheet.getRange(existing, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function parsePlayers_(raw) {
  if (Array.isArray(raw)) return raw.map(p => String(p || '').trim()).filter(Boolean);
  return String(raw || '')
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(Boolean);
}

function rankLetterForMmr_(mmr) {
  const points = Number(mmr) || 0;
  if (points >= 1400) return 'S';
  if (points >= 1200) return 'A';
  if (points >= 1000) return 'B';
  if (points >= 800) return 'C';
  if (points >= 600) return 'D';
  return 'E';
}

function saveTournamentGame_(payload) {
  const tournamentId = (payload.tournamentId || '').trim();
  const gameId = (payload.gameId || '').trim();
  const result = String(payload.result || '').toUpperCase();
  const mode = (payload.mode || '').trim().toUpperCase();
  if (!tournamentId || !gameId || !result) throw new Error('tournamentId/gameId/result required');

  const allowDraw = readTournamentConfigMap_()[mode] !== false;
  if (!allowDraw && result === 'DRAW') {
    throw new Error('Draw is not allowed for this mode');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const teamsSheet = ss.getSheetByName('tournament_teams');
  if (!teamsSheet) throw new Error('tournament_teams not found');
  const teamsHdrInfo = buildHeaderIndex_(teamsSheet);
  let teamsData = [];
  const lastTeamsRow = teamsSheet.getLastRow();
  if (lastTeamsRow > 1) {
    teamsData = teamsSheet.getRange(2, 1, lastTeamsRow - 1, teamsSheet.getLastColumn()).getValues();
  }
  const teams = rowsToObjects_(teamsHdrInfo.hdr, teamsData)
    .filter(r => String(r.tournamentId || '') === tournamentId);

  const teamById = new Map();
  teams.forEach(team => {
    teamById.set(String(team.teamId), team);
  });

  const teamAId = String(payload.teamAId || '').trim();
  const teamBId = String(payload.teamBId || '').trim();
  const teamA = teamById.get(teamAId);
  const teamB = teamById.get(teamBId);
  if (!teamA || !teamB) throw new Error('Team not found');

  const mmrA = Number(teamA.mmrCurrent || teamA.mmrStart || 0) || 0;
  const mmrB = Number(teamB.mmrCurrent || teamB.mmrStart || 0) || 0;

  let deltaA = 0;
  let deltaB = 0;
  let pointsA = Number(teamA.points || 0) || 0;
  let pointsB = Number(teamB.points || 0) || 0;
  let winsA = Number(teamA.wins || 0) || 0;
  let winsB = Number(teamB.wins || 0) || 0;
  let lossesA = Number(teamA.losses || 0) || 0;
  let lossesB = Number(teamB.losses || 0) || 0;
  let drawsA = Number(teamA.draws || 0) || 0;
  let drawsB = Number(teamB.draws || 0) || 0;

  let winnerTeamId = '';
  let isDraw = false;

  if (result === 'DRAW') {
    deltaA = 5;
    deltaB = 5;
    pointsA += 1;
    pointsB += 1;
    drawsA += 1;
    drawsB += 1;
    isDraw = true;
  } else {
    const winnerIsA = result === 'A';
    winnerTeamId = winnerIsA ? teamAId : teamBId;
    const winnerMmr = winnerIsA ? mmrA : mmrB;
    const loserMmr = winnerIsA ? mmrB : mmrA;
    const mmrDiff = loserMmr - winnerMmr;
    const upset = mmrDiff >= 150;
    const winnerDelta = upset ? 35 : 25;

    if (winnerIsA) {
      deltaA = winnerDelta;
      deltaB = -10;
      pointsA += 3;
      winsA += 1;
      lossesB += 1;
    } else {
      deltaA = -10;
      deltaB = winnerDelta;
      pointsB += 3;
      winsB += 1;
      lossesA += 1;
    }
  }

  const updatedA = mmrA + deltaA;
  const updatedB = mmrB + deltaB;

  // update teams sheet
  const writeTeam = (team, updatedValues) => {
    const rowIndex = teamsData.findIndex(r => String(r[getIdx_(teamsHdrInfo.map, 'tournamentid')]) === tournamentId && String(r[getIdx_(teamsHdrInfo.map, 'teamid')]) === String(team.teamId));
    if (rowIndex === -1) return;
    const rowNumber = rowIndex + 2;
    const { teamId } = team;
    const rankVal = rankLetterForMmr_(updatedValues.mmrCurrent);
    const payloadRow = {
      mmrCurrent: updatedValues.mmrCurrent,
      wins: updatedValues.wins,
      losses: updatedValues.losses,
      draws: updatedValues.draws,
      points: updatedValues.points,
      rank: rankVal,
    };
    Object.entries(payloadRow).forEach(([key, value]) => {
      const idx = getIdx_(teamsHdrInfo.map, key);
      if (idx >= 0) {
        teamsSheet.getRange(rowNumber, idx + 1).setValue(value);
      }
    });
  };

  writeTeam(teamA, { mmrCurrent: updatedA, wins: winsA, losses: lossesA, draws: drawsA, points: pointsA });
  writeTeam(teamB, { mmrCurrent: updatedB, wins: winsB, losses: lossesB, draws: drawsB, points: pointsB });

  // update games sheet
  const gamesSheet = ss.getSheetByName('tournament_games');
  if (!gamesSheet) throw new Error('tournament_games not found');
  const gamesHdrInfo = buildHeaderIndex_(gamesSheet);
  let gamesData = [];
  const lastGamesRow = gamesSheet.getLastRow();
  if (lastGamesRow > 1) {
    gamesData = gamesSheet.getRange(2, 1, lastGamesRow - 1, gamesSheet.getLastColumn()).getValues();
  }
  const gamesMap = new Map();
  gamesData.forEach((row, i) => {
    const key = `${row[getIdx_(gamesHdrInfo.map, 'tournamentid')]}::${row[getIdx_(gamesHdrInfo.map, 'gameid')]}`;
    gamesMap.set(key, i + 2);
  });

  const isoTime = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const gameRow = gamesHdrInfo.hdr.map(h => {
    switch (normalizeHeader_(h)) {
      case 'tournamentid': return tournamentId;
      case 'gameid': return gameId;
      case 'mode': return mode || payload.mode || '';
      case 'teamaid': return teamAId;
      case 'teambid': return teamBId;
      case 'winnerteamid': return winnerTeamId;
      case 'isdraw': return isDraw ? 'TRUE' : 'FALSE';
      case 'mvpnick': return payload.mvp || '';
      case 'secondnick': return payload.second || '';
      case 'thirdnick': return payload.third || '';
      case 'teamammrbefore': return mmrA;
      case 'teambmmrbefore': return mmrB;
      case 'teamammrdelta': return deltaA;
      case 'teambmmrdelta': return deltaB;
      case 'timestamp': return isoTime;
      case 'notes': return payload.notes || '';
      default: return '';
    }
  });
  ensureTournamentRow_(gamesSheet, gamesMap, tournamentId, gameId, gameRow);

  // update tournament_players
  const playersSheet = ss.getSheetByName('tournament_players');
  if (!playersSheet) throw new Error('tournament_players not found');
  const playersHdrInfo = buildHeaderIndex_(playersSheet);
  let playersData = [];
  const lastPlayersRow = playersSheet.getLastRow();
  if (lastPlayersRow > 1) {
    playersData = playersSheet.getRange(2, 1, lastPlayersRow - 1, playersSheet.getLastColumn()).getValues();
  }
  const playersRows = rowsToObjects_(playersHdrInfo.hdr, playersData);
  const playerKeyToRow = new Map();
  playersRows.forEach((row, i) => {
    const key = `${row.tournamentId || ''}::${row.playerNick || ''}`;
    playerKeyToRow.set(key, i + 2);
  });

  const teamPlayers = [
    { team: teamA, won: result === 'A', lost: result === 'B', drew: isDraw },
    { team: teamB, won: result === 'B', lost: result === 'A', drew: isDraw },
  ];

  const awards = {
    mvp: { nick: payload.mvp, field: 'mvpCount', impact: 3 },
    second: { nick: payload.second, field: 'secondCount', impact: 2 },
    third: { nick: payload.third, field: 'thirdCount', impact: 1 },
  };

  teamPlayers.forEach(({ team, won, lost, drew }) => {
    const players = parsePlayers_(team.players);
    players.forEach(nick => {
      if (!nick) return;
      const key = `${tournamentId}::${nick}`;
      const existingRow = playerKeyToRow.get(key);
      const base = {
        games: 0, wins: 0, losses: 0, draws: 0,
        mvpCount: 0, secondCount: 0, thirdCount: 0,
        impactPoints: 0, mmrChange: 0,
      };

      if (existingRow) {
        const rowValues = playersSheet.getRange(existingRow, 1, 1, playersSheet.getLastColumn()).getValues()[0];
        const rowObj = {};
        playersHdrInfo.hdr.forEach((h, idx) => { rowObj[normalizeHeader_(h)] = rowValues[idx]; });
        base.games = Number(rowObj['games'] || 0) || 0;
        base.wins = Number(rowObj['wins'] || 0) || 0;
        base.losses = Number(rowObj['losses'] || 0) || 0;
        base.draws = Number(rowObj['draws'] || 0) || 0;
        base.mvpCount = Number(rowObj['mvpcount'] || 0) || 0;
        base.secondCount = Number(rowObj['secondcount'] || 0) || 0;
        base.thirdCount = Number(rowObj['thirdcount'] || 0) || 0;
        base.impactPoints = Number(rowObj['impactpoints'] || 0) || 0;
        base.mmrChange = Number(rowObj['mmrchange'] || 0) || 0;
      }

      base.games += 1;
      if (won) base.wins += 1;
      if (lost) base.losses += 1;
      if (drew) base.draws += 1;

      Object.values(awards).forEach(({ nick: awardNick, field, impact }) => {
        if (awardNick && awardNick === nick && base[field] !== undefined) {
          base[field] += 1;
          base.impactPoints += impact;
        }
      });

      const rowPayload = playersHdrInfo.hdr.map(h => {
        switch (normalizeHeader_(h)) {
          case 'tournamentid': return tournamentId;
          case 'playernick': return nick;
          case 'teamid': return team.teamId || '';
          case 'games': return base.games;
          case 'wins': return base.wins;
          case 'losses': return base.losses;
          case 'draws': return base.draws;
          case 'mvpcount': return base.mvpCount;
          case 'secondcount': return base.secondCount;
          case 'thirdcount': return base.thirdCount;
          case 'impactpoints': return base.impactPoints;
          case 'mmrchange': return base.mmrChange;
          default: return '';
        }
      });

      if (existingRow) {
        playersSheet.getRange(existingRow, 1, 1, rowPayload.length).setValues([rowPayload]);
      } else {
        playersSheet.appendRow(rowPayload);
      }
    });
  });

  // optional export to regular game
  if (payload.exportAsRegularGame) {
    const tournamentSheet = ss.getSheetByName('tournaments');
    const tournamentRow = tournamentSheet
      ? rowsToObjects_(buildHeaderIndex_(tournamentSheet).hdr, tournamentSheet.getDataRange().getValues().slice(1))
        .find(r => String(r.tournamentId || '') === tournamentId)
      : null;
    const league = tournamentRow ? tournamentRow.league : (payload.league || 'sundaygames');
    const regularPayload = {
      league,
      team1: parsePlayers_(teamA.players).join(','),
      team2: parsePlayers_(teamB.players).join(','),
      team3: '',
      team4: '',
      winner: isDraw ? 'tie' : (result === 'A' ? 'team1' : 'team2'),
      mvp1: payload.mvp || '',
      mvp2: payload.second || '',
      mvp3: payload.third || '',
      penalties: '',
      series: `${mode}-${gameId}`,
    };
    handleRegularGame_(regularPayload);
  }

  return JsonOK({
    status: 'OK',
    winnerTeamId,
    teamAMmrBefore: mmrA,
    teamBMmrBefore: mmrB,
    teamAMmrDelta: deltaA,
    teamBMmrDelta: deltaB,
  });
}

function filterTournamentRows_(sheetName, tournamentId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const { hdr } = buildHeaderIndex_(sheet);
  const data = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).getValues();
  return rowsToObjects_(hdr, data).filter(r => String(r.tournamentId || '') === tournamentId);
}

function getTournamentData_(payload) {
  const tournamentId = (payload.tournamentId || '').trim();
  if (!tournamentId) throw new Error('tournamentId required');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tournamentsSheet = ss.getSheetByName('tournaments');
  if (!tournamentsSheet) throw new Error('tournaments not found');
  const tournaments = filterTournamentRows_('tournaments', tournamentId);
  const tournament = tournaments.find(() => true) || null;

  return JsonOK({
    status: 'OK',
    tournament,
    teams: filterTournamentRows_('tournament_teams', tournamentId),
    games: filterTournamentRows_('tournament_games', tournamentId),
    players: filterTournamentRows_('tournament_players', tournamentId),
    config: readTournamentConfigMap_(),
  });
}

function listTournaments_(payload) {
  const params = payload || {};
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tournaments');
  if (!sheet) throw new Error('tournaments not found');
  const { hdr } = buildHeaderIndex_(sheet);
  const data = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).getValues();
  const items = rowsToObjects_(hdr, data).filter(row => {
    const status = String(params.status || '').toUpperCase();
    const league = (params.league || '').toLowerCase();
    const matchesStatus = status ? String(row.status || '').toUpperCase() === status : true;
    const matchesLeague = league ? String(row.league || '').toLowerCase() === league : true;
    return matchesStatus && matchesLeague;
  });
  return JsonOK({ status: 'OK', tournaments: items });
}

// мапа Nickname → URL у листі 'avatars'
function upsertAvatarUrl_(nick, url, isoTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName('avatars');
  if (!sh) {
    sh = ss.insertSheet('avatars');
    sh.appendRow(['Nickname','AvatarURL','UpdatedAt']);
  }
  const data = sh.getDataRange().getValues();
  const hdr  = data[0];
  const nameIdx = hdr.indexOf('Nickname');
  const urlIdx  = hdr.indexOf('AvatarURL');
  const updIdx  = hdr.indexOf('UpdatedAt');
  if (nameIdx < 0 || urlIdx < 0 || updIdx < 0) throw new Error('avatars sheet malformed');

  let rowIndex = -1;
  for (let i=1;i<data.length;i++){
    if (String(data[i][nameIdx]).trim() === nick) { rowIndex = i+1; break; }
  }
  if (rowIndex > -1) {
    sh.getRange(rowIndex, urlIdx+1).setValue(url);
    sh.getRange(rowIndex, updIdx+1).setValue(isoTime);
  } else {
    sh.appendRow([nick, url, isoTime]);
  }
}

function lookupAvatarUrl_(nick) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName('avatars');
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  const hdr  = data[0];
  const nameIdx = hdr.indexOf('Nickname');
  const urlIdx  = hdr.indexOf('AvatarURL');
  const updIdx  = hdr.indexOf('UpdatedAt');
  for (let i=1;i<data.length;i++){
    if (String(data[i][nameIdx]).trim() === nick) {
      return { url: data[i][urlIdx] || null, updatedAt: data[i][updIdx] || null };
    }
  }
  return null;
}

/* ===================== PDF LINKS (Drive /pdfs) ===================== */
function handleGetPdfLinks_(payload) {
  const league = String(payload.league || '').toLowerCase();
  const ymd    = String(payload.date || '').trim();
  if (!league || !ymd) throw new Error('league/date required');
  const map = listPdfLinks_(league, ymd);
  if (map === null) return JsonOK({status:'ERROR', reason: 'Missing Script Property ' + PKEY_PDFS_FOLDER_ID});
  return JsonOK({status:'OK', links: map});
}

function listPdfLinks_(league, ymd) {
  const root = getFolderByPropKey_(PKEY_PDFS_FOLDER_ID);
  if (!root) return null;
  let lf = root.getFoldersByName(league);
  if (!lf.hasNext()) return {};
  const leagueFolder = lf.next();

  let df = leagueFolder.getFoldersByName(ymd);
  if (!df.hasNext()) return {};
  const dayFolder = df.next();

  const files = dayFolder.getFilesByType(MimeType.PDF);
  const map = {};
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    const matchId = name.replace(/\.pdf$/i, '');
    map[matchId] = publicFileUrl_(f.getId());
  }
  return map;
}

/* ===================== HELPERS ===================== */
function ensureOptionalCols_(sheet, hdr) {
  // додаємо колонки, якщо їх нема (в кінець)
  const need = ['abonement_type','abonement_start','abonement_usage','access_key'];
  const have = new Set(hdr.map(String));
  const toAdd = need.filter(n => !have.has(n));
  if (toAdd.length) {
    sheet.insertColumnsAfter(sheet.getLastColumn() || 1, toAdd.length);
    const newHdr = hdr.concat(toAdd);
    sheet.getRange(1,1,1,newHdr.length).setValues([newHdr]);
  }
}

function getFolderByPropKey_(key) {
  const id = PropertiesService.getScriptProperties().getProperty(key);
  return id ? DriveApp.getFolderById(id) : null;
}
function publicFileUrl_(fileId) {
  return 'https://drive.google.com/uc?export=view&id=' + fileId;
}

function thumbnailUrl_(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w512';
}
function makeKey_(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i=0;i<len;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}
function JsonOK(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function JsonErr(err, code) {
  const payload = {status: 'ERR', message: err && err.message ? err.message : String(err)};
  const c = code || (err && err.code);
  if (c) payload.code = c;
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
function TextPlain(msg) {
  return ContentService.createTextOutput(String(msg))
    .setMimeType(ContentService.MimeType.TEXT);
}
