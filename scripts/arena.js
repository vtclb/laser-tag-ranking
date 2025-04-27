import { saveResult } from './api.js';
import { teams }      from './teams.js';

const btnStart  = document.getElementById('btn-start-match');
const arenaArea = document.getElementById('arena-area');
const arenaVS   = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');
const btnSave   = document.getElementById('btn-save-match');
const btnClear  = document.getElementById('btn-clear-arena');
const leagueSel = document.getElementById('league');

btnStart.onclick = ()=>{
  const checked = [...document.querySelectorAll('.arena-team:checked')].map(cb=>+cb.dataset.team);
  const [a,b] = checked;
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  arenaArea.classList.remove('hidden');
  arenaRounds.innerHTML = '';
  [a,b].forEach((id,idx)=>{
    const div = document.createElement('div');
    div.innerHTML = `<h4>Команда ${id}</h4>`;
    [1,2,3].forEach(r=>{
      div.innerHTML += `<label><input type="checkbox" class="round-${r}-${idx===0?'a':'b'}"> Раунд ${r}</label>`;
    });
    arenaRounds.append(div);
  });
  btnSave.disabled = false;
};

btnSave.onclick = async ()=>{
  const vs = arenaVS.textContent.match(/\d+/g).map(Number);
  let winsA=0, winsB=0;
  [1,2,3].forEach(r=>{
    if(arenaRounds.querySelector(`.round-${r}-a`).checked) winsA++;
    if(arenaRounds.querySelector(`.round-${r}-b`).checked) winsB++;
  });
  const series = `${winsA}-${winsB}`;
  const winner = winsA>winsB?`team${vs[0]}`:winsB>winsA?`team${vs[1]}`:'tie';
  await saveResult({
    league: leagueSel.value,
    team1: teams[vs[0]].map(p=>p.nick).join(', '),
    team2: teams[vs[1]].map(p=>p.nick).join(', '),
    winner, mvp:'', series, penalties:''
  });
  alert('Гру збережено');
  btnClear.click();
};

btnClear.onclick = ()=>{
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  btnSave.disabled = true;
  document.querySelectorAll('.team-select, .arena-team').forEach(cb=>cb.checked=false);
};
