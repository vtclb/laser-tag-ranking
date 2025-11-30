const autoBalanceHandlers = new Set();

export function registerRecomputeAutoBalance(fn) {
  if (typeof fn === 'function') {
    autoBalanceHandlers.add(fn);
  }
}

export async function recomputeAutoBalance() {
  for (const handler of autoBalanceHandlers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await handler();
    } catch (err) {
      console.error('recomputeAutoBalance handler failed', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modeButtons = Array.from(document.querySelectorAll('#mode-switch [data-mode]'));
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      document.body.dataset.appMode = mode;
      modeButtons.forEach(b => b.classList.toggle('btn-primary', b === btn));
      document.querySelectorAll('.mode-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${mode}-panel`);
      });
      document.dispatchEvent(new CustomEvent('mode:change', { detail: { mode } }));
    });
  });
});
