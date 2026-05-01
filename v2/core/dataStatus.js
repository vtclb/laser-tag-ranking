export function makeDataStatus({ source, ok, updatedAt, message } = {}) {
  return {
    source: source || 'unknown',
    ok: Boolean(ok),
    updatedAt: updatedAt || null,
    message: message || ''
  };
}

export function formatDataUpdatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
