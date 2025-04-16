
let players = [];
let lobby = [];

const sheetUrls = {
  kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};

function loadPlayers() {
  const league = document.getElementById("league").value;
  fetch(sheetUrls[league])
    .then(res => res.text())
    .then(data => {
      const rows = data.split("\n").slice(1);
      players = rows.map(row => {
        const cols = row.split(",");
        return { nickname: cols[1]?.trim(), points: parseInt(cols[2]) };
      }).filter(p => p.nickname && !isNaN(p.points));

      displayPlayers();
    })
    .catch(err => alert("Помилка при завантаженні гравців: " + err));
}

function displayPlayers() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців:</h3>";
  list.innerHTML += players.map((p, i) =>
    `<label style="display:block;"><input type="checkbox" value="${i}"> ${p.nickname} (${p.points})</label>`
  ).join("");
}

function moveToLobby() {
  const selected = Array.from(document.querySelectorAll("#players-list input:checked"))
    .map(input => players[parseInt(input.value)]);

  selected.forEach(p => {
    if (!lobby.find(lp => lp.nickname === p.nickname)) {
      lobby.push(p);
    }
  });

  updateLobby();
}

function updateLobby() {
  const lobbyList = document.getElementById("lobby-list");
  lobbyList.innerHTML = lobby.map(p => `<li>${p.nickname} (${p.points})</li>`).join("");
}

function balanceTeams() {
  if (lobby.length < 2) {
    alert("Необхідно щонайменше 2 гравців у лоббі");
    return;
  }

  let bestDiff = Infinity;
  let bestSplit = null;

  const total = lobby.length;
  const maxComb = 1 << total;

  for (let mask = 1; mask < maxComb - 1; mask++) {
    const t1 = [], t2 = [];
    for (let i = 0; i < total; i++) {
      if ((mask >> i) & 1) t1.push(lobby[i]);
      else t2.push(lobby[i]);
    }

    const sum1 = t1.reduce((a, b) => a + b.points, 0);
    const sum2 = t2.reduce((a, b) => a + b.points, 0);
    const diff = Math.abs(sum1 - sum2);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = { t1, t2, sum1, sum2 };
    }
  }

  if (bestSplit) displayTeams(bestSplit.t1, bestSplit.t2, bestSplit.sum1, bestSplit.sum2);
}

function displayTeams(t1, t2, sum1, sum2) {
  const div = document.getElementById("teams-display");
  div.innerHTML = `
    <div class="teams" style="display:flex; gap:50px; justify-content:center;">
      <div>
        <h3>Команда 1 (∑ ${sum1})</h3>
        <ul>${t1.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul>
      </div>
      <div>
        <h3>Команда 2 (∑ ${sum2})</h3>
        <ul>${t2.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul>
      </div>
    </div>
  `;

  const mvpSelect = document.getElementById("mvp");
  mvpSelect.innerHTML = "";
  [...t1, ...t2].forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nickname;
    opt.textContent = p.nickname;
    mvpSelect.appendChild(opt);
  });

  document.getElementById("results").style.display = "block";
}

function exportResults() {
  const winner = document.getElementById("winner").value;
  const mvp = document.getElementById("mvp").value;
  alert(`Збережено результат:\n• Перемога: ${winner || "Нічия"}\n• MVP: ${mvp}`);
}
