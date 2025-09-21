// scripts/balance.js

import { state, setBalanceMode } from './state.js?v=2025-09-19-avatars-2';

let recomputeHandler = null;

export function getBalanceMode() {
  return state.balanceMode;
}

export function registerRecomputeAutoBalance(fn) {
  recomputeHandler = typeof fn === 'function' ? fn : null;
}

export async function recomputeAutoBalance() {
  if (typeof recomputeHandler === 'function') {
    try {
      await recomputeHandler();
    } catch (err) {
      console.error('[balance] recompute failed', err);
    }
  }
}

export function applyModeUI() {
  const autoBtn = document.getElementById('mode-auto');
  const manualBtn = document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.classList.toggle('btn-primary', state.balanceMode === 'auto');
  }
  if (manualBtn) {
    manualBtn.classList.toggle('btn-primary', state.balanceMode === 'manual');
  }
  if (document.body) {
    document.body.dataset.balanceMode = state.balanceMode;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const autoBtn = document.getElementById('mode-auto');
  const manualBtn = document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.addEventListener('click', async () => {
      setBalanceMode('auto');
      applyModeUI();
      await recomputeAutoBalance();
    });
  }

  if (manualBtn) {
    manualBtn.addEventListener('click', () => {
      setBalanceMode('manual');
      applyModeUI();
    });
  }

  applyModeUI();
});
