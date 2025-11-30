// scripts/arena.js
import { log } from './logger.js?v=2025-09-19-avatars-2';

import { saveResult, saveDetailedStats, normalizeLeague, safeSet } from './api.js?v=2025-09-19-avatars-2';
import { parseGamePdf }                   from './pdfParser.js?v=2025-09-19-avatars-2';
import { updateLobbyState }               from './lobby.js?v=2025-09-19-avatars-2';
import { teams }                          from './teams.js?v=2025-09-19-avatars-2';
import { getTeamKey, getTeamNumber, getTeamKeys }      from './state.js?v=2025-09-19-avatars-2';

// Дочекаємося, поки DOM завантажиться
document.addEventListener('DOMContentLoaded', () => {
  const btnStart    = document.getElementById('btn-start-match');
  const arenaArea   = document.getElementById('arena-area');
  const arenaVS     = document.getElementById('arena-vs');
  const arenaRounds = document.getElementById('arena-rounds');
  const mvpInputs   = [
    document.getElementById('mvp1'),
    document.getElementById('mvp2'),
    document.getElementById('mvp3')
  ];
  const playersDatalist = document.getElementById('players-datalist');
  const penaltyInput= document.getElementById('penalty');
  const btnSave     = document.getElementById('btn-save-match');
  const btnClear    = document.getElementById('btn-clear-arena');
  const leagueSel   = document.getElementById('league');
  const pdfInput    = document.getElementById('pdf-upload');
  const btnParsePdf = document.getElementById('btn-parse-pdf');

  // Перевіряємо необхідні елементи
  if (!btnStart || !btnSave || !btnClear) {
    console.error('Не знайдено основні кнопки арени');
    return;
  }

  // --- Імпорт PDF-статистики ---
  if (pdfInput && btnParsePdf) {
    btnParsePdf.disabled = true;
    pdfInput.addEventListener('change', () => {
      btnParsePdf.disabled = pdfInput.files.length === 0;
    });
    btnParsePdf.addEventListener('click', async () => {
      const file = pdfInput.files[0];
      if (!file) {
        alert('Оберіть PDF-файл для імпорту');
        return;
      }
      try {
        const stats = await parseGamePdf(file);
        const matchId = window.lastMatchId;
        if (!matchId) {
          alert('Спершу збережіть результат гри');
          return;
        }
        const res = await saveDetailedStats(matchId, stats);
        if (res.trim() === 'OK') {
          alert('Детальна статистика з PDF імпортована успішно');
        } else {
          const msg = 'Помилка імпорту статистики: ' + res;
          if (typeof showToast === 'function') showToast(msg); else alert(msg);
        }
      } catch (err) {
        log('[ranking]', err);
        alert('Не вдалося розпарсити PDF: ' + err.message);
      }
    });
  }

  // --- Почати бій ---
  btnStart.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('.arena-team:checked'))
      .map(cb => cb.dataset.team)
      .filter(Boolean);
    if (selected.length !== 2) {
      alert('Виберіть дві команди для бою');
      return;
    }
    const [aKeyRaw, bKeyRaw] = selected;
    const aKey = getTeamKey(aKeyRaw);
    const bKey = getTeamKey(bKeyRaw);
    if (!aKey || !bKey || !teams[aKey] || !teams[bKey]) {
      alert('Оберіть дійсні команди для бою');
      return;
    }

    const aNo = getTeamNumber(aKey) || aKey;
    const bNo = getTeamNumber(bKey) || bKey;

    arenaVS.textContent = `Команда ${aNo} ✕ Команда ${bNo}`;
    arenaRounds.innerHTML = '';
    const playerNicks = new Set([...teams[aKey], ...teams[bKey]].map(p => p.nick));
    playersDatalist.innerHTML = Array.from(playerNicks)
      .map(n => `<option value="${n}"></option>`)
      .join('');
    mvpInputs.forEach(inp => inp.value = '');
    penaltyInput.value    = '';

    // Створюємо блоки раундів для кожної команди
    [aNo, bNo].forEach((teamId, idx) => {
      const div = document.createElement('div');
      div.className = 'arena-round-block';
      div.innerHTML = `<h4>Команда ${teamId}</h4>` +
        [1,2,3].map(round => `
          <label>
            <input type="checkbox" class="round-${round}-${idx === 0 ? 'a' : 'b'}">
            Раунд ${round}
          </label>
        `).join('');
      arenaRounds.append(div);
    });

    arenaArea.classList.remove('hidden');
    btnSave.disabled = false;
    btnSave.dataset.teams = `${aKey},${bKey}`;
  });

  // --- Зберегти гру ---
  async function saveGame(){
    try {
      const selectedTeams = (btnSave.dataset.teams || '').split(',').filter(Boolean);
      if (selectedTeams.length !== 2) throw new Error('Неправильний формат арени');
      const [teamKeyA, teamKeyB] = selectedTeams;

      let winsA = 0, winsB = 0;
      [1,2,3].forEach(r => {
        if (arenaRounds.querySelector(`.round-${r}-a`)?.checked) winsA++;
        if (arenaRounds.querySelector(`.round-${r}-b`)?.checked) winsB++;
      });
      const series = `${winsA}-${winsB}`;
      const winner = winsA > winsB ? teamKeyA
                   : winsB > winsA ? teamKeyB
                   : 'tie';

      const league = normalizeLeague(leagueSel.value);
      const mvpValues = mvpInputs.map(inp => inp.value.trim());
      if (!mvpValues[0]) {
        alert('Вкажіть MVP');
        return;
      }
      const allowedNicks = new Set([...(teams[teamKeyA] || []), ...(teams[teamKeyB] || [])].map(p => p.nick));
      const seen = new Set();
      for (const nick of mvpValues.filter(Boolean)) {
        if (!allowedNicks.has(nick)) {
          alert(`Гравець ${nick} не бере участі у цьому матчі`);
          return;
        }
        if (seen.has(nick)) {
          alert('Гравці для нагород мають бути різними');
          return;
        }
        seen.add(nick);
      }

      const [mvp1, mvp2, mvp3] = mvpValues;

      const data = {
        league,
        winner,
        mvp1,
        mvp2,
        mvp3,
        mvp: mvp1,
        series,
        penalties: penaltyInput.value.trim()
      };
      getTeamKeys().forEach(key => {
        data[key] = '';
      });
      data[teamKeyA] = (teams[teamKeyA] || []).map(p => p.nick).join(', ');
      data[teamKeyB] = (teams[teamKeyB] || []).map(p => p.nick).join(', ');

      const res = await saveResult(data);
      const ok = !!(res && res.ok);
      const message = res && typeof res === 'object' && 'message' in res
        ? res.message
        : undefined;
      if (!ok) {
        const errorMessage = message || 'Невідома помилка';
        console.error('Save game error: ' + errorMessage);
        const msg = 'Помилка збереження: ' + errorMessage;
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        return;
      }

      // Зберігаємо matchId для подальшого імпорту PDF
      window.lastMatchId = res.matchId || Date.now();

      if (Array.isArray(res.players)) {
        await updateLobbyState(res.players);
      }

      const successMessage = message || 'Гру успішно збережено та рейтинги оновлено';
      if (typeof showToast === 'function') showToast(successMessage); else alert(successMessage);
      safeSet(localStorage, 'gamedayRefresh', Date.now());
      btnClear.click();
    } catch (err) {
      log('[ranking]', err);
      const msg = 'Не вдалося зберегти гру';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
    }
  }
  btnSave.addEventListener('click', saveGame);

  // --- Скинути арену ---
  btnClear.addEventListener('click', () => {
    arenaArea.classList.add('hidden');
    arenaRounds.innerHTML = '';
    btnSave.disabled = true;
    delete btnSave.dataset.teams;
    document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
    mvpInputs.forEach(inp => inp.value = '');
    penaltyInput.value = '';
    playersDatalist.innerHTML = '';
  });
});
