// Quick stats popover
import { log } from './logger.js';
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
  el.innerHTML =
    '<div class="qs-loading"><div></div><div></div><div></div></div>';
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
    if (!data) {
      el.innerHTML = "<p>N/A</p>";
      return;
    }
    const val = (v) =>
      v === undefined || v === null || Number.isNaN(v) || v === "N/A"
        ? "N/A"
        : v;
    const table = data.lastMatches && data.lastMatches.length
      ? `<table><thead><tr><th>Date</th><th>Teams</th><th>Score</th><th>Result</th><th>MVP</th></tr></thead><tbody>` +
        data.lastMatches
          .map(
            (m) =>
              `<tr><td>${m.date}</td><td>${m.teams}</td><td>${m.score}</td><td>${m.result}</td><td>${m.mvp}</td></tr>`
          )
          .join("") +
        "</tbody></table>"
      : "";
    el.innerHTML = `<h4>${nick}</h4>
    <ul>
      <li>Matches: ${val(data.matches)}</li>
      <li>Rounds: ${val(data.rounds)}</li>
      <li>Wins/Losses: ${val(data.wins)}/${val(data.losses)}</li>
      <li>K/D: ${val(data.kd)}</li>
      <li>Accuracy: ${val(data.accuracy)}</li>
      <li>Top teammates: ${data.teammates.length ? data.teammates.join(", ") : "N/A"}</li>
    </ul>
    ${table}
    <button id="qs-open">Profile</button>`;
    document.getElementById("qs-open").addEventListener("click", () => {
      window.location.href = `profile.html?nick=${encodeURIComponent(nick)}`;
    });
  };

  const key = `quickStats:${nick}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const obj = JSON.parse(cached);
      if (Date.now() - obj.ts < 6 * 60 * 60 * 1000) {
        render(obj.data);
        return;
      }
    }
  } catch (e) {
    log('[ranking]', e);
  }

  try {
    const txt = await fetch(GAMES_URL).then((r) => r.text());
    const rows = Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    const data = computeStats(rows, nick);
    render(data);
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      log('[ranking]', e);
    }
  } catch (err) {
    log('[ranking]', err);
    if (typeof showToast === 'function') showToast('Не вдалося завантажити статистику');
    render(null);
  }
}

function computeStats(rows, nick) {
  let matches = 0;
  let rounds = 0;
  let wins = 0;
  let losses = 0;
  let kills = 0;
  let deaths = 0;
  let valid = true;
  const mates = {};
  const recent = [];
  rows.forEach((g) => {
    const t1 = (g.Team1 || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const t2 = (g.Team2 || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let team, opp;
    if (t1.includes(nick)) {
      team = t1;
      opp = t2;
    } else if (t2.includes(nick)) {
      team = t2;
      opp = t1;
    } else return;
    matches++;
    team.forEach((n) => {
      if (n !== nick) mates[n] = (mates[n] || 0) + 1;
    });
    const s1 = parseInt(g.Score1, 10);
    const s2 = parseInt(g.Score2, 10);
    const winner = g.Winner;
    if (!isNaN(s1) && !isNaN(s2)) {
      rounds += s1 + s2;
      if (team === t1) {
        kills += s1;
        deaths += s2;
      } else {
        kills += s2;
        deaths += s1;
      }
    } else {
      valid = false;
    }
    let result = "N/A";
    if (winner === "team1" || winner === "team2") {
      const pt = team === t1 ? "team1" : "team2";
      if (winner === pt) {
        wins++;
        result = "Win";
      } else {
        losses++;
        result = "Loss";
      }
    } else {
      valid = false;
    }
    const ts = new Date(g.Timestamp).getTime();
    recent.push({
      ts,
      date: g.Timestamp || "N/A",
      teams: `${t1.join(", ")} vs ${t2.join(", ")}`,
      score: !isNaN(s1) && !isNaN(s2) ? `${s1}-${s2}` : "N/A",
      result,
      mvp: g.MVP || "N/A",
    });
  });
  const kd =
    !valid || deaths === 0
      ? valid && kills > 0 && deaths === 0
        ? "Inf"
        : "N/A"
      : (kills / deaths).toFixed(2);
  const accuracy =
    !valid || kills + deaths === 0
      ? "N/A"
      : ((kills / (kills + deaths)) * 100).toFixed(2) + "%";
  recent.sort((a, b) => b.ts - a.ts);
  return {
    matches: valid ? matches : "N/A",
    rounds: valid ? rounds : "N/A",
    wins: valid ? wins : "N/A",
    losses: valid ? losses : "N/A",
    kd,
    accuracy,
    teammates: Object.entries(mates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([n, c]) => `${n} (${c})`),
    lastMatches: recent.slice(0, 5).map(({ ts, ...rest }) => rest),
  };
}

window.showQuickStats = showQuickStats;
