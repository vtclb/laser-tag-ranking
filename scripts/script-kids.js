import { log } from './logger.js';
import { CSV_URLS } from "./api.js";

const csvUrl = CSV_URLS.kids.ranking;

function getRank(points) {
    if (points >= 1200) return { rank: "S-ранг", class: "rank-S", icon: "🟣" };
    if (points >= 800) return { rank: "A-ранг", class: "rank-A", icon: "🔴" };
    if (points >= 500) return { rank: "B-ранг", class: "rank-B", icon: "🟡" };
    if (points >= 200) return { rank: "C-ранг", class: "rank-C", icon: "🔵" };
    return { rank: "D-ранг", class: "rank-D", icon: "🟢" };
}

function loadRanking() {
    fetch(csvUrl)
        .then(response => response.text())
        .then(csvText => {
            const rows = csvText.split("\n").slice(1);
            const players = rows.map(row => {
                const cols = row.split(",").map(c => c.trim());
                return { nickname: cols[1], points: parseInt(cols[2]) };
            });

            players.sort((a, b) => b.points - a.points);
            const table = document.getElementById("ranking-table");
            table.innerHTML = "";
            players.forEach((player, index) => {
                if (!player.nickname || isNaN(player.points)) return;
                const rankInfo = getRank(player.points);
                const row = document.createElement("tr");
                row.classList.add(rankInfo.class);
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${rankInfo.icon} ${player.nickname}</td>
                    <td>${rankInfo.rank}</td>
                    <td>${player.points}</td>
                `;
                table.appendChild(row);
            });
      })
        .catch(err => {
            log('[ranking]', err);
            const msg = 'Помилка завантаження даних';
            if (typeof showToast === 'function') showToast(msg); else alert(msg);
        });
}

document.addEventListener("DOMContentLoaded", loadRanking);
