import { log } from './logger.js?v=2025-09-18-3';
import { fetchPlayerStats } from './api.js?v=2025-09-18-3';

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
      body.replaceChildren();
      const h3 = document.createElement('h3');
      h3.style.textAlign = 'center';
      h3.textContent = nick;
      body.appendChild(h3);
      if(!rows.length){
        const p = document.createElement('p');
        p.textContent = 'Статистика відсутня';
        body.appendChild(p);
        return;
      }
      const table = document.createElement('table');
      table.style.width='100%';
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      ['Match','Kills','Deaths','Shots','Hits','Acc'].forEach(text=>{
        const th = document.createElement('th');
        th.textContent = text;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);
      const tb = document.createElement('tbody');
      rows.forEach(r=>{
        const tr=document.createElement('tr');
        [0,2,3,4,5,6].forEach(i=>{
          const td=document.createElement('td');
          td.textContent=r[i];
          tr.appendChild(td);
        });
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
