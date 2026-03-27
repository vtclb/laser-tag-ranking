import { safeErrorMessage } from '../core/dataHub.js';

export async function initRulesPage() {
  const root = document.getElementById('rulesRoot') || document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження правил…</p></section>';
  try {
    const response = await fetch('../rules.html');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const content = doc.querySelector('.container');
    if (!content) throw new Error('Контент правил відсутній');
    root.innerHTML = `<section class="px-card rules-shell">${content.innerHTML}</section>`;
  } catch (error) {
    root.innerHTML = `<section class="px-card px-card--accent"><h2 class="px-card__title">Не вдалося завантажити правила</h2><p class="px-card__text">${safeErrorMessage(error, 'Помилка')}</p></section>`;
  }
}
