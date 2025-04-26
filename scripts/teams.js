import { lobby } from './lobby.js';

const teamsArea = document.getElementById('teams-area');
let teams = {};

export function initTeams(N){
  teams = {};
  for(let k=1;k<=N;k++) teams[k]=[];
  renderTeams(N);
}

function renderTeams(N){
  teamsArea.innerHTML=''; teamsArea.classList.remove('hidden');
  teamsArea.style.gridTemplateColumns=`repeat(${N},1fr)`;
  for(let k=1;k<=N;k++){
    const box=document.createElement('div');
    box.className='card';
    box.innerHTML=`<h3>Команда ${k}</h3><ul id="team${k}-list"></ul>`;
    teamsArea.append(box);
    const ul=box.querySelector('ul');
    teams[k].forEach((p,i)=>appendPlayer(ul,p,k,i));
  }
}

function appendPlayer(ul,p,teamId,idx){
  const li=document.createElement('li');
  li.innerHTML=`
    ${p.nick} (${p.pts})
    <button class="remove-team" data-team="${teamId}" data-index="${idx}">X</button>
    <button class="swap-team" data-from="${teamId}" data-to="${teamId===1?2:1}" data-index="${idx}">→</button>
  `;
  ul.append(li);
}

teamsArea.addEventListener('click',e=>{
  if(e.target.matches('.remove-team')){
    const t=+e.target.dataset.team, i=+e.target.dataset.index;
    const p=teams[t].splice(i,1)[0]; if(!lobby.includes(p)) lobby.push(p);
    renderTeams(Object.keys(teams).length);
  }
  if(e.target.matches('.swap-team')){
    const from=+e.target.dataset.from, to=+e.target.dataset.to;
    const i=+e.target.dataset.index;
    const p=teams[from].splice(i,1)[0];
    teams[to].push(p);
    renderTeams(Object.keys(teams).length);
  }
});
