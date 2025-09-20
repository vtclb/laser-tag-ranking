// scripts/avatarAdmin.js
import { log } from './logger.js?v=2025-09-19-avatars-2';
import { uploadAvatar, loadPlayers, avatarNickKey, fetchAvatarForNick } from './api.js?v=2025-09-19-avatars-2';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-avatars-2';
import * as Avatars from './avatars.client.js?v=2025-09-19-avatars-2';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export let avatarFailures = 0;

export function noteAvatarFailure(nick, reason) {
  avatarFailures++;
  const msg = `Avatar issue for ${nick}: ${reason}`;
  console.warn(msg);
  if (typeof showToast === 'function') showToast(msg);
}

export function normalizeAvatarUrl(url = '') {
  if (!url) return AVATAR_PLACEHOLDER;
  if (url.includes('drive.google.com')) {
    const idMatch = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
    if (idMatch) {
      return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w512`;
    }
  }
  return url;
}

function resolveBustValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function cacheBustUrl(src, bust, param = 't') {
  const base = src || '';
  if (!base) return base;
  const sep = base.includes('?') ? '&' : '?';
  const key = typeof param === 'string' && param.trim() ? param.trim() : 't';
  return `${base}${sep}${key}=${bust}`;
}

export function setImgSafe(img, url, bust, options = {}) {
  if (!img) return;
  const src = normalizeAvatarUrl(url);
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.decoding = 'async';
  const effectiveBust = resolveBustValue(bust);
  const param = typeof options?.param === 'string' && options.param.trim() ? options.param.trim() : 't';
  img.onerror = () => {
    img.onerror = null;
    img.src = cacheBustUrl(AVATAR_PLACEHOLDER, effectiveBust, param);
  };
  const cacheSafe = src.startsWith('data:') || src.startsWith('blob:');
  const finalSrc = cacheSafe ? src : cacheBustUrl(src, effectiveBust, param);
  img.src = finalSrc;
}

export function applyAvatarToUI(nick, imageUrl) {
  const url = imageUrl || AVATAR_PLACEHOLDER;
  const key = avatarNickKey(nick);
  if (!key) return;
  document.querySelectorAll('img[data-nick], img[data-nick-key]').forEach(img => {
    if (!img) return;
    const candidate = img.dataset.nickKey || img.dataset.nick || '';
    const currentKey = avatarNickKey(candidate);
    if (!currentKey || currentKey !== key) return;
    img.dataset.nickKey = currentKey;
    if (nick && !img.dataset.nick) img.dataset.nick = nick;
    setImgSafe(img, url);
  });
}

function escapeNickForSelector(nick) {
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(nick);
  }
  return String(nick).replace(/['"\\]/g, '\\$&');
}

export function updateInlineAvatarImages(nick, imageUrl, bust) {
  const trimmed = typeof nick === 'string' ? nick.trim() : '';
  const key = avatarNickKey(trimmed);
  if (!trimmed || !key) return false;

  const bustValue = resolveBustValue(bust);
  const safeUrl = imageUrl || AVATAR_PLACEHOLDER;
  const nodes = new Set();

  const escaped = escapeNickForSelector(trimmed);
  [`[data-nick="${escaped}"] img.avatar`, `img.avatar[data-nick="${escaped}"]`].forEach(selector => {
    document.querySelectorAll(selector).forEach(img => nodes.add(img));
  });

  document.querySelectorAll('[data-nick] img.avatar, img.avatar[data-nick]').forEach(img => {
    const container = img.closest('[data-nick]');
    const containerNick = img.dataset?.nick || container?.dataset?.nick || '';
    if (!containerNick) return;
    if (avatarNickKey(containerNick) !== key) return;
    nodes.add(img);
  });

  document.querySelectorAll('img.avatar[data-nick-key]').forEach(img => {
    const currentKey = typeof img.dataset.nickKey === 'string' ? img.dataset.nickKey : '';
    if (currentKey === key) nodes.add(img);
  });

  if (!nodes.size) return false;

  nodes.forEach(img => {
    if (!img) return;
    img.dataset.nick = trimmed;
    img.dataset.nickKey = key;
    setImgSafe(img, safeUrl, bustValue, { param: 'ts' });
  });

  return true;
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

async function populatePlayersDatalist(league) {
  const { playersDatalist } = state;
  if (!playersDatalist) return;

  playersDatalist.innerHTML = '';
  if (!league) return;

  const token = ++playersLoadToken;

  try {
    const players = await loadPlayers(league);
    if (token !== playersLoadToken) return;

    const fragment = document.createDocumentFragment();
    players.forEach(p => {
      if (!p || !p.nick) return;
      const option = document.createElement('option');
      option.value = p.nick;
      fragment.appendChild(option);
    });
    playersDatalist.appendChild(fragment);
  } catch (err) {
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
    const resp = await uploadAvatar(nick, file);

    const uploadedUrl = resp?.url || AVATAR_PLACEHOLDER;
    console.debug('[avatarAdmin] uploaded', { nick, url: uploadedUrl });

    let latestRecord = null;
    try {
      latestRecord = await fetchAvatarForNick(nick, { force: true });
    } catch (err) {
      log('[avatarAdmin]', err);
    }

    const timestamp = Date.now();
    const latestUrl = latestRecord?.url || uploadedUrl;

    if (previewImg) {
      previewImg.hidden = false;
      setImgSafe(previewImg, latestUrl, timestamp, { param: 'ts' });
    }

    updateInlineAvatarImages(nick, latestUrl, timestamp);

    let reloadError = null;
    try {
      if (typeof Avatars.reloadAvatars === 'function') {
        await Avatars.reloadAvatars({ fresh: true });
      }
      if (typeof Avatars.renderAllAvatars === 'function') {
        await Avatars.renderAllAvatars();
      }
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
    if (typeof Avatars.reloadAvatars === 'function') {
      await Avatars.reloadAvatars({ fresh: true });
    }
    if (typeof Avatars.renderAllAvatars === 'function') {
      await Avatars.renderAllAvatars();
    }
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

export async function initAvatarAdmin() {
  if (formReady) return;
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  setupAvatarAdminForm();
}
