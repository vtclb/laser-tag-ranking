// Список CSV-лінків ліг
const sheetUrls = {
  kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};


let players = [];
let lobbyPlayers = [];

function loadPlayers() {
  const league = document.getElementById("league").value;
  fetch(sheetUrls[league])
    .then(res => res.text())
    .then(data => {
      const rows = data.split("\n").slice(1);
      players = rows.map(row => {
        const cols = row.includes(",") ? row.split(",") : row.split(";");
        return { nickname: cols[1]?.trim(), points: parseInt(cols[2]) };
      }).filter(p => p.nickname && !isNaN(p.points));
      displayPlayers();
      // Копіюємо ті ж елементи для DnD
      document.getElementById("players-list-dnd").innerHTML = document.getElementById("players-list").innerHTML;
    })
    .catch(err => alert("Помилка при завантаженні гравців: " + err));
}

function displayPlayers() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців для лоббі:</h3>" +
    players.map((p, i) =>
      `<label style="display:block; margin:3px 0;"><input type="checkbox" value="${i}" onchange="updateLobby()"> ${p.nickname} (${p.points})</label>`
    ).join("");
}

function updateLobby() {
  lobbyPlayers = Array.from(
    document.querySelectorAll("#players-list input:checked")
  ).map(cb => players[+cb.value]);
  document.getElementById("lobby").textContent = lobbyPlayers.map(p => `${p.nickname} (${p.points})`).join(", ");
}

function autoBalance() {
  const teamCount = +document.getElementById("team-count").value;
  if (lobbyPlayers.length < teamCount) return alert(`Недостатньо гравців для ${teamCount} команд.`);
  if (teamCount !== 2) return alert("Реалізовано тільки для 2 команд.");
  const best = getBestBalanceForTwoTeams(lobbyPlayers);
  displayTeams(best);
}

function getBestBalanceForTwoTeams(arr) {
  let minDiff = Infinity, best;
  const total = 1 << arr.length;
  for (let mask=1; mask<total-1; mask++) {
    const t1 = [], t2 = [];
    for (let j=0; j<arr.length; j++) {
      (mask & (1<<j)) ? t1.push(arr[j]) : t2.push(arr[j]);
    }
    if (Math.abs(t1.length - t2.length)>1) continue;
    const s1 = t1.reduce((s,p)=>s+p.points,0), s2 = t2.reduce((s,p)=>s+p.points,0);
    const diff = Math.abs(s1-s2);
    if (diff<minDiff) { minDiff=diff; best={team1:t1,team2:t2}; }
  }
  return best;
}

function displayTeams({team1, team2}) {
  const div = document.getElementById("teams-display");
  const sum1 = team1.reduce((s,p)=>s+p.points,0), sum2 = team2.reduce((s,p)=>s+p.points,0);
  window.lastTeam1=team1; window.lastTeam2=team2;
  div.innerHTML = `
    <div style="display:flex;justify-content:space-around;">
      <div><h3>Команда 1 (∑ ${sum1})</h3><ul>
        ${team1.map(p=>`<li>${p.nickname} (${p.points})</li>`).join("")}
      </ul></div>
      <div><h3>Команда 2 (∑ ${sum2})</h3><ul>
        ${team2.map(p=>`<li>${p.nickname} (${p.points})</li>`).join("")}
      </ul></div>
    </div>
  `;
  document.getElementById("mvp").innerHTML =
    [...team1,...team2].map(p=>`<option>${p.nickname}</option>`).join("");
  document.getElementById("results").style.display = "block";
}

// --- Збереження та оновлення рейтингу ---
function exportResults() {
  const data = {
    league: document.getElementById("league").value,
    team1: window.lastTeam1.map(p=>p.nickname).join(", "),
    team2: window.lastTeam2.map(p=>p.nickname).join(", "),
    winner: document.getElementById("winner").value||"Нічия",
    mvp: document.getElementById("mvp").value,
    penalties: document.getElementById("penalty").value
      .split(",").map(p=>p.trim()).join(", ")
  };
  const body = Object.entries(data)
    .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  fetch("https://laser-proxy.vartaclub.workers.dev",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body
  })
  .then(r=>r.text()).then(txt=>{
    alert(`Результат збережено: ${txt}`);
    if(txt==="OK") loadPlayers();
  }).catch(e=>alert("Error: "+e));
}

// --- Drag'n'Drop ручне формування ---
function enableManualDragDrop() {
  document.querySelectorAll("#players-list-dnd label").forEach(lbl=>{
    lbl.draggable=true;
    lbl.addEventListener("dragstart",e=>{
      e.dataTransfer.setData("text/plain",lbl.querySelector('input').value);
    });
  });
  document.querySelectorAll(".team").forEach(div=>{
    div.addEventListener("dragover",e=>e.preventDefault());
    div.addEventListener("drop",e=>{
      const idx=e.dataTransfer.getData("text/plain");
      const p=players[+idx];
      div.querySelector("ul").innerHTML += `<li>${p.nickname} (${p.points})</li>`;
      window.lastTeams=window.lastTeams||{}; const t=div.dataset.team;
      (window.lastTeams[t]||(window.lastTeams[t]=[])).push(p);
    });
  });
}

function manualAssign() {
  document.getElementById("manual-assign-area").style.display="block";
  enableManualDragDrop();
}

function confirmManual() {
  displayTeams({ team1: window.lastTeams[1], team2: window.lastTeams[2], team3: window.lastTeams[3] });
}

// Глобальні експорти
window.loadPlayers = loadPlayers;
window.autoBalance = autoBalance;
window.manualAssign = manualAssign;
window.exportResults = exportResults;

// Автовиклик при завантаженні сторінки
document.addEventListener("DOMContentLoaded", loadPlayers);
