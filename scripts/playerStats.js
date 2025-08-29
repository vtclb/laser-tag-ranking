import { log } from './logger.js';
import { fetchPlayerStats } from './api.js';

function init(){
  const modal = document.getElementById('stats-modal');
  const body  = document.getElementById('stats-body');
  const close = document.getElementById('stats-close');
  if(!modal || !body || !close) return;
  const hide=()=>modal.classList.add('hidden');
  close.addEventListener('click', hide);
  modal.addEventListener('click', e=>{ if(e.target===modal) hide(); });

  window.loadStats = async function(nick){
    modal.classList.remove('hidden');
    body.textContent = 'Loading...';
    try{
      const rows = await fetchPlayerStats(nick);
      body.innerHTML = `<h3 style="text-align:center">${nick}</h3>`;
      if(!rows.length){
        body.innerHTML += '<p>Статистика відсутня</p>';
        return;
      }
      const table = document.createElement('table');
      table.style.width='100%';
      table.innerHTML='<thead><tr><th>Match</th><th>Kills</th><th>Deaths</th><th>Shots</th><th>Hits</th><th>Acc</th></tr></thead>';
      const tb = document.createElement('tbody');
      rows.forEach(r=>{
        const tr=document.createElement('tr');
        [0,2,3,4,5,6].forEach(i=>{const td=document.createElement('td');td.textContent=r[i];tr.appendChild(td);});
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      body.appendChild(table);
    }catch(err){
      log('[ranking]', err);
      const msg = 'Помилка завантаження';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
      body.textContent='Помилка завантаження';
    }
  };
}

document.addEventListener('DOMContentLoaded', init);
