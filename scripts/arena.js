// scripts/arena.js
import { saveResult } from './api.js';
import { teams }      from './teams.js';

const btnStart    = document.getElementById('btn-start-match');
const arenaArea   = document.getElementById('arena-area');
const arenaVS     = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');
const mvpSelect   = document.getElementById('mvp');
const penaltyInput= document.getElementById('penalty');
const btnSave     = document.getElementById('btn-save-match');
const btnClear    = document.getElementById('btn-clear-arena');
const leagueSel   = document.getElementById('league');

btnStart.onclick = () => {
  const sel = [...document.querySelectorAll('.arena-team:checked')].map(cb => +cb.dataset.team);
  if (sel.length !== 2) return alert('Виберіть дві команди');
  const [a,b] = sel;
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  arenaRounds.innerHTML = '';
  mvpSelect.innerHTML  = '';
  penaltyInput.value   = '';

  // Заповнюємо MVP
  [...teams[a], ...teams[b]].forEach(p => {
    mvpSelect.innerHTML += `<option value="${p.nick}">${p.nick}</option>`;
  });

  // Створюємо по 3 чекбокси-раунди під кожною командою
  [a,b].forEach((id, idx) => {
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

  arenaArea.classList.remove('hidden');
  btnSave.disabled = false;
};

btnSave.onclick = async () => {
  const vs = arenaVS.textContent.match(/\d+/g).map(Number);
  let winsA = 0, winsB = 0;
  [1,2,3].forEach(r => {
    if (arenaRounds.querySelector(`.round-${r}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.round-${r}-b`).checked) winsB++;
  });
  const series  = `${winsA}-${winsB}`;
  const winner  = winsA > winsB ? `team${vs[0]}` : winsB > winsA ? `team${vs[1]}` : 'tie';
  const mvp     = mvpSelect.value;
  const penalty = penaltyInput.value.trim();

  const data = {
    league: leagueSel.value,
    team1: teams[vs[0]].map(p=>p.nick).join(', '),
    team2: teams[vs[1]].map(p=>p.nick).join(', '),
    winner, mvp, series, penalties: penalty
  };

  await saveResult(data);
  alert('Гру збережено');
  btnClear.click();
};

btnClear.onclick = () => {
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  btnSave.disabled = true;
  document.querySelectorAll('.arena-team').forEach(cb => cb.checked = false);
};
