import { AVATAR_WORKER_BASE, AVATAR_PLACEHOLDER } from './avatarConfig.js';

const RAW_BASE = typeof AVATAR_WORKER_BASE === 'string' ? AVATAR_WORKER_BASE.trim() : '';
const NORMALIZED_BASE = RAW_BASE ? RAW_BASE.replace(/\/+$/, '') : '';
const FEED = NORMALIZED_BASE ? `${NORMALIZED_BASE}/avatars` : '';
const BY_NICK = FEED ? `${FEED}/` : '';

const mapping = new Map();
let lastUpdated = 0;

function norm(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

function bustUrl(url, stamp = Date.now()) {
  if (!url) return '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${stamp}`;
}

function setImage(img, url) {
  if (!img) return;
  img.onerror = () => {
    img.src = AVATAR_PLACEHOLDER;
  };
  img.src = url || AVATAR_PLACEHOLDER;
}

/* ✅ Безпечне завантаження FEED */
async function safeLoadFeed() {
  if (!FEED) return;

  try {
    const res = await fetch(bustUrl(FEED), { cache: "no-store" });

    // ❗ Якщо сервер повернув HTML → просто пропускаємо
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn("[avatars] FEED returned non-JSON → ignore");
      return;
    }

    const data = await res.json();
    if (!data) return;

    if (data.entries) {
      for (const [nick, url] of data.entries) {
        const key = norm(nick);
        if (key && url) mapping.set(key, url);
      }
    } else if (data.mapping) {
      for (const [nick, url] of Object.entries(data.mapping)) {
        const key = norm(nick);
        if (key && url) mapping.set(key, url);
      }
    }

    lastUpdated = Date.now();

  } catch (err) {
    console.warn("[avatars] FEED error (ignored):", err);
  }
}

/* ✅ Безпечне завантаження АВАТАРА для одного ніку */
async function safeLoadNick(nick) {
  if (!BY_NICK) return null;

  const url = bustUrl(`${BY_NICK}${encodeURIComponent(nick)}`);

  try {
    const res = await fetch(url, { cache: "no-store" });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn("[avatars] BY_NICK non-JSON → ignore");
      return null;
    }

    const data = await res.json();
    if (data?.url) return data.url;

  } catch (err) {
    console.warn("[avatars] Avatar fetch error:", err);
  }

  return null;
}

/* =================== ГОЛОВНИЙ РЕНДЕР =================== */

export async function renderAllAvatars(root = document) {
  if (!root) return;

  await safeLoadFeed();

  const nodes = root.querySelectorAll("[data-nick]");

  for (const node of nodes) {
    const nick = node.dataset.nick;
    const key = norm(nick);
    const img = node.tagName === "IMG" ? node : node.querySelector("img") || node;

    if (!key) {
      setImage(img, null);
      continue;
    }

    if (mapping.has(key)) {
      setImage(img, mapping.get(key));
      continue;
    }

    const resolved = await safeLoadNick(nick);
    if (resolved) {
      mapping.set(key, resolved);
      setImage(img, resolved);
    } else {
      // 🔥 БЕЗ КРАШУ → always safe
      setImage(img, null);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderAllAvatars().catch(err =>
    console.warn("[avatars] render fail (safe)", err)
  );
});
