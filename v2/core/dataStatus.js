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

export function resolveDataStatusTone(status) {
  const source = status?.source || 'unknown';
  const hasUpdatedAt = Boolean(status?.updatedAt);

  if (status?.ok && source === 'live') {
    return {
      tone: 'ok',
      className: 'data-status-line--ok',
      label: hasUpdatedAt
        ? `Дані оновлено: ${formatDataUpdatedAt(status.updatedAt)}`
        : 'Дані оновлено'
    };
  }

  if (source === 'cache' || source === 'fallback') {
    return {
      tone: 'warning',
      className: 'data-status-line--warning',
      label: hasUpdatedAt
        ? `Показуємо кеш · оновлено: ${formatDataUpdatedAt(status.updatedAt)}`
        : 'Показуємо кешовані дані'
    };
  }

  return {
    tone: 'error',
    className: 'data-status-line--error',
    label: 'Дані тимчасово недоступні'
  };
}
