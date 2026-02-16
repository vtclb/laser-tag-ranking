export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seasonId: params.get('season') || undefined,
    league: params.get('league') || undefined,
    nick: params.get('nick') || undefined
  };
}

export function formatRatio(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export function statOrDash(value) {
  return value === 0 ? '—' : value ?? '—';
}

export function createTop3Markup(items) {
  return items
    .slice(0, 3)
    .map((player, index) => `
      <article class="top-card rank-${index + 1}">
        <span class="rank-badge">#${index + 1}</span>
        <h3>${player.nick}</h3>
        <p>${player.points} pts</p>
      </article>
    `)
    .join('');
}

export function jsonp(url, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('JSONP unavailable outside browser'));
      return;
    }

    const callbackName = `__cb${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = (payload) => {
      try {
        if (typeof payload === 'string') {
          resolve(JSON.parse(payload));
        } else {
          resolve(payload);
        }
      } catch (error) {
        reject(error);
      } finally {
        cleanup();
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP request failed'));
    };

    const target = new URL(url, window.location.href);
    target.searchParams.set('callback', callbackName);
    script.src = target.toString();
    document.head.appendChild(script);
  });
}
