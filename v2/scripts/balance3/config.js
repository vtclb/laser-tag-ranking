export const APP_VERSION = 1;
export const MAX_PLAYERS = 50;
export const MIN_TEAM_COUNT = 2;
export const MAX_TEAM_COUNT = 12;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 10;
export const TEAM_IDS = Array.from({ length: MAX_TEAM_COUNT }, (_, index) => `team${index + 1}`);
export const DRAFT_KEY = `balance3:draft:v${APP_VERSION}`;
export const PLAYER_CACHE_PREFIX = `balance3:players:v${APP_VERSION}`;
export const PENDING_WRITE_KEY = `balance3:pending-write:v${APP_VERSION}`;
export const PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
export const GAMES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv';

export const LEAGUES = Object.freeze({
  kids: { id: 'kids', label: 'Дитяча' },
  sundaygames: { id: 'sundaygames', label: 'Доросла' },
});
