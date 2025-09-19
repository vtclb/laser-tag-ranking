export const AVATAR_PLACEHOLDER = 'assets/default_avatars/av0.png';
export const AVATARS_SHEET_ID = '19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw';
export const AVATARS_GID = '2027704717';

const DEFAULT_PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
const DEFAULT_GAS_FALLBACK_URL =
  'https://script.google.com/macros/s/AKfycbzhQgbHauvk-ekGVHGRMUnEk-Rt-9M3QI_Jw-bjkRF4jAqpPtXQSDw3BsmivTHdvUY7Gw/exec';

const root = typeof window !== 'undefined' ? window : globalThis;
root.PROXY_ORIGIN = (root.PROXY_ORIGIN || '').trim() || DEFAULT_PROXY_ORIGIN;
root.GAS_FALLBACK_URL = (root.GAS_FALLBACK_URL || '').trim() || DEFAULT_GAS_FALLBACK_URL;

export { DEFAULT_GAS_FALLBACK_URL };
