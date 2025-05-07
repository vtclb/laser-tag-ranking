// scripts/arena.js

import { saveResult, loadPlayers, saveDetailedStats } from './api.js';
import { parseGamePdf }               from './pdfParser.js';
import { initLobby }                  from './lobby.js';
import { initScenario }               from './scenario.js';
import { teams }                      from './teams.js';

// Чекаємо, поки DOM буде готовий
document.addEventListener('DOMContentLoaded', () => {
  const btnStart     = document.getElementById('btn-start-match');
  const arenaArea    = document.getElementById('arena-area');
  const arenaVS      = document.getElementById('arena-vs');
  const arenaRounds  = document.getElementById('arena-rounds');
  const mvpSelect    = document.getElementById('mvp');
  const penaltyInput = document.getElementById('penalty');
  const btnSave      = document.getElementById('btn-save-match');
  const btnClear     = document.getElementById('btn-clear-arena');
  const leagueSel    = document.getElementById('league');

  // Нові елементи для імпорту PDF
  const pdfInput     = document.getElementById('pdf-upload');
  const btnParsePdf  = document.getElementById('btn-parse-pdf');

  if (!btnStart || !btnSave || !btnClear) {
    console.error('Arena buttons not found');
    return;
  }

  // Налаштовуємо кнопку імпорту PDF
  if (pdfInput && btnParsePdf) {
    btnParsePdf.disabled = true;
    pdfInput.addEventListener('change', () => {
      btnParsePdf.disabled = !pdfInput.files.length;
    });
    btnParsePdf.addEventListener('click', async () => {
      const file = pdfInput.files[0];
      if (!file) {
        alert('Будь ласка, оберіть PDF-файл');
        return;
      }
      try {
        const stats = await parseGamePdf(file);
        // Використовуємо matchId, збережений під час saveResult
        const matchId = window.lastMatchId || Date.now();
        const res = await saveDetailedStats(matchId, stats);
        if (res.trim() === 'OK') {
          alert('Детальна PDF-статистика імпортована!');
        } else {
          alert('Помилка імпорту PDF: ' + res);
        }
      } catch (err) {
        console.error(err);
        alert('Не вдалося розпарсити PDF: ' + err.message);
      }
    });
  }

  // 1) Почати бій
  btnStart.addEventListener('click', () => {
    const sel = Array.from(document.querySelectorAll('.arena-team:checked'))
      .map(cb => parseInt(cb.dataset.team, 10));
    if (sel.length !== 2) {
      alert('Виберіть дві команди для бою');
      return;
    }
    const [a, b] = sel;
    if (!teams[a] || !teams[b]) {
      alert(`Команди ${a} або ${b} не знайдені`);
      return;
    }

    arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
    arenaRounds.innerHTML = '';
    mvpSelect.innerHTML   = '';
    penaltyInput.value    = '';

    // Наповнюємо MVP
    [...teams[a], ...teams[b]].forEach(p => {
      mvpSelect.insertAdjacentHTML('beforeend',
        `<option value="${p.nick}">${p.nick}</option>`
      );
    });

    [a, b].forEach((teamId, idx) => {
      const block = document.createElement('div');
      block.className = 'arena-round-block';
      block.innerHTML = `<h4>Команда ${teamId}</h4>` +
        [1,2,3].map(r => `
          <label>
            <input type="checkbox" class="round-${r}-${idx === 0 ? 'a' : 'b'}">
            Раунд ${r}
          </label>
        `).join('');
      arenaRounds.append(block);
    });

    arenaArea.classList.remove('hidden');
    btnSave.disabled = false;
  });

  // 2) Зберегти гру
  btnSave.addEventListener('click', async () => {
    try {
      const vs = (arenaVS.textContent.match(/\d+/g) || []).map(Number);
      if (vs.length !== 2) throw new Error('Невірне форматування arenaVS');

      let winsA = 0, winsB = 0;
      [1,2,3].forEach(r => {
        if (arenaRounds.querySelector(`.round-${r}-a`)?.checked) winsA++;
        if (arenaRounds.querySelector(`.round-${r}-b`)?.checked) winsB++;
      });
      const series = `${winsA}-${winsB}`;
      const winner = winsA > winsB ? 'team1'
                   : winsB > winsA ? 'team2'
                   : 'tie';

      const data = {
        league: leagueSel.value,
        team1: teams[vs[0]].map(p => p.nick).join(', '),
        team2: teams[vs[1]].map(p => p.nick).join(', '),
        winner,
        mvp: mvpSelect.value,
        series,
        penalties: penaltyInput.value.trim()
      };

      const res = await saveResult(data);
      if (res.trim() !== 'OK') {
        alert('Помилка збереження: ' + res);
        return;
      }

      // Запам'ятовуємо matchId як timestamp
      window.lastMatchId = Date.now();

      const updated = await loadPlayers(leagueSel.value);
      initLobby(updated);
      initScenario();

      alert('Гру збережено та рейтинги оновлено');
      btnClear.click();
    } catch (err) {
      console.error(err);
      alert('Помилка під час збереження гри:\n' + err.message);
    }
  });

  // 3) Скинути арену
  btnClear.addEventListener('click', () => {
    arenaArea.classList.add('hidden');
    arenaRounds.innerHTML = '';
    btnSave.disabled = true;
    document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
  });
});
