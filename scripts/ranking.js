import { log } from './logger.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';
import { fetchOnce, CSV_URLS, normalizeLeague } from "./api.js";
import { LEAGUE } from "./constants.js";
import { rankLetterForPoints } from './rankUtils.js';
import { renderAllAvatars, reloadAvatars } from './avatars.client.js';

const CSV_TTL = 60 * 1000;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'avatarRefresh') reloadAvatars();
  });
}
export async function loadData(rankingURL, gamesURL) {
  const techMsg = "⚙ ТЕХНІЧНА ПАУЗА: дані рейтингу тимчасово недоступні";

  try {
    const [rRes, gRes] = await Promise.allSettled([
      fetchOnce(rankingURL, CSV_TTL),
      fetchOnce(gamesURL, CSV_TTL),
    ]);

    if (rRes.status !== "fulfilled") {
      // Якщо не змогли стягнути РЕЙТИНГ – це критично
      log("[ranking] RANK fetch failed", rRes.reason);
      if (typeof showToast === "function") showToast(techMsg);
      if (typeof document !== "undefined") {
        const div = document.createElement("div");
        div.textContent = techMsg;
        div.style.margin = "2rem auto";
        div.style.padding = "1rem";
        div.style.maxWidth = "600px";
        div.style.textAlign = "center";
        div.style.background = "rgba(0,0,0,0.8)";
        div.style.border = "2px solid #f39c12";
        div.style.boxShadow = "0 0 12px #f39c12";
        div.style.fontFamily = '"Press Start 2P", monospace';
        div.style.textTransform = "uppercase";
        document.body.appendChild(div);
      }
      return { rank: [], games: [] };
    }

    const rText = rRes.value;
    const rank = Papa.parse(rText, { header: true, skipEmptyLines: true }).data;

    let games = [];
    if (gRes.status === "fulfilled") {
      const gText = gRes.value;
      games = Papa.parse(gText, { header: true, skipEmptyLines: true }).data;
    } else {
      // Ігри не підтягнулися – не критично, просто не буде статистики по іграм
      log("[ranking] GAMES fetch failed, continue with empty games", gRes.reason);
    }

    return { rank, games };
  } catch (err) {
    log("[ranking] UNEXPECTED loadData error", err);
    if (typeof showToast === "function") showToast(techMsg);
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.textContent = techMsg;
      div.style.margin = "2rem auto";
      div.style.padding = "1rem";
      div.style.maxWidth = "600px";
      div.style.textAlign = "center";
      div.style.background = "rgba(0,0,0,0.8)";
      div.style.border = "2px solid #f39c12";
      div.style.boxShadow = "0 0 12px #f39c12";
      div.style.fontFamily = '"Press Start 2P", monospace';
      div.style.textTransform = "uppercase";
      document.body.appendChild(div);
    }
    return { rank: [], games: [] };
  }
}


const TEAM_FIELDS = ["Team1", "Team 1", "team1", "team 1"];
const TEAM2_FIELDS = ["Team2", "Team 2", "team2", "team 2"];
const SCORE1_FIELDS = ["Score1", "Score 1", "score1", "score 1"];
const SCORE2_FIELDS = ["Score2", "Score 2", "score2", "score 2"];

function parseTimestamp(ts) {
  if (!ts) return new Date(NaN);
  const str = String(ts).trim();
  const m = str.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/
  );
  if (m) {
    const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = m;
    return new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss)
    );
  }
  return new Date(ts);
}

function pickFieldValue(row, fields) {
  for (const key of fields) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

export function computeStats(rank, games, { alias = {}, league } = {}) {
  const stats = {};
  let totalRounds = 0;
  const leagueKey = league ? normalizeLeague(league) : "";
  const validLeagues = ["kids", "sundaygames"];
  const filtered = validLeagues.includes(leagueKey)
    ? games.filter((g) => {
        const rawLeague = g.League ? normalizeLeague(g.League) : "";

        const effectiveLeague = rawLeague || "kids";
        return effectiveLeague === leagueKey;

    
    })
    : games;
  filtered.forEach((g) => {
    const rawT1 = pickFieldValue(g, TEAM_FIELDS);
    const rawT2 = pickFieldValue(g, TEAM2_FIELDS);


    if (!rawT1 || !rawT2) {
      // тихий пропуск без логу
      return;
    }
    const t1 = rawT1.split(",").map((n) => alias[n.trim()] || n.trim());
    const t2 = rawT2.split(",").map((n) => alias[n.trim()] || n.trim());

    const winKey = String(g.Winner || "").replace(/\s+/g, "").toLowerCase();
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
    let s1 = parseInt(pickFieldValue(g, SCORE1_FIELDS), 10);
    let s2 = parseInt(pickFieldValue(g, SCORE2_FIELDS), 10);
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
    .map((g) => parseTimestamp(g.Timestamp))
    .filter((d) => !isNaN(d));
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
const players = rank
  .map((r) => {
    // 1) Акуратно дістаємо нік з різних можливих полів
    const rawNick =
      r.Nickname ??
      r.nickname ??
      r.nick ??
      r["Nick"] ??
      r["Ім’я"] ??
      r["Імʼя"] ??
      r["Name"] ??
      "";

    const nickClean = String(rawNick || "").trim();
    const nick = alias[nickClean] || nickClean;

    // Якщо нік порожній – пропускаємо рядок, щоб не ламати фільтр/сортування
    if (!nick) return null;

    // 2) Бали з різних можливих полів
    const ptsRaw = r.Points ?? r.points ?? r.pts ?? r["Очки"] ?? 0;
    const pts = Number(ptsRaw) || 0;

    // 3) Статистика з games (може бути відсутньою)
    const s = stats[nick] || { games: 0, wins: 0, mvp: 0 };

    const p = {
      nickname: nick,
      points: pts,
      games: s.games,
      wins: s.wins,
      mvp: s.mvp,
    };
    p.losses = p.games - p.wins;
    p.winRate = p.games ? ((p.wins / p.games) * 100).toFixed(2) : "0.00";
    return p;
  })
  .filter(Boolean)              // прибираємо null, якщо нік був порожній
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
    if (a.games === 0 && b.games > 0) return 1;
    if (a.games > 0 && b.games === 0) return -1;
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

async function applyFilters() {
  const q = (searchInput?.value || "").toLowerCase();
  players = allPlayers.filter((p) => p.nickname.toLowerCase().includes(q));
  currentPage = 1;
  await renderTable(players, rankingEl);
  applyPagination();
}

function createRow(p, i) {
  const tr = document.createElement("tr");
  const cls = getRankClass(p.points);
  tr.className = cls;
  if (p.games === 0) tr.classList.add("tr-inactive");

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
  tdGames.textContent = p.games > 0 ? p.games : "-";
  tr.appendChild(tdGames);

  const tdWin = document.createElement("td");
  tdWin.textContent = p.games > 0 ? p.winRate + "%" : "-";
  tr.appendChild(tdWin);

  const tdMvp = document.createElement("td");
  tdMvp.textContent = p.mvp > 0 ? p.mvp : "-";
  tr.appendChild(tdMvp);

  rowMap.set(p.nickname, tr);
  dataMap.set(p.nickname, { ...p, index: i });
  return tr;
}

export async function renderTable(list, tbodyEl) {
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
    const gamesText = p.games > 0 ? p.games : "-";
    if (prev.games !== p.games || cells[5].textContent !== String(gamesText))
      cells[5].textContent = gamesText;
    const winText = p.games > 0 ? p.winRate + "%" : "-";
    if (prev.winRate !== p.winRate || cells[6].textContent !== winText)
      cells[6].textContent = winText;
    const mvpText = p.mvp > 0 ? p.mvp : "-";
    if (prev.mvp !== p.mvp || cells[7].textContent !== String(mvpText))
      cells[7].textContent = mvpText;

    const newCls = cls;
    const nextClassName = p.games === 0 ? `${newCls} tr-inactive` : newCls;
    if (row.className !== nextClassName) row.className = nextClassName;
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

  const applyOps = () => {
    ops
      .sort((a, b) => a.index - b.index)
      .forEach(({ row, index }) => {
        tbodyEl.insertBefore(row, tbodyEl.children[index] || null);
      });
  };

  const renderAvatarsSafe = async () => {
    if (typeof document === "undefined") return;
    try {
      await renderAllAvatars(document);
    } catch (err) {
      log("[ranking]", "renderAllAvatars failed", err);
    }
  };

  if (ops.length && typeof requestAnimationFrame === "function") {
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        applyOps();
        renderAvatarsSafe().finally(resolve);
      });
    });
  } else {
    if (ops.length) applyOps();
    await renderAvatarsSafe();
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
  searchInput.addEventListener("input", () => {
    applyFilters().catch((err) => {
      log("[ranking]", "applyFilters failed", err);
    });
  });
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
  const seasonStart = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    : null;
  document.getElementById("season-info").textContent =
    
    "Зимовий сезон — старт " + formatFull(seasonStart);


    "Зимовий сезон — старт " + formatFull(minDate);


    "Зимовий сезон — старт 01.12.2025";







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
    applyFilters().catch((err) => {
      log("[ranking]", "applyFilters failed", err);
    });
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
  await applyFilters();
  updateArrows();
}

export async function initRanking() {
  try {
    await init();
  } catch (err) {
    log("[ranking] initRanking error", err);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    // DOM ще будується – чекаємо подію
    document.addEventListener("DOMContentLoaded", () => {
      initRanking();
    });
  } else {
    // DOM уже готовий – запускаємо одразу
    initRanking();
  }
}
