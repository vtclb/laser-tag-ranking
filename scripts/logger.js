export function log(...args) {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug(...args);
  } else if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log(...args);
  }
}
