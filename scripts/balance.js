// scripts/balance.js

export let balanceMode = localStorage.getItem('balancerMode') || 'auto';

let recomputeHandler = null;

export function getBalanceMode() {
  return balanceMode;
}

export function registerRecomputeAutoBalance(fn) {
  recomputeHandler = typeof fn === 'function' ? fn : null;
}

export function recomputeAutoBalance() {
  if (typeof recomputeHandler === 'function') {
    recomputeHandler();
  }
}

export function applyModeUI() {
  const autoBtn = document.getElementById('mode-auto');
  const manualBtn = document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.classList.toggle('btn-primary', balanceMode === 'auto');
  }
  if (manualBtn) {
    manualBtn.classList.toggle('btn-primary', balanceMode === 'manual');
  }
  if (document.body) {
    document.body.dataset.balanceMode = balanceMode;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const autoBtn = document.getElementById('mode-auto');
  const manualBtn = document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.addEventListener('click', () => {
      balanceMode = 'auto';
      localStorage.setItem('balancerMode', balanceMode);
      applyModeUI();
      recomputeAutoBalance();
    });
  }

  if (manualBtn) {
    manualBtn.addEventListener('click', () => {
      balanceMode = 'manual';
      localStorage.setItem('balancerMode', balanceMode);
      applyModeUI();
    });
  }

  applyModeUI();
});
