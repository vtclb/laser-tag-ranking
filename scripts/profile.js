import { log } from './logger.js';
import { getProfile, uploadAvatar, getPdfLinks, fetchPlayerGames, safeSet, safeGet, avatarNickKey, fetchAvatarForNick } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';
import * as Avatars from './avatars.client.js';
import { noteAvatarFailure, setImgSafe, updateInlineAvatarImages } from './avatarAdmin.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';

let gameLimit = 0;
let gamesLeftEl = null;
let currentNick = '';
const pdfCache = {};

const LEGACY_AWARDS = {
  laston: {
    title: 'MVP літнього сезону',
    awards: [
      { badge: 'Summer MVP', text: 'Нагорода за домінування в літньому сезоні 2025.' },
      { badge: 'Firestarter', text: 'Відзнака за найвищу серію нагород MVP у спеку.' },
    ],
  },
  zavodchanyn: {
    title: 'MVP осіннього сезону',
    awards: [
      { badge: 'Autumn MVP', text: 'Головна відзнака за осінній сезон: стабільність і точність.' },
      { badge: 'Leaf Hunter', text: 'Ачівка за clutch-моменти та холоднокровність восени.' },
    ],
  },
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseQuery(search) {
  const result = {};
  if (typeof search !== 'string' || !search) return result;
  const questionIndex = search.indexOf('?');
  let query = questionIndex >= 0 ? search.slice(questionIndex + 1) : search;
  const hashIndex = query.indexOf('#');
  if (hashIndex >= 0) query = query.slice(0, hashIndex);
  if (!query) return result;
  const decodePart = part => {
    try {
      return decodeURIComponent(String(part).replace(/\+/g, ' '));
    } catch (err) {
      return String(part);
    }
  };
  for (const piece of query.split('&')) {
    if (!piece) continue;
    const [rawKey, ...rawValParts] = piece.split('=');
    if (!rawKey) continue;
    const key = decodePart(rawKey);
    const rawValue = rawValParts.length ? rawValParts.join('=') : '';
    result[key] = decodePart(rawValue);
  }
  return result;
}

async function updateAvatar(nick) {
  const avatarEl = document.getElementById('avatar');
  avatarEl.dataset.nick = nick;
  avatarEl.dataset.nickKey = avatarNickKey(nick);
  avatarEl.alt = nick;
  avatarEl.referrerPolicy = 'no-referrer';
  avatarEl.decoding = 'async';
  avatarEl.loading = 'lazy';
  avatarEl.onerror = () => {
    avatarEl.onerror = null;
    avatarEl.src = AVATAR_PLACEHOLDER;
  };
  avatarEl.src = AVATAR_PLACEHOLDER;
  if (typeof Avatars.renderAllAvatars === 'function') {
    await Avatars.renderAllAvatars();
  }
}


function showError(msg) {
  const container = document.getElementById('profile');
  container.style.display = 'none';
  let err = document.getElementById('profile-error');
  if (!err) {
    err = document.createElement('div');
    err.id = 'profile-error';
    err.style.color = '#f39c12';
    err.style.textAlign = 'center';
    err.style.marginTop = '1rem';
    document.querySelector('nav').insertAdjacentElement('afterend', err);
    err.innerHTML = `
      <p>${msg}</p>
      <div style="margin-top:0.5rem;">
        <input type="text" id="retry-nick" placeholder="Введіть нік" style="padding:0.5rem;border:2px solid #555;background:rgba(0,0,0,0.5);color:#fff;border-radius:4px;font-size:0.7rem;"/>
        <button id="retry-search" style="margin-left:0.5rem;">Пошук</button>
      </div>
      <p style="margin-top:0.5rem;"><a href="index.html" style="color:#ffd700;">На головну</a></p>
    `;
    document.getElementById('retry-search').addEventListener('click', () => {
      const val = document.getElementById('retry-nick').value.trim();
      if (val) location.href = `profile.html?nick=${encodeURIComponent(val)}`;
    });
  } else {
    err.querySelector('p').textContent = msg;
    err.style.display = 'block';
  }
}

function renderLegacyAwards(nick) {
  const box = document.getElementById('legacy-awards');
  if (!box) return;
  const entry = LEGACY_AWARDS[avatarNickKey(nick)];
  if (!entry) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = entry.title;
  box.appendChild(title);

  const list = document.createElement('ul');
  for (const award of entry.awards) {
    const li = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = award.badge;
    const desc = document.createElement('span');
    desc.textContent = ` ${award.text}`;
    li.appendChild(badge);
    li.appendChild(desc);
    list.appendChild(li);
  }
  box.appendChild(list);
}

function updateGamesLeft(used) {
  if (!gamesLeftEl) return;
  const left = Math.max(gameLimit - used, 0);
  gamesLeftEl.textContent = `Залишилось ${left} із ${gameLimit} ігор`;
}

async function renderGames(list, league) {
  const tbody = $('games-body');
  tbody.innerHTML = '';

  const getVal = (row, keys) => {
    for (const k of keys) {
      if (row && row[k] != null && row[k] !== '') return row[k];
      const lk = String(k).toLowerCase();
      for (const rk in row) {
        if (String(rk).toLowerCase() === lk && row[rk] != null && row[rk] !== '') return row[rk];
      }
    }
    return '';
  };

  const ymdFilter = (document.getElementById('date-filter')?.value || '').trim(); // YYYY-MM-DD
  let pdfMap = {};
  if (ymdFilter) {
    try {
      pdfMap = await getPdfLinks(league, ymdFilter);
    } catch (e) {
      pdfMap = {};
    }
  }

  const games = Array.isArray(list) ? list : [];
  const rows = [];

  for (const g of games) {
    const tsRaw = getVal(g, ['timestamp','Timestamp']);
    const ts = tsRaw ? new Date(tsRaw) : null;

    const ymd = ts && !isNaN(ts) ? ts.toISOString().slice(0,10) : '';

    const matchId = String(getVal(g, ['matchid','MatchID','id','ID','series','Series'])).trim();

    if (ymdFilter && ymd && ymd !== ymdFilter) continue;

    rows.push({ ymd: ymd || ymdFilter || '', matchId });
  }

  // якщо ігор не знайдено, але є pdfMap — показуємо по файлам
  if (!rows.length && ymdFilter && pdfMap && Object.keys(pdfMap).length) {
    Object.keys(pdfMap).sort().forEach(matchId => {
      rows.push({ ymd: ymdFilter, matchId });
    });
  }

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="opacity:.7">Немає даних</td></tr>';
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    const url = (pdfMap && r.matchId && pdfMap[r.matchId]) ? pdfMap[r.matchId] : '';

    tr.innerHTML = `
      <td>${escapeHtml(r.ymd || '')}</td>
      <td>${escapeHtml(r.matchId || '')}</td>
      <td>${url ? `<a href="${url}" target="_blank" rel="noopener">PDF</a>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

function askKey(nick) {
  let box = document.getElementById('profile-key');
  if (!box) {
    box = document.createElement('div');
    box.id = 'profile-key';
    box.style.color = '#f39c12';
    box.style.textAlign = 'center';
    box.style.marginTop = '1rem';
    box.innerHTML = `
      <p>Потрібен ключ доступу</p>
      <div style="margin-top:0.5rem;">
        <input type="text" id="key-input" placeholder="Введіть ключ" style="padding:0.5rem;border:2px solid #555;background:rgba(0,0,0,0.5);color:#fff;border-radius:4px;font-size:0.7rem;"/>
        <button id="key-submit" style="margin-left:0.5rem;">OK</button>
      </div>
      <p style="margin-top:0.5rem;"><a href="index.html" style="color:#ffd700;">На головну</a></p>
    `;
    document.querySelector('nav').insertAdjacentElement('afterend', box);
    document.getElementById('key-submit').addEventListener('click', () => {
      const key = document.getElementById('key-input').value.trim();
      if (key) {
        safeSet(localStorage, `profileKey:${nick}`, key);
        box.remove();
        loadProfile(nick, key);
      }
    });
  } else {
    box.style.display = 'block';
  }
  document.getElementById('profile').style.display = 'none';
}

async function loadProfile(nick, key = '') {
  currentNick = nick;
  let data;
  try {
    data = await getProfile({ nick, key });
    if (data.status === 'DENIED') {
      askKey(nick);
      return;
    }
  } catch (err) {
    log('[ranking]', err);
    const msg = 'Помилка завантаження профілю';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    showError('Помилка завантаження профілю');
    return;
  }
  const profile = data.profile || {};
  const league = data.league || profile.league || '';
  const games = await fetchPlayerGames(league, nick);
  await updateAvatar(nick);
  const rank = rankLetterForPoints(profile.points);
  document.getElementById('rating').textContent = `Рейтинг: ${profile.points} (${rank})`;
  const aboType = profile.abonement?.type || '';
  document.getElementById('abonement-type').textContent = `Абонемент: ${aboType}`;
  renderLegacyAwards(nick);

  gameLimit = profile.gameLimit || { standart: 5, vip: 10 }[aboType] || 0;
  gamesLeftEl = document.getElementById('games-left');
  if (!gamesLeftEl) {
    gamesLeftEl = document.createElement('div');
    gamesLeftEl.id = 'games-left';
    gamesLeftEl.style.marginTop = '0.5rem';
    const filterEl = document.querySelector('.filter');
    filterEl.parentNode.insertBefore(gamesLeftEl, filterEl);
  }

  const fileInput = document.getElementById('avatar-input');
  const changeBtn = document.getElementById('change-avatar');
  changeBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      const msg = 'Файл завеликий (max 2MB)';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
      fileInput.value = '';
      return;
    }

    fileInput.disabled = true;
    if (changeBtn) changeBtn.disabled = true;

    try {
      const resp = await uploadAvatar(nick, file);
      if (!resp || resp.status !== 'OK') {
        const status = resp?.status || 'ERR_UPLOAD';
        throw new Error(status);
      }

      let latestRecord = null;
      try {
        latestRecord = await fetchAvatarForNick(nick, { force: true });
      } catch (err) {
        log('[ranking]', err);
      }

      const timestamp = Date.now();
      const latestUrl = latestRecord?.url || resp?.url || AVATAR_PLACEHOLDER;
      const avatarEl = document.getElementById('avatar');
      if (avatarEl) {
        avatarEl.dataset.nick = nick;
        avatarEl.dataset.nickKey = avatarNickKey(nick);
        setImgSafe(avatarEl, latestUrl, timestamp, { param: 'ts' });
      }

      updateInlineAvatarImages(nick, latestUrl, timestamp);

      try {
        if (typeof Avatars.reloadAvatars === 'function') {
          await Avatars.reloadAvatars();
        }
        if (typeof Avatars.renderAllAvatars === 'function') {
          await Avatars.renderAllAvatars();
        }
      } catch (err) {
        log('[ranking]', err);
      }

      if (typeof showToast === 'function') showToast('Аватар збережено');
      else alert('Аватар збережено');
    } catch (err) {
      log('[ranking]', err);
      const fallback = 'Помилка завантаження';
      const reason = err?.message || fallback;
      noteAvatarFailure(nick, reason);
      const message = (typeof reason === 'string' && reason && !/^ERR_/i.test(reason) && !/^INVALID_/i.test(reason))
        ? reason
        : fallback;
      if (typeof showToast === 'function') showToast(message);
      else alert(message);
    } finally {
      fileInput.disabled = false;
      if (changeBtn) changeBtn.disabled = false;
      fileInput.value = '';
    }
  });

  await renderGames(games, league);
  document.getElementById('date-filter').addEventListener('change', () => renderGames(games, league));
}

document.addEventListener('DOMContentLoaded', () => {
  const params = parseQuery(location.search);
  const nick = params.nick;
  if (!nick) {
    showError('Нік не вказано');
    return;
  }
  const key = safeGet(localStorage, `profileKey:${nick}`) || '';
  currentNick = nick;
  loadProfile(nick, key);
});
