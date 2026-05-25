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
    standings.innerHTML = '<thead><tr><th>Місце</th><th>Школа</th><th>Номер</th><th>Команда</th><th>Гравці</th><th>Бої</th><th>Бали</th><th>Сер.</th><th>Перемоги</th><th>Найкращий бій</th></tr></thead>';
    const tbody = el('tbody');
    (latest.standings || []).forEach((row) => {
      const tr = document.createElement('tr');
      [row.place, row.schoolName || '—', row.schoolNumber || '—', row.teamName || '—', row.playersCount || 0, row.battlesPlayed || 0, row.totalPoints || 0, row.averagePoints || 0, row.winsByBattle || 0, row.bestBattlePoints || 0]
        .forEach((v) => tr.append(el('td', '', String(v))));
      tbody.append(tr);
    });
    standings.append(tbody);
    root.append(standings);

    const battles = el('div', 'school-battles');
    (latest.battles || []).forEach((battle, idx) => {
      const card = el('div', 'school-battle-item');
      card.append(el('strong', '', battle.title || `Бій ${idx + 1}`));
      (battle.results || []).forEach((r) => card.append(el('div', '', `${schoolLabel((latest.teams || []).find((t) => t.id === r.teamId) || {})} — ${r.points}`)));
      battles.append(card);
    });
    root.append(battles);
  } catch {
    root.textContent = 'Не вдалося завантажити шкільні турніри.';
  }
}
