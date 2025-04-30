// scripts/arena.js

import { saveResult, loadPlayers } from './api.js';
import { initLobby }               from './lobby.js';
import { initScenario }            from './scenario.js';
import { teams }                   from './teams.js';

// Зачекаємо, поки DOM завантажиться
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

  if (!btnStart || !btnSave || !btnClear) {
    console.error('Не знайдено обовʼязкові кнопки арени');
    return;
  }

  btnStart.addEventListener('click', () => {
    // 1) Збір відмічених команд
    const sel = [...document.querySelectorAll('.arena-team:checked')]
      .map(cb => +cb.dataset.team);
    console.log('Start clicked, selected teams:', sel);

    if (sel.length !== 2) {
      return alert('Виберіть дві команди для бою');
    }
    const [a, b] = sel;

    // 2) Перевіряємо, чи є такі команди
    if (!teams[a] || !teams[b]) {
      return alert(`Команди ${a} або ${b} не знайдені в обʼєкті teams`);
    }

    // 3) Малюємо заголовок арени
    arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
    arenaRounds.innerHTML = '';
    mvpSelect.innerHTML   = '';
    penaltyInput.value    = '';

    // 4) Заповнюємо випадачку MVP
    [...teams[a], ...teams[b]].forEach(p => {
      mvpSelect.insertAdjacentHTML('beforeend',
        `<option value="${p.nick}">${p.nick}</option>`
      );
    });

    // 5) Створюємо чекбокси раундів
    [a, b].forEach((id, idx) => {
      const div = document.createElement('div');
      div.innerHTML = `<h4>Команда ${id}</h4>` +
        [1,2,3].map(r => `
          <label>
            <input type="checkbox" class="round-${r}-${idx?'b':'a'}">
            Раунд ${r}
          </label>
        `).join('');
      arenaRounds.append(div);
    });

    // 6) Показуємо арену
    arenaArea.classList.remove('hidden');
    btnSave.disabled = false;
  });

  btnSave.addEventListener('click', async () => {
    try {
      // 1) Парсимо хто грає
      const vs = arenaVS.textContent.match(/\d+/g).map(Number);
      console.log('Save clicked, arenaVS vs=', vs);
      if (vs.length !== 2) throw new Error('Невірне arenaVS');

      // 2) Рахуємо wins
      let winsA = 0, winsB = 0;
      [1,2,3].forEach(r => {
        if (arenaRounds.querySelector(`.round-${r}-a`)?.checked) winsA++;
        if (arenaRounds.querySelector(`.round-${r}-b`)?.checked) winsB++;
      });
      const series = `${winsA}-${winsB}`;
      const winner = winsA > winsB
        ? `team${vs[0]}`
        : winsB > winsA
          ? `team${vs[1]}`
          : 'tie';
      console.log('Calculated series, winner=', series, winner);

      // 3) Формуємо data
      const data = {
        league: leagueSel.value,
        team1: teams[vs[0]].map(p=>p.nick).join(', '),
        team2: teams[vs[1]].map(p=>p.nick).join(', '),
        winner,
        mvp: mvpSelect.value,
        series,
        penalties: penaltyInput.value.trim()
      };
      console.log('Sending data to saveResult:', data);

      // 4) Відправка
      const res = await saveResult(data);
      console.log('saveResult response:', res);

      if (res.trim() !== 'OK') {
        return alert('Помилка збереження: ' + res);
      }

      // 5) Оновлюємо лоббі та сценарій
      const updated = await loadPlayers(leagueSel.value);
      initLobby(updated);
      initScenario();

      alert('Гру збережено та рейтинги оновлено');
      btnClear.click();
    } catch (err) {
      console.error(err);
      alert('Помилка в арені: ' + err.message);
    }
  });

  btnClear.addEventListener('click', () => {
    arenaArea.classList.add('hidden');
    arenaRounds.innerHTML = '';
    btnSave.disabled = true;
    document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
  });
});
