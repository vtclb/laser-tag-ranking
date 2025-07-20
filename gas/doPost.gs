function doPost(e) {
  try {
    // Handle JSON actions (importStats)
    if (e.postData.type === 'application/json') {
      const payload = JSON.parse(e.postData.contents);

      if (payload.action === 'importStats') {
        const ss = SpreadsheetApp.openById('19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw');
        let statsSheet = ss.getSheetByName('detailedStats');
        if (!statsSheet) {
          statsSheet = ss.insertSheet('detailedStats');
          statsSheet.appendRow(['matchId','Nickname','Kills','Deaths','Shots','Hits','Accuracy']);
        }
        payload.stats.forEach(r => {
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
        return ContentService.createTextOutput('OK');
      }

    }

    // --- Standard form-urlencoded POST for saving game result ---
    const raw = e.postData?.contents;
    if (!raw) throw new Error('postData empty');
    const params = raw.split('&').map(p => p.split('=')).reduce((o, [k, v]) => {
      o[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      return o;
    }, {});

    const ss  = SpreadsheetApp.openById('19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw');
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

    // Penalties map
    const penaltyMap = {};
    (params.penalties || '').split(',').forEach(p => {
      const [nick, val] = p.split(':');
      if (nick && val) penaltyMap[nick.trim()] = parseInt(val, 10) || 0;
    });

    // Teams
    const teams = {};
    ['team1','team2','team3','team4'].forEach(key => {
      teams[key] = (params[key] || '').split(',').map(s => s.trim()).filter(Boolean);
    });
    const allPlayers = Array.from(new Set(Object.values(teams).flat()));

    // Delta log
    let logS = ss.getSheetByName('logs');
    if (!logS) {
      logS = ss.insertSheet('logs');
      logS.appendRow(['Timestamp','League','Nickname','Delta','NewPoints']);
    }

    const winnerKey = params.winner;
    allPlayers.forEach(nick => {
      const cell = rankSheet.getRange(2, nickCol, rankSheet.getLastRow() - 1, 1)
        .createTextFinder(nick).matchEntireCell(true).findNext();
      if (!cell) return;
      const row = cell.getRow();
      const cur = rankSheet.getRange(row, ptsCol).getValue() || 0;

      const rankCode = cur < 200 ? 'D'
                     : cur < 500 ? 'C'
                     : cur < 800 ? 'B'
                     : cur < 1200 ? 'A' : 'S';
      const partScore = {D:5,C:0,B:-5,A:-10,S:-15}[rankCode] || 0;
      const winScore  = (winnerKey !== 'tie' && teams[winnerKey]?.includes(nick)) ? 20 : 0;
      const mvpScore  = (nick === params.mvp) ? 10 : 0;
      const penScore  = penaltyMap[nick] || 0;

      const delta = partScore + winScore + mvpScore + penScore;
      const updated = cur + delta;
      rankSheet.getRange(row, ptsCol).setValue(updated);
      logS.appendRow([now, params.league, nick, delta, updated]);
    });

    return ContentService.createTextOutput('OK');
  }
  catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}
