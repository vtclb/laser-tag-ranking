import { saveResult } from './api.js';
let currentLeague, teams;

export function initArena(lg, tm){
  currentLeague = lg;
  teams = tm; // обʼєкт {1:[],2:[],…}
  document.getElementById('arena-select').classList.remove('hidden');
}

document.getElementById('btn-start-match').onclick = ()=>{
  const checked = [...document.querySelectorAll('.arena-team-checkbox:checked')];
  if(checked.length!==2) return alert('Оберіть дві команди');
  const t1=+checked[0].dataset.team, t2=+checked[1].dataset.team;
  document.getElementById('arena-vs').textContent=`Команда ${t1} ✕ Команда ${t2}`;
  renderRounds(t1,t2);
  document.getElementById('arena-select').classList.add('hidden');
  document.getElementById('arena-area').classList.remove('hidden');
};

function renderRounds(a,b){
  const ct = document.getElementById('arena-rounds');
  ct.innerHTML='';
  for(let r=1;r<=3;r++){
    const d=document.createElement('div');
    d.innerHTML=`
      <h4>Раунд ${r}</h4>
      <label><input type="checkbox" class="r${r}-a"/> T${a}</label>
      <label><input type="checkbox" class="r${r}-b"/> T${b}</label>
    `;
    ct.append(d);
  }
}

document.getElementById('btn-save-match').onclick = async ()=>{
  // логіка підрахунку wins, збір data, saveResult, clearArena()
};

document.getElementById('btn-clear-arena').onclick = ()=>{/*…*/};
