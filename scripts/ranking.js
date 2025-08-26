import { getAvatarUrl } from "./api.js";

const DEFAULT_AVATAR_URL = "assets/default_avatars/av0.png";

const AVATAR_TTL = 6 * 60 * 60 * 1000;

async function fetchAvatar(nick) {
  const key = `avatar:${nick}`;
  const now = Date.now();
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "null");
    if (cached && now - cached.time < AVATAR_TTL) return cached;
  } catch {}
  try {
    const url = await getAvatarUrl(nick);
    const info = { url, time: now };
    sessionStorage.setItem(key, JSON.stringify(info));
    return info;
  } catch {
    return null;
  }
}

async function setAvatar(img, nick) {
  img.dataset.nick = nick;
  const info = await fetchAvatar(nick);
  if (info && info.url) {
    img.src = `${info.url}?t=${Date.now()}`;
  } else {
    img.src = DEFAULT_AVATAR_URL;
  }
  img.onerror = () => {
    img.onerror = null;
    img.src = DEFAULT_AVATAR_URL;
  };
}

function refreshAvatars(nick) {
  const sel = nick
    ? `img.avatar-img[data-nick="${nick}"]`
    : "img.avatar-img[data-nick]";
  document.querySelectorAll(sel).forEach((img) => setAvatar(img, img.dataset.nick));
}

window.addEventListener("storage", (e) => {
  if (e.key === "avatarRefresh") {
    const [nick] = (e.newValue || "").split(":");
    if (nick) sessionStorage.removeItem(`avatar:${nick}`);
    refreshAvatars(nick);
  }
});
export async function loadData(rankingURL, gamesURL) {
  try {
    const [rText, gText] = await Promise.all([
      fetch(rankingURL).then((r) => r.text()),
      fetch(gamesURL).then((r) => r.text()),
    ]);
    const rank = Papa.parse(rText, { header: true, skipEmptyLines: true }).data;
    const games = Papa.parse(gText, { header: true, skipEmptyLines: true }).data;
    return { rank, games };
  } catch (err) {
    console.error("Failed to load or parse ranking data", err);
    const msg = "Не вдалося завантажити дані рейтингу";
    if (typeof alert === "function") alert(msg);
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
  const filtered = league ? games.filter((g) => g.League === league) : games;
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
    const m = alias[g.MVP] || g.MVP;
    if (stats[m]) stats[m].mvp++;
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
      p.winRate = p.games ? ((p.wins / p.games) * 100).toFixed(2) : "0";
      return p;
    })
    .sort((a, b) => b.points - a.points);
  return { players, totalGames, totalRounds, minDate, maxDate };
}

export function getRankClass(points) {
  if (points >= 1200) return "rank-S";
  if (points >= 800) return "rank-A";
  if (points >= 500) return "rank-B";
  if (points >= 200) return "rank-C";
  return "rank-D";
}

export function renderChart(list, chartEl) {
  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  list.forEach((p) => {
    const r = getRankClass(p.points).replace("rank-", "");
    counts[r] = (counts[r] || 0) + 1;
  });
  const total = list.length || 1;
  chartEl.innerHTML = "";
  ["S", "A", "B", "C", "D"].forEach((r) => {
    const pct = Math.round((counts[r] / total) * 100);
    if (!pct) return;
    const div = document.createElement("div");
    div.className = "seg-" + r;
    div.style.width = pct + "%";
    div.textContent = pct + "%";
    chartEl.appendChild(div);
  });
}

export function renderTable(list, tbodyEl) {
  tbodyEl.innerHTML = "";
  list.forEach((p, i) => {
    const tr = document.createElement("tr");
    const cls = getRankClass(p.points);
    tr.className = cls + (i >= 10 ? " hidden" : "");

    const tdAvatar = document.createElement("td");
    const img = document.createElement("img");
    img.className = "avatar-img";
    img.alt = p.nickname;
    setAvatar(img, p.nickname);
    tdAvatar.appendChild(img);

    const vals = [
      i + 1,
      p.nickname,
      cls.replace("rank-", ""),
      p.points,
      p.games,
      p.winRate + "%",
      p.mvp,
    ];
    vals.forEach((val, idx) => {
      const td = document.createElement("td");
      if (idx === 1) {
        td.className = cls.replace("rank-", "nick-");
        td.style.cursor = "pointer";
        td.addEventListener("click", (e) => showQuickStats(p.nickname, e));
      }
      td.textContent = val;
      tr.appendChild(td);
    });
    tr.insertBefore(tdAvatar, tr.children[1]);
    tbodyEl.appendChild(tr);
  });
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

export function initSearch(inputEl, rowSelector) {
  inputEl.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(rowSelector).forEach((tr) => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

export function initToggle(btnEl, rowSelector) {
  btnEl.addEventListener("click", () => {
    const expanded =
      btnEl.textContent ===
      "\u0412\u0441\u0456 \u0433\u0440\u0430\u0432\u0446\u0456";
    document.querySelectorAll(rowSelector).forEach((tr, i) => {
      if (i >= 10) tr.style.display = expanded ? "table-row" : "none";
    });
    btnEl.textContent = expanded
      ? "\u0422\u043e\u043f-10"
      : "\u0412\u0441\u0456 \u0433\u0440\u0430\u0432\u0446\u0456";
  });
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

