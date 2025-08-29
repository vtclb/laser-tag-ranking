// scripts/arena.js
import { log } from './logger.js';

import { saveResult, saveDetailedStats, normalizeLeague, safeSet } from './api.js';
import { parseGamePdf }                   from './pdfParser.js';
import { updateLobbyState }               from './lobby.js';
import { teams }                          from './teams.js';

// Дочекаємося, поки DOM завантажиться
document.addEventListener('DOMContentLoaded', () => {
  const btnStart    = document.getElementById('btn-start-match');
  const arenaArea   = document.getElementById('arena-area');
  const arenaVS     = document.getElementById('arena-vs');
  const arenaRounds = document.getElementById('arena-rounds');
  const mvpSelect   = document.getElementById('mvp');
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
      .map(cb => parseInt(cb.dataset.team, 10));
    if (selected.length !== 2) {
      alert('Виберіть дві команди для бою');
      return;
    }
    const [a, b] = selected;
    if (!teams[a] || !teams[b]) {
      alert(`Команди ${a} або ${b} не знайдені`);
      return;
    }

    arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
    arenaRounds.innerHTML = '';
    mvpSelect.innerHTML   = '';
    penaltyInput.value    = '';

    // Заповнюємо MVP
    [...teams[a], ...teams[b]].forEach(player => {
      mvpSelect.insertAdjacentHTML('beforeend',
        `<option value="${player.nick}">${player.nick}</option>`
      );
    });

    // Створюємо блоки раундів для кожної команди
    [a, b].forEach((teamId, idx) => {
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
  });

  // --- Зберегти гру ---
  async function saveGame(){
    try {
      const vs = (arenaVS.textContent.match(/\d+/g) || []).map(Number);
      if (vs.length !== 2) throw new Error('Неправильний формат арени');

      let winsA = 0, winsB = 0;
      [1,2,3].forEach(r => {
        if (arenaRounds.querySelector(`.round-${r}-a`)?.checked) winsA++;
        if (arenaRounds.querySelector(`.round-${r}-b`)?.checked) winsB++;
      });
      const series = `${winsA}-${winsB}`;
      const winner = winsA > winsB ? 'team1'
                   : winsB > winsA ? 'team2'
                   : 'tie';

      const league = normalizeLeague(leagueSel.value);

      const data = {
        league,
        team1: teams[vs[0]].map(p => p.nick).join(', '),
        team2: teams[vs[1]].map(p => p.nick).join(', '),
        winner,
        mvp: mvpSelect.value,
        series,
        penalties: penaltyInput.value.trim()
      };

      const res = await saveResult(data);
      if (res.status !== 'OK') {
        const msg = 'Помилка збереження: ' + (res.status || res);
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        return;
      }

      // Зберігаємо matchId для подальшого імпорту PDF
      window.lastMatchId = res.matchId || Date.now();

      if (Array.isArray(res.players)) {
        updateLobbyState(res.players);
      }

      alert('Гру успішно збережено та рейтинги оновлено');
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
    document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
  });
});
