function doPost(e){
  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch(err) {
    return ContentService.createTextOutput('Invalid payload');
  }

  if (payload.action === 'getGenders') {
    var ss = SpreadsheetApp.getActive();
    var out = {};
    ['kids','sundaygames'].forEach(function(name){
      var sheet = ss.getSheetByName(name);
      if(!sheet) return;
      var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
      var nickCol = headers.indexOf('Nickname') + 1;
      var genderCol = headers.indexOf('Gender') + 1;
      if(nickCol && genderCol){
        var values = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
        values.forEach(function(row){
          var nick = row[nickCol-1];
          var gender = row[genderCol-1];
          if(nick && gender){
            out[nick.toString().trim()] = gender.toString().trim().toLowerCase();
          }
        });
      }
    });
    return ContentService.createTextOutput(JSON.stringify(out))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput('Unsupported');
}
