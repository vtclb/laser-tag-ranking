import { DRAFT_KEY, PENDING_WRITE_KEY, PLAYER_CACHE_PREFIX } from './config.js';
import { sanitizeRestoredState } from './domain.js';

function storageAvailable() {
  try {
    const key = '__balance3_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function saveDraft(state) {
  if (!storageAvailable()) return false;
  try {
    const snapshot = {
      ...state,
      save: { status: 'idle', message: '', requestId: '' },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function readDraft() {
  if (!storageAvailable()) return null;
  try {
    return sanitizeRestoredState(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (!storageAvailable()) return;
  localStorage.removeItem(DRAFT_KEY);
}

export function savePendingWrite(record) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(PENDING_WRITE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function readPendingWrite() {
  if (!storageAvailable()) return null;
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_WRITE_KEY) || 'null');
    if (!value || typeof value !== 'object' || !value.payload || !value.requestId) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearPendingWrite() {
  if (!storageAvailable()) return;
  localStorage.removeItem(PENDING_WRITE_KEY);
}

export function savePlayerCache(league, players) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(`${PLAYER_CACHE_PREFIX}:${league}`, JSON.stringify({ savedAt: Date.now(), players }));
  } catch {
    // Cache failures must not block the game flow.
  }
}

export function readPlayerCache(league, maxAgeMs = 15 * 60 * 1000) {
  if (!storageAvailable()) return [];
  try {
    const cached = JSON.parse(localStorage.getItem(`${PLAYER_CACHE_PREFIX}:${league}`) || 'null');
    if (!cached || Date.now() - Number(cached.savedAt) > maxAgeMs || !Array.isArray(cached.players)) return [];
    return cached.players;
  } catch {
    return [];
  }
}
