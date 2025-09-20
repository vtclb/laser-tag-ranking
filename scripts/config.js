export const VERSION = '2025-09-19-avatars-1';
export const AVATAR_PLACEHOLDER = 'assets/default_avatars/av0.png';

const DEFAULT_PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
const DEFAULT_GAS_FALLBACK_URL =
  'https://script.google.com/macros/s/AKfycbzhQgbHauvk-ekGVHGRMUnEk-Rt-9M3QI_Jw-bjkRF4jAqpPtXQSDw3BsmivTHdvUY7Gw/exec';

const root = typeof window !== 'undefined' ? window : globalThis;

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureTrailingSlash(url) {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

const resolvedProxyOrigin = trimString(root.PROXY_ORIGIN) || DEFAULT_PROXY_ORIGIN;
root.PROXY_ORIGIN = resolvedProxyOrigin;

const proxyBaseFromOrigin = ensureTrailingSlash(
  resolvedProxyOrigin.replace(/\/+$/, '') + '/avatars'
);

const configuredAvatarBase = trimString(root.AVATAR_PROXY_BASE) || trimString(root.AVATAR_PROXY_URL);
const normalizedAvatarBase = ensureTrailingSlash(configuredAvatarBase || proxyBaseFromOrigin);

root.AVATAR_PROXY_BASE = normalizedAvatarBase;
root.GAS_FALLBACK_URL = trimString(root.GAS_FALLBACK_URL) || DEFAULT_GAS_FALLBACK_URL;

export const AVATAR_PROXY_BASE = root.AVATAR_PROXY_BASE;

export { DEFAULT_GAS_FALLBACK_URL };
