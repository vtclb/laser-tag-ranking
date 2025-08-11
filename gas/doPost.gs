***********************
 * LaserTag doPost.gs  *
 * (з розширеннями під балансер, аватарки, PDF, кабінет)
 ***********************/
const SPREADSHEET_ID = '19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw';

// Script Properties: вкажи ID папок у Google Drive
const PKEY_AVATARS_FOLDER_ID = 'LT_AVATARS_FOLDER_ID'; // 1UdG7dhV7iT1a5H2HkvjYxV711hT_ahhn
const PKEY_PDFS_FOLDER_ID    = 'LT_PDFS_FOLDER_ID';    // 1l3uM7cRTPe4aUclZ874hYz_LxrZV4riP

function doPost(e) {
  try {
    // ---------- JSON API ----------
    if (e.postData) {
      const body = e.postData.contents || '';
      const type = String(e.postData.type || '').toLowerCase();
      if (type.includes('json') || /^\s*[\{\[]/.test(body)) {
        const payload = JSON.parse(body || '{}');
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
        return JsonOK({status:'ERROR', reason:'Unknown action'});
      }
    }

    // ---------- FORM-URLENCODED: зберегти гру (твоя робоча логіка без змін) ----------
    const raw = e.postData && e.postData.contents;
    if (!raw) throw new Error('postData empty');
    const params = raw.split('&').map(p => p.split('=')).reduce((o, [k, v]) => {
      o[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      return o;
    }, {});

    const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const now = new Date();

    // 1) Game log
    const gamesSheet = ss.getSheetByName('games');
    if (!gamesSheet) throw new Error('games not found');
    const hdrGames = gamesSheet.getRange(1, 1, 1, gamesSheet.getLastColumn()).getValues()[0]
      .map(h => h.toString().trim().toLowerCase());
    const rowGames = hdrGames.map(h => {
      switch (h) {
        case 'timestamp': return now;
        case 'league':    return params.league || '';
        case 'team1':     return params.team1  || '';
        case 'team2':     return params.team2  || '';
        case 'team3':     return params.team3  || '';
        case 'team4':     return params.team4  || '';
        case 'winner':    return params.winner || '';
        case 'mvp':       return params.mvp    || '';
        case 'series':    return params.series || '';
        case 'penalties': return params.penalties || '';
        default:          return '';
      }
    });
    gamesSheet.appendRow(rowGames);

    // 2) Ranking update
    const rankName  = (params.league === 'kids') ? 'kids' : 'sundaygames';
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
    (params.penalties || '').split(',').forEach(p => {
      const [nick, val] = p.split(':');
      if (nick && val) penaltyMap[nick.trim()] = parseInt(val, 10) || 0;
    });

    // Teams
    const teams = {};
    ['team1','team2','team3','team4'].forEach(key => {
      teams[key] = (params[key] || '')
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

    const winnerKey = params.winner;
    const updatedPlayers = [];

    allPlayers.forEach(nick => {
      const cell = rankSheet.getRange(2, nickCol, Math.max(rankSheet.getLastRow() - 1, 0), 1)
        .createTextFinder(nick).matchEntireCell(true).findNext();
      if (!cell) return;
      const row = cell.getRow();
      const cur = Number(rankSheet.getRange(row, ptsCol).getValue()) || 0;

      // ранг на момент цього матчу (за поточними очками до оновлення)
      const rankCode = (cur < 200) ? 'D' : (cur < 500) ? 'C' : (cur < 800) ? 'B' : (cur < 1200) ? 'A' : 'S';
      const partScore = ({D:5, C:0, B:-5, A:-10, S:-15}[rankCode]) ?? 0;
      const winScore  = (winnerKey !== 'tie' && teams[winnerKey]?.includes(nick)) ? 20 : 0;
      const mvpScore  = (nick === params.mvp) ? 10 : 0;
      const penScore  = penaltyMap[nick] || 0;

      const delta   = partScore + winScore + mvpScore + penScore;
      const updated = cur + delta;

      rankSheet.getRange(row, ptsCol).setValue(updated);
      logS.appendRow([now, params.league, nick, delta, updated]);

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

      const rankLetter = (updated < 200) ? 'D' : (updated < 500) ? 'C' : (updated < 800) ? 'B' : (updated < 1200) ? 'A' : 'S';
      updatedPlayers.push({nick: nick, points: updated, rank: rankLetter});
    });

    return JsonOK({status:'OK', players: updatedPlayers});
  } catch (err) {
    return TextPlain('Error: ' + err.message);
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
  if (!url) return JsonOK({status:'ERROR', reason: 'Missing Script Property ' + PKEY_AVATARS_FOLDER_ID});
  upsertAvatarUrl_(nick, url);

  return JsonOK({status:'OK', url});
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
  return publicFileUrl_(file.getId());
}

// мапа Nickname → URL у листі 'avatars'
function upsertAvatarUrl_(nick, url) {
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
    sh.getRange(rowIndex, updIdx+1).setValue(new Date());
  } else {
    sh.appendRow([nick, url, new Date()]);
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
function TextPlain(msg) {
  return ContentService.createTextOutput(String(msg))
    .setMimeType(ContentService.MimeType.TEXT);
}
