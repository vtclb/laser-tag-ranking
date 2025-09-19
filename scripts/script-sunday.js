import { log } from './logger.js?v=2025-09-30-01';
import { CSV_URLS } from "./api.js?v=2025-09-30-01";
import { rankLetterForPoints } from './rankUtils.js?v=2025-09-30-01';

const csvUrl = CSV_URLS.sundaygames.ranking;

function getRank(points) {
    const letter = rankLetterForPoints(points);
    const map = {
        F: { rank: "F-ранг", class: "rank-F", icon: "⚪" },
        E: { rank: "E-ранг", class: "rank-E", icon: "🟢" },
        D: { rank: "D-ранг", class: "rank-D", icon: "🔵" },
        C: { rank: "C-ранг", class: "rank-C", icon: "🟡" },
        B: { rank: "B-ранг", class: "rank-B", icon: "🟠" },
        A: { rank: "A-ранг", class: "rank-A", icon: "🔴" },
        S: { rank: "S-ранг", class: "rank-S", icon: "🟣" }
    };
    return map[letter];
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
