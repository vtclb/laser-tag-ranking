// Quick stats popover
import { log } from './logger.js';
import { safeGet, safeSet } from './api.js';
const STYLE_ID = "quick-stats-style";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
  #quick-stats{position:absolute;min-width:200px;background:#222;color:#fff;border:2px solid #f39c12;border-radius:4px;padding:0.5rem;font-size:0.75rem;z-index:10000;}
  #quick-stats.bottom{left:0;right:0;bottom:0;top:auto;width:auto;margin:0;position:fixed;}
  #quick-stats h4{margin-bottom:0.5rem;}
  #quick-stats ul{list-style:none;padding:0;margin:0;}
  #quick-stats li{margin:0.25rem 0;}
  #quick-stats button{margin-top:0.5rem;padding:0.25rem 0.5rem;background:#444;border:1px solid #f39c12;color:#f39c12;font-family:inherit;cursor:pointer;}
  #quick-stats table{width:100%;border-collapse:collapse;margin-top:0.5rem;}
  #quick-stats th,#quick-stats td{border:1px solid #f39c12;padding:0.25rem;text-align:center;}
  .qs-loading{display:flex;gap:4px;justify-content:center;}
  .qs-loading div{width:6px;height:6px;background:#f39c12;animation:qs-blink 1s infinite;}
  .qs-loading div:nth-child(2){animation-delay:0.2s;}
  .qs-loading div:nth-child(3){animation-delay:0.4s;}
  @keyframes qs-blink{0%,80%,100%{opacity:0;}40%{opacity:1;}}
  `;
  document.head.appendChild(style);
}

const GAMES_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv";

export async function showQuickStats(nick, evt) {
  const existing = document.getElementById("quick-stats");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "quick-stats";
  const loading = document.createElement('div');
  loading.className = 'qs-loading';
  for (let i = 0; i < 3; i++) loading.appendChild(document.createElement('div'));
  el.appendChild(loading);
  if (window.matchMedia("(pointer:coarse)").matches) {
    el.classList.add("bottom");
  } else {
    el.style.left = evt.clientX + 10 + "px";
    el.style.top = evt.clientY + 10 + "px";
  }
  document.body.appendChild(el);
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onDoc, true);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  const onDoc = (e) => {
    if (!el.contains(e.target)) close();
  };
  setTimeout(() => document.addEventListener("click", onDoc, true));
  document.addEventListener("keydown", onKey);

  const render = (data) => {
    el.replaceChildren();
    if (!data) {
      const p = document.createElement('p');
      p.textContent = 'N/A';
      el.appendChild(p);
      return;
    }
    const val = (v) =>
      v === undefined || v === null || Number.isNaN(v) || v === "N/A"
        ? "N/A"
        : v;
    const winsLosses =
      val(data.wins) === "N/A" || val(data.losses) === "N/A"
        ? "N/A"
        : `${val(data.wins)}/${val(data.losses)}`;

    const h4 = document.createElement('h4');
    h4.textContent = nick;
    el.appendChild(h4);

    const ul = document.createElement('ul');
    [
      `Last on: ${val(data.lastOn)}`,
      `Matches: ${val(data.matches)}`,
      `Rounds: ${val(data.rounds)}`,
      `Wins/Losses: ${winsLosses}`,
      `K/D: ${val(data.kd)}`,
      `Accuracy: ${val(data.accuracy)}`,
    ].forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    el.appendChild(ul);

    const btn = document.createElement('button');
    btn.id = 'qs-open';
    btn.textContent = 'Profile';
    btn.addEventListener('click', () => {
      window.location.href = `profile.html?nick=${encodeURIComponent(nick)}`;
    });
    el.appendChild(btn);
  };

  const key = `quickStats:${nick}`;
  const cached = safeGet(localStorage, key);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (Date.now() - obj.ts < 6 * 60 * 60 * 1000) {
        render(obj.data);
        return;
      }
    } catch (e) {
      log('[ranking]', e);
    }
  }

  try {
    const txt = await fetch(GAMES_URL).then((r) => r.text());
    const rows = Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    const data = computeStats(rows, nick);
    render(data);
    safeSet(localStorage, key, JSON.stringify({ ts: Date.now(), data }));
  } catch (err) {
    log('[ranking]', err);
    const msg = 'Не вдалося завантажити статистику';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    render(null);
  }
}

function computeStats(games, nick) {
  const normNick = String(nick || '').trim();
  if (!normNick) return null;

  const getVal = (row, keys) => {
    for (const k of keys) {
      if (row && row[k] != null && row[k] !== '') return row[k];
      const lk = String(k).toLowerCase();
      for (const rk in row) {
        if (String(rk).toLowerCase() === lk && row[rk] != null && row[rk] !== '') return row[rk];
      }
    }
    return '';
  };

  const parseList = (v) => String(v || '')
    .replace(/\r?\n/g, ',')
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);

  let matches = 0, wins = 0, losses = 0, draws = 0;
  let rounds = 0;
  let lastOn = null;

  for (const g of (games || [])) {
    const teams = {
      team1: parseList(getVal(g, ['team1','Team1','team 1','Team 1'])),
      team2: parseList(getVal(g, ['team2','Team2','team 2','Team 2'])),
      team3: parseList(getVal(g, ['team3','Team3','team 3','Team 3'])),
      team4: parseList(getVal(g, ['team4','Team4','team 4','Team 4']))
    };

    const inAnyTeam = Object.values(teams).some(arr => arr.includes(normNick));
    const isMvp = [getVal(g, ['mvp','MVP','mvp1']), getVal(g, ['mvp2','MVP2']), getVal(g, ['mvp3','MVP3'])]
      .map(x => String(x || '').trim())
      .includes(normNick);

    if (!inAnyTeam && !isMvp) continue;

    matches += 1;

    const tsRaw = getVal(g, ['timestamp','Timestamp','time','Time']);
    if (tsRaw) {
      const d = new Date(tsRaw);
      if (!isNaN(d)) {
        if (!lastOn || d > lastOn) lastOn = d;
      }
    }

    // rounds: якщо є Score1/Score2 (старий формат) – рахуємо; якщо нема – лишаємо null
    const s1 = Number(getVal(g, ['score1','Score1']));
    const s2 = Number(getVal(g, ['score2','Score2']));
    if (!isNaN(s1) && !isNaN(s2) && (s1 || s2)) rounds += (s1 + s2);

    const winner = String(getVal(g, ['winner','Winner'])).trim().toLowerCase();

    if (!winner || winner === 'n/a') continue;

    if (winner === 'tie' || winner === 'draw') {
      draws += 1;
      continue;
    }

    // переможець як ключ команди (team1/team2/team3/team4)
    if (teams[winner] && teams[winner].includes(normNick)) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  const winRate = matches ? (wins / matches) : 0;

  return {
    lastOn,
    matches,
    rounds: rounds || null,
    wins,
    losses,
    draws,
    winRate,
    kd: null,
    accuracy: null
  };
}

window.showQuickStats = showQuickStats;
