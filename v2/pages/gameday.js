import { getGameDay, safeErrorMessage } from '../core/dataHub.js';

const dateInput = document.getElementById('dateInput');
const leagueSelect = document.getElementById('leagueSelect');
const storageKey = 'v2:lastLeague';

function renderMatch(m) {
  const changes = (m.pointsChanges || []).map((entry) => `${entry.nick}: ${entry.delta >= 0 ? '+' : ''}${entry.delta ?? 0}`).join(' · ');
  return `<li style="padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.14);"><strong>${(m.teams.sideA || []).join(', ')} vs ${(m.teams.sideB || []).join(', ')}</strong><br>Winner: ${m.winner || '—'} · MVP: ${m.mvp || '—'} · Rounds: ${m.rounds || 1}<br><span class="tag">Δpoints: ${changes || '—'}</span></li>`;
}

async function load() {
  const state = document.getElementById('state');
  const ymd = dateInput.value;
  const league = leagueSelect.value;
  localStorage.setItem(storageKey, league);
  state.textContent = 'Завантаження...';
  try {
    const data = await getGameDay({ date: ymd, league });
    document.getElementById('header').textContent = `${data.date} · ${data.league}`;
    document.getElementById('totals').textContent = `Ігор: ${data.matches.length} · Активних: ${data.activePlayers.length}`;
    document.getElementById('players').innerHTML = data.activePlayers.map((p) => `<li>${p.nick} · ігор: ${p.matchesToday} · MVP: ${p.mvpToday}</li>`).join('') || '<li class="placeholder">Нема ігор за цю дату.</li>';
    document.getElementById('matches').innerHTML = data.matches.map(renderMatch).join('') || '<li class="placeholder">Нема ігор за цю дату.</li>';
    state.textContent = '';
  } catch (error) {
    state.textContent = safeErrorMessage(error);
  }
}

dateInput.value = new Date().toISOString().slice(0, 10);
leagueSelect.value = localStorage.getItem(storageKey) || 'sundaygames';
document.getElementById('showBtn').addEventListener('click', load);
dateInput.addEventListener('change', load);
leagueSelect.addEventListener('change', load);
load();
