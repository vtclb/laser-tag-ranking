export function setStatus({ state = 'idle', text = 'IDLE', retryVisible = false } = {}) {
  const box = document.getElementById('statusBox');
  const txt = document.getElementById('statusText');
  const retry = document.getElementById('retrySaveBtn');
  if (!box || !txt || !retry) return;
  box.dataset.state = state;
  txt.textContent = text;
  retry.classList.toggle('hidden', !retryVisible);
}

export function lockSaveButton(locked) {
  const btn = document.getElementById('saveBtn');
  if (btn) btn.disabled = !!locked;
}
