window.addEventListener('DOMContentLoaded', ()=>{
  const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
  const makeCsvUrl = league => `${proxyUrl}?league=${league}&t=${Date.now()}`;

  let players=[], selected=[], lobby=[];
  let manualMode=false;
  let combos=[], comboIndex=0;
  let team1=[], team2=[];

  const
    btnLoad   = $('#btn-load'),
    selectA   = $('#select-area'), listS = $('#select-list'),
    btnAddSel = $('#btn-add-selected'), btnClearSel = $('#btn-clear-selected'),
    lobbyA    = $('#lobby-area'), listL = $('#lobby-list'),
    cntEl     = $('#lobby-count'), sumEl = $('#lobby-sum'), avgEl = $('#lobby-avg'),
    btnClearL = $('#btn-clear-lobby'),
    ctrlA     = $('#control-area'),
    btnAuto   = $('#btn-auto'), btnManual = $('#btn-manual'), sizeSel = $('#teamsize'),
    teamsA    = $('#teams-area'), t1List = $('#team1-list'), t2List = $('#team2-list'),
    t1Sum     = $('#team1-sum'), t2Sum = $('#team2-sum'),
    resA      = $('#result-area'), selWin = $('#winner'), selMvp = $('#mvp'), penInp = $('#penalties'),
    btnSave   = $('#btn-save'), btnRef = $('#btn-refresh');

  function $(id){return document.getElementById(id.slice(1))}

  // Load players
  btnLoad.onclick = ()=>{
    fetch(makeCsvUrl($('#league').value))
      .then(r=>r.text())
      .then(txt=>{
        players = txt.trim().split('\n').slice(1).map(l=>{
          const [,, nick, pts] = l.match(/^([^,]*),([^,]*),([^,]*),?(.*)$/) || [];
          const p=parseInt(pts)||0, rank=p<200?'D':p<500?'C':p<800?'B':p<1200?'A':'S';
          return {nick:nick.trim(),pts:p,rank};
        });
        selected=[]; lobby=[];
        renderSelect();
      });
  };

  function renderSelect(){
    selectA.style.display='block'; ctrlA.style.display='none'; teamsA.style.display='none'; resA.style.display='none';
    listS.innerHTML = players.map((p,i)=>
      `<li><label><input type=checkbox data-i=${i}> ${p.nick} (${p.pts})–${p.rank}</label></li>`
    ).join('');
    listS.querySelectorAll('input').forEach(cb=>cb.onchange=e=>{
      const p=players[e.target.dataset.i];
      selected = e.target.checked ? [...selected,p] : selected.filter(x=>x!==p);
    });
  }

  btnAddSel.onclick = ()=>{ lobby=[...lobby,...selected.filter(p=>!lobby.includes(p))]; renderLobby(); }
  btnClearSel.onclick = ()=>{ selected=[]; listS.querySelectorAll('input').forEach(cb=>cb.checked=false); }

  function renderLobby(){
    lobbyA.style.display='block'; ctrlA.style.display='flex'; selectA.style.display='none';
    teamsA.style.display='none'; resA.style.display='none';
    listL.innerHTML = lobby.map(p=>
      `<li>${p.nick} (${p.pts})–${p.rank}</li>`
    ).join('');
    const total = lobby.reduce((s,p)=>s+p.pts,0);
    cntEl.textContent=lobby.length; sumEl.textContent=total; avgEl.textContent=lobby.length?(total/lobby.length).toFixed(1):0;
    team1=[]; team2=[]; combos=[]; comboIndex=0;
  }

  btnClearL.onclick = ()=>{ lobby=[]; renderLobby(); }

  // Авто-баланс з циклом
  btnAuto.onclick = ()=>{
    manualMode=false; teamsA.style.display='block'; resA.style.display='none';
    let subset = [...lobby]; if(sizeSel.value!=='all') subset=subset.slice(0, +sizeSel.value*2);
    // зібрати мінімальні розбивки
    combos=[]; let md=Infinity; const tot=1<<subset.length;
    for(let m=1;m<tot-1;m++){const a=[],b=[]; subset.forEach((p,i)=>(m&(1<<i)?a:b).push(p));
      if(Math.abs(a.length-b.length)>1) continue;
      const d=Math.abs(sum(a)-sum(b));
      if(d<md){md=d; combos=[]; combos.push({t1:a,t2:b});}
      else if(d===md) combos.push({t1:a,t2:b});
    }
    // якщо одна комбінація — додати повернення
    if(combos.length===1){const c=combos[0]; combos.push({t1:c.t2,t2:c.t1});}
    // обрати наступну
    const c = combos[comboIndex % combos.length]; comboIndex++;
    displayTeams(c.t1,c.t2);
  };

  // Ручне формування
  btnManual.onclick = ()=>{
    manualMode=true; teamsA.style.display='block'; resA.style.display='none';
    t1List.innerHTML=''; t2List.innerHTML=''; t1Sum.textContent=0; t2Sum.textContent=0;
    // кожен гравець в лоббі отримує кнопки для розміщення
    listL.querySelectorAll('li').forEach((li,i)=>{
      const p=lobby[i];
      li.innerHTML = `${p.nick} (${p.pts})–${p.rank}`+
        ` <button data-act="1" data-i="${i}">→1</button>`+
        ` <button data-act="2" data-i="${i}">→2</button>`;
    });
    listL.querySelectorAll('button').forEach(b=>b.onclick=e=>{
      const idx=+e.target.dataset.i, act=e.target.dataset.act;
      const p=lobby[idx];
      // видалити з лоббі та додати в обрану команду
      lobby= lobby.filter(x=>x!==p);
      if(act==='1') team1.push(p); else team2.push(p);
      renderLobby(); renderTeams();
    });
  };

  function displayTeams(a,b){ team1=a; team2=b; renderTeams(); }
  function renderTeams(){
    t1List.innerHTML=team1.map(p=>`<li>${p.nick} (${p.pts})<button data-t="1" data-i="${team1.indexOf(p)}">×</button></li>`).join('');
    t2List.innerHTML=team2.map(p=>`<li>${p.nick} (${p.pts})<button data-t="2" data-i="${team2.indexOf(p)}">×</button></li>`).join('');
    t1Sum.textContent=sum(team1); t2Sum.textContent=sum(team2);
    // видалити з команди
    document.querySelectorAll('.team-box button').forEach(b=>{
      const t=b.dataset.t, i=+b.dataset.i;
      b.onclick=()=>{
        const p = t==='1'?team1.splice(i,1)[0]:team2.splice(i,1)[0]; lobby.push(p);
        renderLobby(); renderTeams();
      };
    });
    // оновити MVP
    selMvp.innerHTML=[...team1,...team2].map(p=>`<option>${p.nick}</option>`).join('');
    resA.style.display='none';
  }

  // збирає і зберігає
  btnSave.onclick = ()=>{
    const data = {
      league: $('#league').value,
      team1: team1.map(p=>p.nick).join(', '),
      team2: team2.map(p=>p.nick).join(', '),
      winner: selWin.value,
      mvp: selMvp.value,
      penalties: penInp.value
    };
    const body = Object.entries(data).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    fetch(proxyUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
      .then(r=>r.text()).then(t=>alert(t)).then(()=>btnLoad.click());
  };
  btnRef.onclick = ()=>btnLoad.click();

  function sum(arr){return arr.reduce((s,p)=>s+p.pts,0);}
});
