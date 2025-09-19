import { log } from './logger.js?v=2025-09-19-4';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-4';
import { fetchOnce, CSV_URLS, normalizeLeague } from "./api.js?v=2025-09-19-4";
import { LEAGUE } from "./constants.js?v=2025-09-19-4";
import { rankLetterForPoints } from './rankUtils.js?v=2025-09-19-4';
import { renderAllAvatars, reloadAvatars, nickKey } from './avatars.client.js?v=2025-09-19-4';

const CSV_TTL = 60 * 1000;

window.addEventListener('storage', e => {
  if (e.key === 'avatarRefresh') reloadAvatars();
});
export async function loadData(rankingURL, gamesURL) {
  try {
    const [rText, gText] = await Promise.all([
      fetchOnce(rankingURL, CSV_TTL),
      fetchOnce(gamesURL, CSV_TTL),
    ]);
    const rank = Papa.parse(rText, { header: true, skipEmptyLines: true }).data;
    const games = Papa.parse(gText, { header: true, skipEmptyLines: true }).data;
    return { rank, games };
  } catch (err) {
    log('[ranking]', err);
    const msg = "Не вдалося завантажити дані рейтингу";
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.textContent = msg;
      document.body.appendChild(div);
    }
    return { rank: [], games: [] };
  }
}

export function computeStats(rank, games, { alias = {}, league } = {}) {
  const stats = {};
  let totalRounds = 0;
  const leagueKey = league ? normalizeLeague(league) : "";
  const validLeagues = ["kids", "olds", "sundaygames"];
  const filtered = validLeagues.includes(leagueKey)
    ? games.filter((g) => {
        const gameLeague = g.League ? normalizeLeague(g.League) : "";
        return gameLeague === leagueKey;
      })
    : games;
  filtered.forEach((g) => {
    const t1 = g.Team1.split(",").map((n) => alias[n.trim()] || n.trim());
    const t2 = g.Team2.split(",").map((n) => alias[n.trim()] || n.trim());
    const winKey = g.Winner;
    const winT = winKey === "team1" ? t1 : winKey === "team2" ? t2 : [];
    t1.concat(t2).forEach((n) => {
      stats[n] = stats[n] || { games: 0, wins: 0, mvp: 0 };
      stats[n].games++;
    });
    winT.forEach((n) => stats[n].wins++);
    const mvpList = [g.MVP, g.mvp2, g.mvp3]
      .flatMap((v) => String(v || '').split(/[;,]/))
      .map((s) => alias[s.trim()] || s.trim())
      .filter(Boolean);
    mvpList.forEach((m) => {
      if (stats[m]) stats[m].mvp++;
    });
    let s1 = parseInt(g.Score1, 10);
    let s2 = parseInt(g.Score2, 10);
    if (isNaN(s1) || isNaN(s2)) {
      const mScore = (g.Series || g.series || "").match(/(\d+)\D+(\d+)/);
      if (mScore) {
        s1 = parseInt(mScore[1], 10);
        s2 = parseInt(mScore[2], 10);
      }
    }
    if (!isNaN(s1) && !isNaN(s2)) totalRounds += s1 + s2;
  });
  const totalGames = filtered.length;
  const dates = filtered
    .map((g) => new Date(g.Timestamp))
    .filter((d) => !isNaN(d));
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  const players = rank
    .map((r) => {
      const nick = alias[r.Nickname] || r.Nickname;
      const p = {
        nickname: nick,
        points: +r.Points || 0,
        games: stats[nick]?.games || 0,
        wins: stats[nick]?.wins || 0,
        mvp: stats[nick]?.mvp || 0,
      };
      p.losses = p.games - p.wins;
      p.winRate = p.games ? ((p.wins / p.games) * 100).toFixed(2) : "0.00";
      return p;
    })
    .sort((a, b) => b.points - a.points);
  return { players, totalGames, totalRounds, minDate, maxDate };
}

export function getRankClass(points) {
  const letter = rankLetterForPoints(points);
  return `rank-${letter}`;
}

export function renderChart(list, chartEl) {
  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  list.forEach((p) => {
    const r = getRankClass(p.points).replace("rank-", "");
    counts[r] = (counts[r] || 0) + 1;
  });
  const total = list.length || 1;
  chartEl.innerHTML = "";
  ["S", "A", "B", "C", "D", "E", "F"].forEach((r) => {
    const pct = Math.round((counts[r] / total) * 100);
    if (!pct) return;
    const div = document.createElement("div");
    div.className = "seg-" + r;
    div.style.width = pct + "%";
    div.textContent = pct + "%";
    chartEl.appendChild(div);
  });
}

const rowMap = new Map();
const dataMap = new Map();

let allPlayers = [];
let players = [];
let searchInput;
const sortState = { key: "points", dir: -1 };
let rankingEl;
let currentPage = 1;
const rowsPerPage = 10;
let showAll = false;
let prevBtn, nextBtn, pageInfoEl, showAllBtn;

function verifySortableHeaders() {
  ["points", "games", "winRate", "mvp"].forEach((key) => {
    const th = document.querySelector(`thead th[data-key="${key}"]`);
    if (!th) {
      log("[ranking]", `Missing data-key for ${key} column`);
      return;
    }
    if (!th.querySelector(".sort-arrow")) {
      const span = document.createElement("span");
      span.className = "sort-arrow";
      th.appendChild(span);
    }
  });
}

function updateArrows() {
  document.querySelectorAll("thead th[data-key]").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (!arrow) return;
    if (th.dataset.key === sortState.key) {
      arrow.textContent = sortState.dir === 1 ? "\u25B2" : "\u25BC";
    } else {
      arrow.textContent = "";
    }
  });
}

function sortPlayers() {
  const { key, dir } = sortState;
  allPlayers.sort((a, b) => {
    let res = 0;
    switch (key) {
      case "place":
        res = a._index - b._index;
        break;
      case "nickname":
        res = a.nickname.localeCompare(b.nickname);
        break;
      case "rank":
        res = getRankClass(a.points).localeCompare(getRankClass(b.points));
        break;
      case "points":
        res = a.points - b.points;
        break;
      case "games":
        res = a.games - b.games;
        break;
      case "winRate":
        res = parseFloat(a.winRate) - parseFloat(b.winRate);
        break;
      case "mvp":
        res = a.mvp - b.mvp;
        break;
      default:
        res = 0;
    }
    if (res === 0) res = a._index - b._index;
    return res * dir;
  });
  allPlayers.forEach((p, i) => (p._index = i));
}

function applyFilters() {
  const q = (searchInput?.value || "").toLowerCase();
  players = allPlayers.filter((p) => p.nickname.toLowerCase().includes(q));
  currentPage = 1;
  renderTable(players, rankingEl);
  applyPagination();
}

function createRow(p, i) {
  const tr = document.createElement("tr");
  const cls = getRankClass(p.points);
  tr.className = cls;

  const tdRank = document.createElement("td");
  tdRank.textContent = i + 1;
  tr.appendChild(tdRank);

  const tdAvatar = document.createElement("td");
  const img = document.createElement("img");
  img.className = "avatar-img";
  img.alt = p.nickname;
  img.loading = "lazy";
  img.width = img.height = 32;
  img.dataset.nick = p.nickname;
  img.dataset.nickKey = nickKey(p.nickname);
  img.src = AVATAR_PLACEHOLDER;
  img.onerror = () => {
    img.onerror = null;
    img.src = AVATAR_PLACEHOLDER;
  };
  tdAvatar.appendChild(img);
  tr.appendChild(tdAvatar);

  const tdNick = document.createElement("td");
  tdNick.className = cls.replace("rank-", "nick-");
  tdNick.style.cursor = "pointer";
  tdNick.setAttribute("role", "button");
  tdNick.setAttribute("tabindex", "0");
  tdNick.setAttribute(
    "aria-label",
    `Показати статистику ${p.nickname}`
  );
  tdNick.textContent = p.nickname;
  tr.appendChild(tdNick);

  const tdRankCls = document.createElement("td");
  tdRankCls.textContent = cls.replace("rank-", "");
  tr.appendChild(tdRankCls);

  const tdPoints = document.createElement("td");
  tdPoints.textContent = p.points;
  tr.appendChild(tdPoints);

  const tdGames = document.createElement("td");
  tdGames.textContent = p.games;
  tr.appendChild(tdGames);

  const tdWin = document.createElement("td");
  tdWin.textContent = p.winRate + "%";
  tr.appendChild(tdWin);

  const tdMvp = document.createElement("td");
  tdMvp.textContent = p.mvp;
  tr.appendChild(tdMvp);

  rowMap.set(p.nickname, tr);
  dataMap.set(p.nickname, { ...p, index: i });
  return tr;
}

export function renderTable(list, tbodyEl) {
  const fragment = document.createDocumentFragment();
  const ops = [];
  const seen = new Set();

  list.forEach((p, i) => {
    seen.add(p.nickname);
    const prev = dataMap.get(p.nickname);
    if (!prev) {
      const row = createRow(p, i);
      fragment.appendChild(row);
      ops.push({ row, index: i });
      return;
    }
    const row = rowMap.get(p.nickname);
    const cells = row.children;
    const cls = getRankClass(p.points);

    if (prev.points !== p.points) cells[4].textContent = p.points;
    if (prev.games !== p.games) cells[5].textContent = p.games;
    if (prev.winRate !== p.winRate) cells[6].textContent = p.winRate + "%";
    if (prev.mvp !== p.mvp) cells[7].textContent = p.mvp;

    const newCls = cls;
    if (row.className !== newCls) row.className = newCls;
    const nickCls = cls.replace("rank-", "nick-");
    if (cells[2].className !== nickCls) cells[2].className = nickCls;
    const rankText = cls.replace("rank-", "");
    if (cells[3].textContent !== rankText) cells[3].textContent = rankText;
    if (prev.index !== i) {
      cells[0].textContent = i + 1;
      fragment.appendChild(row);
      ops.push({ row, index: i });
    } else if (cells[0].textContent !== String(i + 1)) {
      cells[0].textContent = i + 1;
    }

    dataMap.set(p.nickname, { ...p, index: i });
  });

  for (const nick of Array.from(rowMap.keys())) {
    if (!seen.has(nick)) {
      const row = rowMap.get(nick);
      row.remove();
      rowMap.delete(nick);
      dataMap.delete(nick);
    }
  }

  if (ops.length) {
    requestAnimationFrame(() => {
      ops
        .sort((a, b) => a.index - b.index)
        .forEach(({ row, index }) => {
          tbodyEl.insertBefore(row, tbodyEl.children[index] || null);
        });
      renderAllAvatars();
    });
  } else {
    renderAllAvatars();
  }
}

export function renderTopMVP(list, container) {
  const top = list
    .slice()
    .sort((a, b) => b.mvp - a.mvp)
    .slice(0, 3);
  container.innerHTML = "";
  top.forEach((p) => {
    const c = document.createElement("div");
    c.className = "mvp-card";
    const crown = document.createElement("div");
    crown.style.fontSize = "2rem";
    crown.textContent = "\uD83D\uDC51";
    const h = document.createElement("h3");
    h.className = getRankClass(p.points).replace("rank-", "nick-");
    h.textContent = p.nickname;
    const stat = document.createElement("div");
    stat.textContent = p.mvp + " MVP";
    c.appendChild(crown);
    c.appendChild(h);
    c.appendChild(stat);
    container.appendChild(c);
  });
}

export function initSearch(inputEl) {
  searchInput = inputEl;
  searchInput.addEventListener("input", applyFilters);
}

function initPagination(prevEl, nextEl, infoEl, allEl) {
  prevBtn = prevEl;
  nextBtn = nextEl;
  pageInfoEl = infoEl;
  showAllBtn = allEl;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      applyPagination();
    }
  });
  nextBtn.addEventListener("click", () => {
    currentPage++;
    applyPagination();
  });
  showAllBtn.addEventListener("click", () => {
    showAll = !showAll;
    applyPagination();
  });
}

function applyPagination() {
  if (!rankingEl) return;
  const totalPages = Math.max(1, Math.ceil(players.length / rowsPerPage));
  if (!showAll && currentPage > totalPages) currentPage = totalPages;
  const start = showAll ? 0 : (currentPage - 1) * rowsPerPage;
  const end = showAll ? players.length : start + rowsPerPage;
  rankingEl.querySelectorAll("tr").forEach((tr, i) => {
    tr.style.display = i >= start && i < end ? "table-row" : "none";
  });
  if (pageInfoEl)
    pageInfoEl.textContent = showAll
      ? `Всі (${players.length})`
      : `${currentPage}/${totalPages}`;
  if (prevBtn) prevBtn.disabled = showAll || currentPage <= 1;
  if (nextBtn) nextBtn.disabled = showAll || currentPage >= totalPages;
  if (showAllBtn)
    showAllBtn.textContent = showAll ? "Сторінки" : "Показати всі";
}

export function formatD(d) {
  return d
    ? ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2)
    : "-";
}

export function formatFull(d) {
  if (!d) return "-";
  return (
    ("0" + d.getDate()).slice(-2) +
    "." +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "." +
    d.getFullYear()
  );
}

const CONFIG = {
  kids: {
    alias: {
      Zavodchanyn: "Romario",
      Mariko: "Gidora",
      Timabuilding: "Бойбуд",
    },
  },
  sundaygames: {
    alias: {
      Romario: "Zavodchanyn",
      Mariko: "Gidora",
      Timabuilding: "Бойбуд",
    },
  },
};

async function init() {
  const cfg = CONFIG[LEAGUE];
  if (!cfg) return;
  const { rank, games } = await loadData(
    CSV_URLS[LEAGUE].ranking,
    CSV_URLS[LEAGUE].games
  );
  const {
    players: pl,
    totalGames,
    totalRounds,
    minDate,
    maxDate,
  } = computeStats(rank, games, { alias: cfg.alias, league: LEAGUE });
  allPlayers = pl.map((p, i) => ({ ...p, _index: i }));
  document.getElementById("summary").textContent =
    `Ігор: ${totalGames} (${totalRounds} раундів). Період: ${formatD(minDate)}–${formatD(maxDate)}`;
  document.getElementById("season-info").textContent =
    `Перший сезон — старт ${formatFull(minDate)}`;
  renderTopMVP(allPlayers, document.getElementById("top-mvp"));
  renderChart(allPlayers, document.getElementById("rank-chart"));
  rankingEl = document.querySelector("#ranking tbody");
  const onRankInteract = (e) => {
    const cell = e.target.closest("td");
    if (!cell || !cell.className.startsWith("nick-")) return;
    if (e.type === "click") {
      showQuickStats(cell.textContent, e);
    } else if (e.key === "Enter") {
      e.preventDefault();
      showQuickStats(cell.textContent, e);
    }
  };
  rankingEl.addEventListener("click", onRankInteract);
  rankingEl.addEventListener("keydown", onRankInteract);
  const thead = document.querySelector("thead");
  verifySortableHeaders();
  thead.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-key]");
    if (!th) return;
    const key = th.dataset.key;
    if (sortState.key === key) {
      sortState.dir *= -1;
    } else {
      sortState.key = key;
      sortState.dir = key === "points" ? -1 : 1;
    }
    sortPlayers();
    applyFilters();
    updateArrows();
  });
  initSearch(document.getElementById("search"));
  initPagination(
    document.getElementById("prev-page"),
    document.getElementById("next-page"),
    document.getElementById("page-info"),
    document.getElementById("show-all")
  );
  sortPlayers();
  applyFilters();
  updateArrows();
}

document.addEventListener("DOMContentLoaded", init);

