import { loadSchoolEvents } from '../scripts/balance2/api.js';

function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}

export async function initSchoolPage() {
  const root = document.getElementById('schoolPageRoot');
  if (!root) return;
  try {
    const res = await loadSchoolEvents();
    const events = Array.isArray(res?.data) ? res.data : [];
    if (!events.length) {
      root.textContent = 'Шкільних турнірів ще немає. Створіть перший у балансері.';
      return;
    }
    const active = events[0];
    root.innerHTML = `<div><strong>${esc(active.title || 'Шкільний турнір')}</strong></div><div>Подій: ${events.length}</div>`;
  } catch (e) {
    root.textContent = `Помилка завантаження: ${e?.message || 'невідома помилка'}`;
  }
}
