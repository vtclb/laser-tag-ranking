export function getHashQueryParams() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  const query = hash.includes('?') ? hash.split('?').slice(1).join('?') : '';
  return new URLSearchParams(query);
}

export function getRouteState() {
  const rawHash = String(window.location.hash || '').replace(/^#/, '').trim();
  const [routePart = 'main', queryPart = ''] = rawHash.split('?');
  const route = String(routePart || 'main').replace(/^\/+/, '').toLowerCase() || 'main';
  const query = new URLSearchParams(queryPart);
  return { route, query };
}

export function getRouteParams() {
  const params = getHashQueryParams();
  return {
    seasonId: params.get('season') || undefined,
    league: params.get('league') || undefined,
    nick: params.get('nick') || undefined,
    date: params.get('date') || undefined
  };
}

export function getQueryParams() {
  return getRouteParams();
}

export function decodeParam(value = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.replaceAll('+', ' ')).trim();
  } catch {
    return raw.trim();
  }
}

export function normalizeNickname(value = '') {
  return decodeParam(value).toLocaleLowerCase('uk').trim();
}

export function jsonp(url, params = {}, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const callbackName = `__cb${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement('script');
    const requestUrl = new URL(url);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        requestUrl.searchParams.set(key, String(value));
      }
    });
    requestUrl.searchParams.set('callback', callbackName);

    let done = false;
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
      if (timer) clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`JSONP timeout for ${requestUrl}`));
    }, timeoutMs);

    window[callbackName] = (payload) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(payload);
    };

    script.src = requestUrl.toString();
    script.async = true;
    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`JSONP network error for ${requestUrl}`));
    };

    document.head.appendChild(script);
  });
}

function isCrossOriginRequest(url) {
  const parsed = new URL(url, window.location.href);
  return parsed.origin !== window.location.origin;
}

function shouldUseJsonp(url) {
  const parsed = new URL(url, window.location.href);
  return parsed.hostname.includes('script.google.com') || isCrossOriginRequest(parsed.toString());
}

export async function fetchJson(url, action, params = {}, timeoutMs = 12_000) {
  if (!action || !String(action).trim()) {
    throw new Error('GAS action is required for fetchJson()');
  }

  const normalizedAction = String(action).trim();
  const requestParams = { action: normalizedAction, ...params };

  if (shouldUseJsonp(url)) {
    try {
      return await jsonp(url, requestParams, timeoutMs);
    } catch (error) {
      throw new Error(`JSONP request failed for action="${normalizedAction}" params=${JSON.stringify(params)}: ${error.message || error}`);
    }
  }

  const requestUrl = new URL(url, window.location.href);
  Object.entries(requestParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      requestUrl.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function formatRatio(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function statOrDash(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(value) || value === 0) return '—';
  return value;
}

export function createTop3Markup(items) {
  return items
    .slice(0, 3)
    .map((player, index) => `
      <article class="top-card rank-${index + 1}">
        <span class="rank-badge">#${index + 1}</span>
        <h3><img class="avatar" src="${player.avatarUrl || '../assets/default-avatar.svg'}" alt="">${player.nick}</h3>
        <p>${player.points ?? '—'} pts</p>
      </article>
    `)
    .join('');
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function highlightMatch(text = '', query = '') {
  const safeText = escapeHtml(text);
  if (!query) return safeText;
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return safeText;
  const re = new RegExp(`(${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safeText.replace(re, '<mark>$1</mark>');
}
