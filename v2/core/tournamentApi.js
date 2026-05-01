import { jsonp } from './utils.js';

const TOURNAMENTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxzIEh2-gluSxvtUqCDmpGodhFntF-t59Q9OSBEjTxqdfURS3MlYwm6vcZ-1s4XPd0kHQ/exec';

async function gasTournamentJsonp(action, params = {}, timeoutMs = 15_000) {
  const response = await jsonp(TOURNAMENTS_ENDPOINT, { action, ...params }, timeoutMs);
  if (response?.status === 'ERR') {
    throw new Error(response?.message || 'Tournament API error');
  }
  return response || {};
}

export async function listActiveTournaments(timeoutMs = 15_000) {
  return gasTournamentJsonp('listTournaments', { mode: 'tournament', status: 'ACTIVE' }, timeoutMs);
}

export async function getTournamentData(tournamentId, timeoutMs = 20_000) {
  return gasTournamentJsonp('getTournamentData', { mode: 'tournament', tournamentId }, timeoutMs);
}
