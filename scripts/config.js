const DEFAULT_PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
const DEFAULT_GAS_FALLBACK_URL =
  'https://script.google.com/macros/s/AKfycbzhQgbHauvk-ekGVHGRMUnEk-Rt-9M3QI_Jw-bjkRF4jAqpPtXQSDw3BsmivTHdvUY7Gw/exec';

const root = typeof window !== 'undefined' ? window : globalThis;

if (root && typeof root === 'object') {
  const rawProxyOrigin =
    typeof root.PROXY_ORIGIN === 'string' ? root.PROXY_ORIGIN.trim() : '';
  const rawFallbackUrl =
    typeof root.GAS_FALLBACK_URL === 'string' ? root.GAS_FALLBACK_URL.trim() : '';

  root.PROXY_ORIGIN = rawProxyOrigin || DEFAULT_PROXY_ORIGIN;
  root.GAS_FALLBACK_URL = rawFallbackUrl || DEFAULT_GAS_FALLBACK_URL;
}

export const AVATARS_SHEET_ID = '19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw';
export const AVATARS_GID = '2027704717';
export const AVATAR_PLACEHOLDER = 'assets/default_avatars/av0.png';
export { DEFAULT_GAS_FALLBACK_URL };
