import { loadSchoolEvents } from '../scripts/balance2/api.js';

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function schoolLabel(row = {}) { return row.schoolNumber ? `Школа №${row.schoolNumber}` : 'Без номера'; }
function exportSchoolEventJson(event = {}) {
  const eventId = String(event?.eventId || 'draft').trim() || 'draft';
  const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `school-tournament-${eventId}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export async function initSchoolPage() {
  const root = document.getElementById('schoolPageRoot');
  if (!root) return;
  root.textContent = '';
  try {
    const res = await loadSchoolEvents();
    const events = Array.isArray(res?.data) ? res.data : [];
    if (!events.length) {
      root.textContent = 'Шкільних турнірів ще немає. Створіть перший у балансері.';
      return;
    }
    const latest = events[0];
    const list = el('div', 'school-events-list');
    events.forEach((event) => {
      const item = el('div', 'school-event-item');
      const totalPoints = (event.standings || []).reduce((a, r) => a + (Number(r.totalPoints) || 0), 0);
      item.append(el('strong', '', `${event.title || 'Шкільний турнір'} (${event.date || 'без дати'})`));
      item.append(el('div', '', `Команд: ${(event.teams || []).length} · Гравців: ${(event.teams || []).reduce((a,t)=>a+((t.players||[]).length),0)} · Боїв: ${(event.battles || []).length} · Балів: ${totalPoints}`));
      list.append(item);
    });
    root.append(list);

    root.append(el('h3', '', `${latest.title || 'Шкільний турнір'} · ${latest.date || 'без дати'}`));
    const exportBtn = el('button', 'chip', 'Експортувати JSON');
    exportBtn.type = 'button';
    exportBtn.addEventListener('click', () => exportSchoolEventJson(latest));
    root.append(exportBtn);

    const teamsWrap = el('div', 'school-events-list');
    (latest.teams || []).forEach((team, idx) => {
      const row = el('div', 'school-event-item');
      const schoolInfo = `${schoolLabel(team)} · ${team.schoolName || 'Без назви'} · ${team.teamName || `Команда ${idx + 1}`}`;
      row.append(el('strong', '', schoolInfo));
      row.append(el('div', '', `Гравців: ${(team.players || []).length} · Сила: ${Number(team.strengthPoints || 0)}`));
      teamsWrap.append(row);
    });
    root.append(teamsWrap);

    const renderStandings = (title, rows = []) => {
      root.append(el('h3', '', title));
      const standings = el('table', 'school-standings');
      const thead = el('thead');
      const headTr = el('tr');
      ['Місце', 'Школа', 'Номер', 'Команда', 'І', 'В', 'Н', 'П', 'РМ', 'О'].forEach((h) => headTr.append(el('th', '', h)));
      thead.append(headTr);
      standings.append(thead);
      const tbody = el('tbody');
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        [row.place, row.schoolName || '—', row.schoolNumber || '—', row.teamName || '—', row.matchesPlayed || 0, row.wins || 0, row.draws || 0, row.losses || 0, row.pointsDiff || 0, row.tournamentPoints || 0]
          .forEach((v) => tr.append(el('td', '', String(v))));
        tbody.append(tr);
      });
      standings.append(tbody);
      root.append(standings);
    };

    renderStandings('Group A', latest.groupStandings?.A || []);
    renderStandings('Group B', latest.groupStandings?.B || []);

    const renderMatches = (title, matches = []) => {
      root.append(el('h3', '', title));
      const wrap = el('div', 'school-events-list');
      matches.forEach((match, idx) => {
        const row = el('div', 'school-event-item');
        row.append(el('strong', '', match.title || `${title} · Матч ${idx + 1}`));
        row.append(el('div', '', `${match.teamAId} ${Number.isInteger(match?.result?.pointsA) ? match.result.pointsA : '—'} : ${Number.isInteger(match?.result?.pointsB) ? match.result.pointsB : '—'} ${match.teamBId} · ${match.status || 'pending'}`));
        wrap.append(row);
      });
      root.append(wrap);
    };

    renderMatches('Group A матчі', (latest.groupMatches || []).filter((m) => m.groupId === 'A'));
    renderMatches('Group B матчі', (latest.groupMatches || []).filter((m) => m.groupId === 'B'));
    renderStandings('Фінальна таблиця', latest.finalGroup?.standings || latest.standings || []);
    root.append(el('h3', '', 'Фінальні матчі'));
    const finalMatchesWrap = el('div', 'school-events-list');
    (latest.finalGroup?.matches || []).forEach((match, idx) => {
      const row = el('div', 'school-event-item');
      row.append(el('strong', '', match.title || `Фінальна група · Матч ${idx + 1}`));
      row.append(el('div', '', `${match.teamAId} ${Number.isInteger(match?.result?.pointsA) ? match.result.pointsA : '—'} : ${Number.isInteger(match?.result?.pointsB) ? match.result.pointsB : '—'} ${match.teamBId} · ${match.status || 'pending'}`));
      finalMatchesWrap.append(row);
    });
    root.append(finalMatchesWrap);

    const qualifiers = el('div', 'school-event-item');
    qualifiers.append(el('strong', '', 'Фіналісти'));
    qualifiers.append(el('div', '', `Group A: ${(latest.qualifiers?.A || []).join(', ') || '—'} · Group B: ${(latest.qualifiers?.B || []).join(', ') || '—'}`));
    if (latest.wildcard?.enabled && latest.wildcard?.teamId) {
      qualifiers.append(el('div', '', `Wildcard: ${latest.wildcard.teamId}`));
    }
    root.append(qualifiers);

    root.append(el('h3', '', `Чемпіон: ${latest.championTeamId || latest.finalGroup?.championTeamId || '—'}`));
  } catch {
    root.textContent = 'Не вдалося завантажити шкільні турніри.';
  }
}
