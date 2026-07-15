function storageDebugEnabled() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('v2Debug') === '1';
  } catch {
    return false;
  }
}

const locationSearch = typeof window !== 'undefined' ? window.location?.search || '' : '';
const locationHash = typeof window !== 'undefined' ? window.location?.hash || '' : '';

export const DEBUG =
  new URLSearchParams(locationSearch).has('debug') ||
  locationHash.includes('debug=1') ||
  storageDebugEnabled();

export function debugLog(...args) {
  if (DEBUG) console.debug(...args);
}

export function debugInfo(...args) {
  if (DEBUG) console.info(...args);
}

export function debugWarn(...args) {
  if (DEBUG) console.warn(...args);
}
