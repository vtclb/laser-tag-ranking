// scripts/arena.js

import { saveResult, loadPlayers } from './api.js';
import { initLobby }               from './lobby.js';
import { initScenario }            from './scenario.js';
import { teams }                   from './teams.js';

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

  // Перевіряємо наявність кнопок
  if (!btnStart || !btnSave || !btnClear) {
    console.error('Arena buttons not found');
    return;
  }

  // 1) Кнопка "Почати бій"
  btnStart.addEventListener('click', () => {
    // Збираємо вибрані команди (dataset.team має містити "1" або "2")
    const sel = Array.from(document.querySelectorAll('.arena-team:checked'))
      .map(cb => parseInt(cb.dataset.team, 10));
    if (sel.length !== 2) {
      return alert('Виберіть дві команди для бою');
    }
    const [a, b] = sel;

    // Переконаємося, що ці індекси є в обʼєкті teams
    if (!teams[a] || !teams[b]) {
      return alert(`Команди ${a} або ${b} не знайдені`);
    }

    // Малюємо заголовок арени
    arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
    arenaRounds.innerHTML = '';
    mvpSelect.innerHTML   = '';
    penaltyInput.value    = '';

    // Заповнюємо список MVP
    teams[a].forEach(p => {
      mvpSelect.insertAdjacentHTML('beforeend',
        `<option value="${p.nick}">${p.nick}</option>`
      );
    });
    teams[b].forEach(p => {
      mvpSelect.insertAdjacentHTML('beforeend',
        `<option value="${p.nick}">${p.nick}</option>`
      );
    });

    // Малюємо 3 раунди під кожну команду
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

  // 2) Кнопка "Зберегти гру"
  btnSave.addEventListener('click', async () => {
    try {
      // Хто грає (з рядка arenaVS)
      const vs = arenaVS.textContent.match(/\d+/g).map(Number);
      if (vs.length !== 2) throw new Error('Невірне форматування arenaVS');

      // Рахуємо виграші
      let winsA = 0, winsB = 0;
      [1,2,3].forEach(r => {
        if (arenaRounds.querySelector(`.round-${r}-a`)?.checked) winsA++;
        if (arenaRounds.querySelector(`.round-${r}-b`)?.checked) winsB++;
      });
      const series = `${winsA}-${winsB}`;

      // *** головне: winner лише "team1" або "team2" ***
      const winner = winsA > winsB ? 'team1'
                   : winsB > winsA ? 'team2'
                   : 'tie';

      // Підготовка даних для бекенду
      const data = {
        league: leagueSel.value,
        team1: teams[vs[0]].map(p => p.nick).join(', '),
        team2: teams[vs[1]].map(p => p.nick).join(', '),
        winner,
        mvp: mvpSelect.value,
        series,
        penalties: penaltyInput.value.trim()
      };

      // Відправка на сервер
      const res = await saveResult(data);
      if (res.trim() !== 'OK') {
        return alert('Помилка збереження: ' + res);
      }

      // Після успіху — оновлюємо лоббі і сценарій
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

  // 3) Кнопка "Скинути арену"
  btnClear.addEventListener('click', () => {
    arenaArea.classList.add('hidden');
    arenaRounds.innerHTML = '';
    btnSave.disabled = true;
    document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
  });
});
