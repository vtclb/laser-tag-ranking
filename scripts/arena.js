// scripts/arena.js

import { saveResult, loadPlayers } from './api.js';
import { initLobby }               from './lobby.js';
import { initScenario }            from './scenario.js';
import { teams }                   from './teams.js';

const btnStart    = document.getElementById('btn-start-match');
const arenaArea   = document.getElementById('arena-area');
const arenaVS     = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');
const mvpSelect   = document.getElementById('mvp');
const penaltyInput= document.getElementById('penalty');
const btnSave     = document.getElementById('btn-save-match');
const btnClear    = document.getElementById('btn-clear-arena');
const leagueSel   = document.getElementById('league');

/** Формуємо арену та чекбокси раундів */
btnStart.onclick = () => {
  const sel = [...document.querySelectorAll('.arena-team:checked')]
    .map(cb => +cb.dataset.team);
  if (sel.length !== 2) {
    alert('Виберіть дві команди для бою');
    return;
  }
  const [a, b] = sel;
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  arenaRounds.innerHTML = '';
  mvpSelect.innerHTML   = '';
  penaltyInput.value    = '';

  // Заповнюємо MVP варіанти
  [...teams[a], ...teams[b]].forEach(p => {
    mvpSelect.insertAdjacentHTML('beforeend',
      `<option value="${p.nick}">${p.nick}</option>`
    );
  });

  // Малюємо по 3 чекбокси-раунди під кожною командою
  [a, b].forEach((id, idx) => {
    const div = document.createElement('div');
    div.innerHTML = `<h4>Команда ${id}</h4>` +
      [1, 2, 3].map(r => `
        <label>
          <input type="checkbox" class="round-${r}-${idx?'b':'a'}">
          Раунд ${r}
        </label>
      `).join('');
    arenaRounds.append(div);
  });

  arenaArea.classList.remove('hidden');
  btnSave.disabled = false;
};

/** Зберігаємо гру, оновлюємо рейтинг і перезавантажуємо лоббі/сценарій */
btnSave.onclick = async () => {
  // 1) Збираємо результати раундів
  const vs = arenaVS.textContent.match(/\d+/g).map(Number);
  let winsA = 0, winsB = 0;
  [1, 2, 3].forEach(r => {
    if (arenaRounds.querySelector(`.round-${r}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.round-${r}-b`).checked) winsB++;
  });
  const series = `${winsA}-${winsB}`;
  const winner = winsA > winsB
    ? `team${vs[0]}`
    : winsB > winsA
      ? `team${vs[1]}`
      : 'tie';

  // 2) Готуємо об’єкт для API
  const data = {
    league: leagueSel.value,
    team1: teams[vs[0]].map(p => p.nick).join(', '),
    team2: teams[vs[1]].map(p => p.nick).join(', '),
    winner,
    mvp: mvpSelect.value,
    series,
    penalties: penaltyInput.value.trim()
  };

  // 3) Відправляємо на сервер
  const res = await saveResult(data);
  if (res.trim() !== 'OK') {
    alert('Помилка збереження: ' + res);
    return;
  }

  // 4) Після успішного запису — оновлюємо лоббі й сценарій
  const updatedPlayers = await loadPlayers(leagueSel.value);
  initLobby(updatedPlayers);
  initScenario();

  alert('Гру збережено та рейтинги оновлено');

  // 5) Очищуємо арену
  btnClear.click();
};

/** Скидаємо арену без втрати лоббі */
btnClear.onclick = () => {
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  btnSave.disabled = true;
  document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
};
