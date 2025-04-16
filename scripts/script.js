
let players = [];
let selectedPlayers = [];

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
        return { nickname: cols[1], points: parseInt(cols[2]) };
      }).filter(p => p.nickname && !isNaN(p.points));

      displayPlayers();
    });
}

function displayPlayers() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців:</h3>";
  players.forEach((p, i) => {
    list.innerHTML += \`<label><input type="checkbox" value="\${i}"> \${p.nickname} (\${p.points} балів)</label>\`;
  });
}

function balanceTeams() {
  selectedPlayers = Array.from(document.querySelectorAll("#players-list input:checked"))
    .map(input => players[parseInt(input.value)]);

  if (selectedPlayers.length < 2) {
    alert("Оберіть щонайменше 2 гравців!");
    return;
  }

  const sorted = [...selectedPlayers].sort((a, b) => b.points - a.points);
  const team1 = [], team2 = [];
  sorted.forEach((p, i) => (i % 2 === 0 ? team1 : team2).push(p));

  displayTeams(team1, team2);
}

function displayTeams(t1, t2) {
  const div = document.getElementById("teams-display");
  const sum1 = t1.reduce((sum, p) => sum + p.points, 0);
  const sum2 = t2.reduce((sum, p) => sum + p.points, 0);

  div.innerHTML = \`
    <div class="teams">
      <div>
        <h3>Команда 1 (∑ \${sum1})</h3>
        <ul>\${t1.map(p => "<li>" + p.nickname + " (" + p.points + ")</li>").join("")}</ul>
      </div>
      <div>
        <h3>Команда 2 (∑ \${sum2})</h3>
        <ul>\${t2.map(p => "<li>" + p.nickname + " (" + p.points + ")</li>").join("")}</ul>
      </div>
    </div>
  \`;

  const mvpSelect = document.getElementById("mvp");
  mvpSelect.innerHTML = "";
  [...t1, ...t2].forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nickname;
    opt.innerText = p.nickname;
    mvpSelect.appendChild(opt);
  });

  document.getElementById("results").style.display = "block";
}

function exportResults() {
  const winner = document.getElementById("winner").value;
  const mvp = document.getElementById("mvp").value;
  alert("Збережено результат:\nПеремога: " + (winner || "Нічия") + "\nMVP: " + mvp);
}
