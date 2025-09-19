// scripts/avatarAdmin.js
import { log } from './logger.js?v=2025-09-18-12';
import { uploadAvatar, gasPost, toBase64NoPrefix, loadPlayers } from './api.js?v=2025-09-18-12';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-18-12';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const UPLOAD_ACTION = 'uploadAvatar';

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

export function setImgSafe(img, url) {
  if (!img) return;
  const src = normalizeAvatarUrl(url);
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
  const cacheSafe = src.startsWith('data:') || src.startsWith('blob:');
  const finalSrc = cacheSafe ? src : src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
  img.src = finalSrc;
}

export function applyAvatarToUI(nick, imageUrl) {
  const url = imageUrl || AVATAR_PLACEHOLDER;
  document.querySelectorAll(`img[data-nick="${nick}"]`).forEach(img => setImgSafe(img, url));
}

const state = {
  leagueSelect: null,
  nickInput: null,
  playersDatalist: null,
  fileInput: null,
  uploadBtn: null,
  refreshBtn: null,
  previewImg: null,
  statusEl: null
};

let formReady = false;
let avatarModulePromise = null;
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
  const { nickInput, fileInput, uploadBtn } = state;
  if (!uploadBtn) return;
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

async function ensureAvatarsModule() {
  if (!avatarModulePromise) {
    avatarModulePromise = import('./avatars.client.js?v=2025-09-18-12');
  }
  return avatarModulePromise;
}

async function reloadAvatarsSafe(options) {
  try {
    const mod = await ensureAvatarsModule();
    if (mod && typeof mod.reloadAvatars === 'function') {
      await mod.reloadAvatars(options);
    }
  } catch (err) {
    log('[avatarAdmin]', err);
    throw err;
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

  if (uploadBtn) uploadBtn.disabled = true;
  setStatus('Завантаження…');

  try {
    const mime = file.type || 'image/jpeg';
    const base64 = await toBase64NoPrefix(file);
    let resp;

    try {
      resp = await uploadAvatar(nick, file);
    } catch (err) {
      log('[avatarAdmin]', err);
      const fallback = await gasPost('', { action: UPLOAD_ACTION, nick, mime, data: base64 });
      if (!fallback || fallback.status !== 'OK') {
        const message = fallback?.message || fallback?.status || err?.message || 'Не вдалося завантажити аватар';
        throw new Error(message);
      }
      resp = fallback;
    }

    const imageUrl = resp?.url || AVATAR_PLACEHOLDER;
    const updatedAt = resp?.updatedAt || Date.now();

    if (previewImg) {
      previewImg.hidden = false;
      setImgSafe(previewImg, imageUrl);
    }

    try {
      localStorage.setItem('avatarRefresh', `${nick}:${updatedAt}`);
    } catch (err) {
      log('[avatarAdmin]', err);
    }

    let reloadFailed = false;
    try {
      await reloadAvatarsSafe({ bust: updatedAt });
    } catch (err) {
      reloadFailed = true;
      showMessage('Аватар оновлено, але не вдалося перезавантажити список аватарів');
    }

    if (!reloadFailed) {
      showMessage('Аватар успішно завантажено');
    }
    clearFileSelection({ keepPreview: true });
    setStatus('Готово', { autoHide: true });
  } catch (err) {
    log('[avatarAdmin]', err);
    const message = err?.message || 'Не вдалося завантажити аватар';
    showMessage(message);
    noteAvatarFailure(nick || 'невідомо', message);
    setStatus('Помилка завантаження');
  } finally {
    updateUploadButtonState();
  }
}

async function handleRefreshClick(event) {
  event?.preventDefault?.();
  const { refreshBtn } = state;
  if (refreshBtn) refreshBtn.disabled = true;
  try {
    await reloadAvatarsSafe({ bust: Date.now() });
  } catch (err) {
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

window.addEventListener('storage', e => {
  if (e.key === 'avatarRefresh') {
    reloadAvatarsSafe().catch(() => {});
  }
});
