
const sheetLinks = {
    kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
    sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBRIsmvzhtVrMZLdWySaVRWeS57MY3SbfKrlobpvH-5yoWDMK3-wcW1Y9vwV6MkEchH7_mNy49q3QS/pub?gid=1286735969&single=true&output=csv"
};

let players = [];

function loadLeagueData() {
    const league = document.getElementById("league-select").value;
    const sheetURL = sheetLinks[league];
    fetch(sheetURL)
        .then(response => response.text())
        .then(data => {
            const rows = data.split("\n").slice(1);
            players = rows.map(row => {
                const cols = row.split(",");
                return {
                    name: cols[1]?.trim(),
                    points: parseInt(cols[2]?.trim()) || 0
                };
            }).filter(p => p.name);
            renderPlayerList();
        });
}

function renderPlayerList() {
    const listContainer = document.getElementById("player-list");
    listContainer.innerHTML = "";
    players.forEach((player, index) => {
        const div = document.createElement("div");
        div.innerHTML = \`
            <label>
                <input type="checkbox" value="\${index}">
                \${player.name} (\${player.points} балів)
            </label>
        \`;
        listContainer.appendChild(div);
    });
}

function getSelectedPlayers() {
    const selected = Array.from(document.querySelectorAll("#player-list input:checked"))
        .map(cb => players[parseInt(cb.value)]);
    return selected;
}

function balanceTeams() {
    const selectedPlayers = getSelectedPlayers();
    if (selectedPlayers.length < 2) {
        alert("Оберіть щонайменше 2 гравці.");
        return;
    }

    selectedPlayers.sort((a, b) => b.points - a.points);
    const teamA = [], teamB = [];
    let sumA = 0, sumB = 0;

    selectedPlayers.forEach(player => {
        if (sumA <= sumB) {
            teamA.push(player);
            sumA += player.points;
        } else {
            teamB.push(player);
            sumB += player.points;
        }
    });

    const result = document.getElementById("balance-result");
    result.innerHTML = \`
        <h3>Команда A (всього: \${sumA}):</h3>
        <ul>\${teamA.map(p => "<li>" + p.name + " (" + p.points + ")</li>").join("")}</ul>
        <h3>Команда B (всього: \${sumB}):</h3>
        <ul>\${teamB.map(p => "<li>" + p.name + " (" + p.points + ")</li>").join("")}</ul>
    \`;
}
