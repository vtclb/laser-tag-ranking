import { loadSchoolEvents } from '../scripts/balance2/api.js';

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function schoolLabel(row = {}) { return row.schoolNumber ? `Школа №${row.schoolNumber}` : 'Без номера'; }

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

    const standings = el('table', 'school-standings');
    const thead = el('thead');
    const headTr = el('tr');
    ['Місце', 'Школа', 'Номер', 'Команда', 'І', 'В', 'Н', 'П', 'РМ', 'О'].forEach((h) => headTr.append(el('th', '', h)));
    thead.append(headTr);
    standings.append(thead);
    const tbody = el('tbody');
    ((latest.finalGroup?.standings || latest.standings || [])).forEach((row) => {
      const tr = document.createElement('tr');
      [row.place, row.schoolName || '—', row.schoolNumber || '—', row.teamName || '—', row.matchesPlayed || 0, row.wins || 0, row.draws || 0, row.losses || 0, row.pointsDiff || 0, row.tournamentPoints || 0]
        .forEach((v) => tr.append(el('td', '', String(v))));
      tbody.append(tr);
    });
    standings.append(tbody);
    root.append(standings);

    root.append(el('h3', '', `Чемпіон: ${latest.championTeamId || latest.finalGroup?.championTeamId || '—'}`));
  } catch {
    root.textContent = 'Не вдалося завантажити шкільні турніри.';
  }
}
