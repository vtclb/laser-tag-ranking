// scripts/avatarAdmin.js
import { log } from './logger.js';
import { uploadAvatar, loadPlayers, avatarNickKey } from './api.js';
import { AVATAR_PLACEHOLDER, AVATAR_WORKER_BASE } from './avatarConfig.js';
import { reloadAvatars } from './avatars.client.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const RAW_WORKER_BASE = typeof AVATAR_WORKER_BASE === 'string' ? AVATAR_WORKER_BASE.trim() : '';
const WORKER_BASE = RAW_WORKER_BASE ? RAW_WORKER_BASE.replace(/\/+$/, '') : '';
const AVATAR_LOOKUP_BASE = WORKER_BASE ? `${WORKER_BASE}/avatars` : '';

export let avatarFailures = 0;

function nickKey(value) {
  return avatarNickKey(value);
}

export function noteAvatarFailure(nick, reason) {
  avatarFailures++;
  const msg = `Avatar issue for ${nick}: ${reason}`;
  console.warn(msg);
  if (typeof showToast === 'function') showToast(msg);
}

function toTimestamp(value, fallback = Date.now()) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function bustUrl(url, stamp = Date.now(), param = 'ts') {
  const base = typeof url === 'string' ? url.trim() : '';
  if (!base) return '';
  if (/^(?:data|blob):/i.test(base)) return base;
  const token = Number.isFinite(stamp) ? stamp : Date.now();
  try {
    const parsed = new URL(base, (typeof window !== 'undefined' && window.location) ? window.location.origin : undefined);
    if (param) parsed.searchParams.set(param, token);
    return parsed.toString();
  } catch {
    const separator = base.includes('?') ? '&' : '?';
    const key = typeof param === 'string' && param.trim() ? param.trim() : 'ts';
    return `${base}${separator}${key}=${token}`;
  }
}

export function setImgSafe(img, url, stamp, options = {}) {
  if (!img) return;
  const param = typeof options?.param === 'string' && options.param.trim() ? options.param.trim() : 'ts';
  const cacheStamp = toTimestamp(stamp);
  const source = typeof url === 'string' && url.trim() ? url.trim() : '';
  const finalUrl = source ? bustUrl(source, cacheStamp, param) : '';
  const fallback = bustUrl(AVATAR_PLACEHOLDER, cacheStamp, param) || AVATAR_PLACEHOLDER;
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => {
    img.onerror = null;
    img.src = fallback;
  };
  img.src = finalUrl || fallback;
}

export function updateInlineAvatarImages(nick, imageUrl, stamp) {
  const trimmed = typeof nick === 'string' ? nick.trim() : '';
  const key = nickKey(trimmed);
  if (!trimmed || !key) return false;

  const nodes = new Set();

  document.querySelectorAll('img[data-nick], img[data-nick-key]').forEach(img => {
    if (!img) return;
    const currentKey = typeof img.dataset.nickKey === 'string' && img.dataset.nickKey.trim()
      ? img.dataset.nickKey.trim()
      : nickKey(img.dataset.nick || '');
    if (currentKey === key) nodes.add(img);
  });

  document.querySelectorAll('[data-nick] img').forEach(img => {
    const container = img.closest('[data-nick]');
    const containerNick = container?.dataset?.nick || '';
    if (nickKey(containerNick) === key) nodes.add(img);
  });

  if (!nodes.size) return false;

  const targetUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  const cacheStamp = toTimestamp(stamp);

  nodes.forEach(img => {
    img.dataset.nick = trimmed;
    img.dataset.nickKey = key;
    setImgSafe(img, targetUrl || AVATAR_PLACEHOLDER, cacheStamp, { param: 'ts' });
  });

  return true;
}

async function fetchWorkerAvatarRecord(nick) {
  const trimmed = typeof nick === 'string' ? nick.trim() : '';
  const fallbackStamp = Date.now();
  if (!trimmed || !AVATAR_LOOKUP_BASE) {
    return { url: '', timestamp: fallbackStamp };
  }

  const lookupUrl = `${AVATAR_LOOKUP_BASE}/${encodeURIComponent(trimmed)}`;
  const requestStamp = Date.now();
  const requestUrl = `${lookupUrl}?ts=${requestStamp}`;

  try {
    const response = await fetch(requestUrl, { cache: 'no-store' });
    if (!response || !response.ok) {
      throw new Error(`HTTP ${response?.status ?? 'ERR'}`);
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      throw new Error(`Avatar response parse failed: ${err?.message || err}`);
    }
    const resolvedUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
    const updatedAt = toTimestamp(payload?.updatedAt, requestStamp);
    return { url: resolvedUrl, timestamp: updatedAt };
  } catch (err) {
    log('[avatarAdmin] worker fetch failed', err);
    return { url: '', timestamp: requestStamp };
  }
}

const state = {
  leagueSelect: null,
  nickInput: null,
  playersDatalist: null,
  fileInput: null,
  uploadBtn: null,
  refreshBtn: null,
  previewImg: null,
  statusEl: null,
  isUploading: false
};

let formReady = false;
let statusHideTimer = null;

function setStatus(message, options = {}) {
  const { statusEl } = state;
  if (!statusEl) return;

  if (statusHideTimer) {
    clearTimeout(statusHideTimer);
    statusHideTimer = null;
  }

  if (!message) {
    statusEl.textContent = '';
    statusEl.hidden = true;
    return;
  }

  statusEl.textContent = message;
  statusEl.hidden = false;

  if (options.autoHide) {
    const delay = typeof options.delay === 'number' ? options.delay : 2500;
    statusHideTimer = setTimeout(() => {
      statusHideTimer = null;
      statusEl.textContent = '';
      statusEl.hidden = true;
    }, delay);
  }
}

function showMessage(msg) {
  if (typeof showToast === 'function') showToast(msg);
  else alert(msg);
}

function queryFormElements() {
  const leagueSelect = document.getElementById('league-select-lg');
  const nickInput = document.getElementById('avatar-nick');
  const playersDatalist = document.getElementById('players-datalist');
  const fileInput = document.getElementById('avatar-file');
  const uploadBtn = document.getElementById('avatar-upload');
  const refreshBtn = document.getElementById('avatars-refresh');
  const previewImg = document.getElementById('avatar-preview');
  const statusEl = document.getElementById('avatar-status');

  if (!nickInput || !fileInput || !uploadBtn) return false;

  state.leagueSelect = leagueSelect;
  state.nickInput = nickInput;
  state.playersDatalist = playersDatalist;
  state.fileInput = fileInput;
  state.uploadBtn = uploadBtn;
  state.refreshBtn = refreshBtn;
  state.previewImg = previewImg;
  state.statusEl = statusEl;

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.hidden = true;
  }
  return true;
}

function resetPreview() {
  const { previewImg } = state;
  if (!previewImg) return;
  setImgSafe(previewImg, AVATAR_PLACEHOLDER);
  previewImg.hidden = true;
}

function updateUploadButtonState() {
  const { nickInput, fileInput, uploadBtn, isUploading } = state;
  if (!uploadBtn) return;
  if (isUploading) {
    uploadBtn.disabled = true;
    return;
  }
  const hasNick = Boolean(nickInput?.value?.trim());
  const hasFile = Boolean(fileInput?.files && fileInput.files[0]);
  uploadBtn.disabled = !(hasNick && hasFile);
}

function clearFileSelection(options = {}) {
  const { fileInput } = state;
  if (fileInput) fileInput.value = '';
  if (!options.keepPreview) resetPreview();
  updateUploadButtonState();
}

function handleFileChange() {
  const { fileInput, previewImg } = state;
  const file = fileInput?.files && fileInput.files[0];

  if (!file) {
    resetPreview();
    updateUploadButtonState();
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showMessage('Файл завеликий (макс. 2 МБ)');
    clearFileSelection();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (previewImg && typeof reader.result === 'string') {
      previewImg.src = reader.result;
      previewImg.hidden = false;
    }
    updateUploadButtonState();
  };
  reader.onerror = () => {
    showMessage('Не вдалося прочитати файл аватара');
    clearFileSelection();
  };
  reader.readAsDataURL(file);
}

let playersLoadToken = 0;

function fillPlayersDatalist(players) {
  const { playersDatalist } = state;
  if (!playersDatalist) return;

  playersDatalist.innerHTML = '';
  if (!Array.isArray(players) || !players.length) return;

  const fragment = document.createDocumentFragment();
  const seen = new Set();
  const sorted = [...players]
    .filter(p => p && typeof p.nick === 'string' && p.nick.trim())
    .sort((a, b) => a.nick.localeCompare(b.nick, 'uk'));

  sorted.forEach(player => {
    const nick = player.nick.trim();
    if (seen.has(nick)) return;
    seen.add(nick);
    const option = document.createElement('option');
    option.value = nick;
    fragment.appendChild(option);
  });

  playersDatalist.appendChild(fragment);
}

async function populatePlayersDatalist(league, options = {}) {
  const providedPlayers = Array.isArray(options?.players) ? options.players : null;
  const normalizedLeague = typeof league === 'string' ? league.trim() : '';
  const token = ++playersLoadToken;

  fillPlayersDatalist([]);

  if (providedPlayers) {
    fillPlayersDatalist(providedPlayers);
    return;
  }

  const targetLeague = normalizedLeague || state.leagueSelect?.value || '';
  if (!targetLeague) return;

  try {
    const players = await loadPlayers(targetLeague);
    if (token !== playersLoadToken) return;
    fillPlayersDatalist(players);
  } catch (err) {
    if (token !== playersLoadToken) return;
    log('[avatarAdmin]', err);
  }
}

async function handleUploadClick() {
  const { nickInput, fileInput, uploadBtn, previewImg } = state;
  const nick = nickInput?.value?.trim();
  const file = fileInput?.files && fileInput.files[0];

  if (!nick) {
    showMessage('Вкажи нік гравця');
    nickInput?.focus();
    return;
  }
  if (!file) {
    showMessage('Додай файл аватара');
    fileInput?.focus();
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showMessage('Файл завеликий (макс. 2 МБ)');
    clearFileSelection();
    return;
  }

  state.isUploading = true;
  if (uploadBtn) uploadBtn.disabled = true;
  if (fileInput) fileInput.disabled = true;
  setStatus('Завантаження…');

  try {
    const response = await uploadAvatar(nick, file);
    const uploadedUrl = typeof response?.url === 'string' ? response.url.trim() : '';
    console.debug('[avatarAdmin] uploaded', { nick, url: uploadedUrl });

    const workerRecord = await fetchWorkerAvatarRecord(nick);
    const timestamp = toTimestamp(workerRecord?.timestamp, Date.now());
    const latestUrl = workerRecord?.url?.trim() || uploadedUrl;

    if (previewImg) {
      previewImg.hidden = false;
      setImgSafe(previewImg, latestUrl || AVATAR_PLACEHOLDER, timestamp, { param: 'ts' });
    }

    updateInlineAvatarImages(nick, latestUrl || AVATAR_PLACEHOLDER, timestamp);

    let reloadError = null;
    try {
      await reloadAvatars(document);
    } catch (err) {
      reloadError = err;
      log('[avatarAdmin]', err);
    }

    showMessage('Аватар збережено');
    clearFileSelection({ keepPreview: true });

    if (reloadError) {
      setStatus('Аватар збережено, але не вдалося оновити список аватарів');
    } else {
      setStatus('Готово', { autoHide: true });
    }
  } catch (err) {
    log('[avatarAdmin]', err);
    const message = err?.message || 'Не вдалося завантажити аватар';
    showMessage(message);
    noteAvatarFailure(nick || 'невідомо', message);
    setStatus('Помилка завантаження');
  } finally {
    state.isUploading = false;
    if (fileInput) fileInput.disabled = false;
    updateUploadButtonState();
  }
}

async function handleRefreshClick(event) {
  event?.preventDefault?.();
  const { refreshBtn } = state;
  if (refreshBtn) refreshBtn.disabled = true;
  try {
    await reloadAvatars(document);
  } catch (err) {
    log('[avatarAdmin]', err);
    showMessage('Не вдалося оновити список аватарів');
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function setupAvatarAdminForm() {
  if (formReady) return true;
  if (!queryFormElements()) return false;

  resetPreview();
  updateUploadButtonState();

  state.nickInput?.addEventListener('input', updateUploadButtonState);
  state.fileInput?.addEventListener('change', handleFileChange);
  state.uploadBtn?.addEventListener('click', handleUploadClick);
  state.refreshBtn?.addEventListener('click', handleRefreshClick);
  state.leagueSelect?.addEventListener('change', () => {
    const league = state.leagueSelect?.value;
    populatePlayersDatalist(league).catch(err => {
      log('[avatarAdmin]', err);
    });
  });

  formReady = true;
  return true;
}

function onDomReady() {
  if (!setupAvatarAdminForm()) return;
  const league = state.leagueSelect?.value;
  populatePlayersDatalist(league).catch(err => {
    log('[avatarAdmin]', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
} else {
  onDomReady();
}

export async function initAvatarAdmin(players, league) {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  if (!setupAvatarAdminForm()) return;

  const nextLeague = typeof league === 'string' && league.trim() ? league.trim() : state.leagueSelect?.value || '';
  if (nextLeague && state.leagueSelect) {
    state.leagueSelect.value = nextLeague;
  }

  await populatePlayersDatalist(nextLeague, { players });
}
