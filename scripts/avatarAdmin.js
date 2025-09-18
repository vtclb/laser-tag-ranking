// scripts/avatarAdmin.js
import { log } from './logger.js?v=2025-09-18-9';
import { uploadAvatar, gasPost, toBase64NoPrefix } from './api.js?v=2025-09-18-9';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-18-9';

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
  nickInput: null,
  fileInput: null,
  uploadBtn: null,
  refreshBtn: null,
  previewImg: null
};

let formReady = false;
let avatarModulePromise = null;

function showMessage(msg) {
  if (typeof showToast === 'function') showToast(msg);
  else alert(msg);
}

function queryFormElements() {
  const nickInput = document.getElementById('avatar-nick');
  const fileInput = document.getElementById('avatar-file');
  const uploadBtn = document.getElementById('avatar-upload');
  const refreshBtn = document.getElementById('avatars-refresh');
  const previewImg = document.getElementById('avatar-preview');

  if (!nickInput || !fileInput || !uploadBtn) return false;

  state.nickInput = nickInput;
  state.fileInput = fileInput;
  state.uploadBtn = uploadBtn;
  state.refreshBtn = refreshBtn;
  state.previewImg = previewImg;
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

async function ensureAvatarsModule() {
  if (!avatarModulePromise) {
    avatarModulePromise = import('./avatars.client.js?v=2025-09-18-9');
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
    log('[ranking]', err);
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

  uploadBtn.disabled = true;

  try {
    const mime = file.type || 'image/jpeg';
    const base64 = await toBase64NoPrefix(file);
    let resp;

    try {
      resp = await uploadAvatar(nick, file);
    } catch (err) {
      log('[ranking]', err);
      const fallback = await gasPost('', { action: UPLOAD_ACTION, nick, mime, data: base64 });
      if (!fallback || fallback.status !== 'OK') {
        const message = fallback?.message || fallback?.status || err?.message || 'Не вдалося завантажити аватар';
        throw new Error(message);
      }
      resp = fallback;
    }

    const imageUrl = resp?.url || AVATAR_PLACEHOLDER;
    const updatedAt = resp?.updatedAt || Date.now();

    applyAvatarToUI(nick, imageUrl);

    if (previewImg) {
      previewImg.hidden = false;
      setImgSafe(previewImg, imageUrl);
    }

    try {
      localStorage.setItem('avatarRefresh', `${nick}:${updatedAt}`);
    } catch (err) {
      log('[ranking]', err);
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
  } catch (err) {
    log('[ranking]', err);
    const message = err?.message || 'Не вдалося завантажити аватар';
    showMessage(message);
    noteAvatarFailure(nick || 'невідомо', message);
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

  formReady = true;
  return true;
}

function onDomReady() {
  setupAvatarAdminForm();
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
