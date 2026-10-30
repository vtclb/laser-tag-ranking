import { parseHalloween } from '../core/halloween.js';
const source = new URL('../data/events/halloween-2026.json',import.meta.url);
const node = (tag, text, className) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(className)e.className=className;return e;};
function statistic(label,value){const e=node('span');e.append(node('b',value),document.createTextNode(' '+label));return e;}
function participant(p){
 const row=node('details',undefined,'halloween-player'),summary=node('summary');
 const identity=node('span',undefined,'halloween-identity');
 if(p.avatarUrl){const img=node('img');img.src=p.avatarUrl;img.alt='';img.width=44;img.height=44;img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});identity.append(img);}
 identity.append(node('b',p.nickname));summary.append(node('span',p.place,'halloween-place'),identity,node('strong',`${p.points} очок`));
 const detail=node('div',undefined,'halloween-player-detail');
 const stats=node('div',undefined,'halloween-stats');stats.append(statistic('фігурок',p.figureCount),statistic('видів',p.kinds),statistic('комплектів',p.fullSets),statistic('артефактів',p.artifacts.length),statistic('монет',p.coinBalance),statistic('перемог',p.wins));detail.append(stats);
 const figures=node('ul');Object.entries(p.figures).forEach(([kind,count])=>figures.append(node('li',`${kind}: ${count}`)));detail.append(node('h2','Колекція'),figures,node('p',`Артефакти: ${p.artifacts.join(', ')||'немає'}`),node('p',`Відзнаки: ${p.awards.join(', ')||'не присуджено'}`));
 if(p.profileUrl){const a=node('a','Основний профіль VARTA ↗','btn');a.href=p.profileUrl;detail.append(a);}else detail.append(node('p','Гість цієї події'));
 row.append(summary,detail);return row;
}
export async function initHalloweenPage(){
 const root=document.getElementById('halloweenRoot');if(!root)return;
 if(!document.getElementById('halloween-css')){const css=node('link');css.id='halloween-css';css.rel='stylesheet';css.href=new URL('../styles/halloween.css',import.meta.url);document.head.append(css);}
 const heading=node('header',undefined,'halloween-heading');const logo=node('img');logo.src=new URL('../assets/halloween-varta.png',import.meta.url);logo.width=48;logo.height=48;logo.alt='ВАРТА';
 const titles=node('div');titles.append(node('p','ОКРЕМА СЦЕНАРНА ПОДІЯ'),node('h1','HALLOWEEN 2026'));heading.append(logo,titles);
 const intro=node('p','Фігурки, артефакти, випробування та нагороди. Ці очки не змінюють рейтинги лазертагу, ранги S–F або статистику матчів.');
 const status=node('p','Завантажуємо результати…','halloween-status');status.setAttribute('role','status');
 const controls=node('div',undefined,'halloween-controls'),search=node('input');search.type='search';search.placeholder='Нікнейм';search.setAttribute('aria-label','Знайти учасника Halloween');const retry=node('button','Оновити результати','btn');retry.type='button';controls.append(search,retry);
 const list=node('div',undefined,'halloween-results');root.replaceChildren(heading,intro,status,controls,list);let data=null;
 const render=()=>{const q=search.value.trim().toLocaleLowerCase('uk');const players=(data?.players||[]).filter(p=>p.nickname.toLocaleLowerCase('uk').includes(q));list.replaceChildren(...players.map(participant));if(!players.length)list.append(node('p',q?'За цим ніком нікого не знайдено.':'Результати ще не опубліковані. Фінальних місць і нагород поки немає.'));};
 async function load(){retry.disabled=true;try{const response=await fetch(source,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.text();if(raw.length>2_000_000)throw Error('Завеликий файл події');const next=parseHalloween(JSON.parse(raw));if(!root.isConnected)return;data=next;status.textContent=next.status==='pending'?'Очікуємо підтверджені результати події.':`${next.status==='final'?'Фінальні':'Поточні'} результати · версія ${next.revision}${next.preliminaryFormula?' · Формула попередня':''}`;render();}catch{if(root.isConnected){status.textContent=data?'Не вдалося оновити. Показано попередньо завантажені результати.':'Результати тимчасово недоступні. Спробуйте оновити.';if(!data)list.replaceChildren();}}finally{retry.disabled=false;}}
 search.addEventListener('input',render);retry.addEventListener('click',load);await load();
}
