export const DEBUG =
  new URLSearchParams(window.location.search).has('debug') ||
  window.location.hash.includes('debug=1') ||
  localStorage.getItem('v2Debug') === '1';

export function debugLog(...args) {
  if (DEBUG) console.debug(...args);
}

export function debugInfo(...args) {
  if (DEBUG) console.info(...args);
}

export function debugWarn(...args) {
  if (DEBUG) console.warn(...args);
}
