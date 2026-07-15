function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderPageError(root, {
  eyebrow = 'Зв’язок з ареною',
  title = 'Дані не завантажились',
  message = 'Перевір з’єднання та спробуй ще раз.',
  retryLabel = 'Спробувати ще раз',
  backHref = '#main',
  backLabel = 'На головну',
  onRetry
} = {}) {
  if (!root) return;

  root.innerHTML = `<section class="v2-page-state v2-page-state--error" role="alert">
    <div class="v2-page-state__signal" aria-hidden="true"><span></span><i></i></div>
    <p class="v2-page-state__eyebrow">${esc(eyebrow)}</p>
    <h1 class="v2-page-state__title">${esc(title)}</h1>
    <p class="v2-page-state__message">${esc(message)}</p>
    <div class="v2-page-state__actions">
      ${typeof onRetry === 'function' ? `<button class="v2-page-state__action v2-page-state__action--primary" type="button" data-page-retry>${esc(retryLabel)}</button>` : ''}
      <a class="v2-page-state__action" href="${esc(backHref)}">${esc(backLabel)}</a>
    </div>
  </section>`;

  const retryButton = root.querySelector('[data-page-retry]');
  retryButton?.addEventListener('click', async () => {
    retryButton.disabled = true;
    retryButton.setAttribute('aria-busy', 'true');
    retryButton.textContent = 'Повторюємо…';
    try {
      await onRetry();
    } finally {
      if (retryButton.isConnected) {
        retryButton.disabled = false;
        retryButton.removeAttribute('aria-busy');
        retryButton.textContent = retryLabel;
      }
    }
  });
}
