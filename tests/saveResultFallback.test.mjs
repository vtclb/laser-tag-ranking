import assert from 'node:assert/strict';

let FALLBACK_URL = '';

const sessionStore = new Map();
const fakeWindow = {
  location: { hostname: 'example.com', origin: 'https://example.com' },
  __SESS: {
    getItem(key) {
      return sessionStore.has(key) ? sessionStore.get(key) : null;
    },
    setItem(key, value) {
      sessionStore.set(key, value);
    },
    removeItem(key) {
      sessionStore.delete(key);
    }
  },
  addEventListener() {},
  removeEventListener() {}
};
fakeWindow.window = fakeWindow;

globalThis.window = fakeWindow;
globalThis.location = fakeWindow.location;

const calls = [];
const createResponse = ({ ok, status, contentType, body }) => ({
  ok,
  status,
  headers: {
    get(name) {
      return name && name.toLowerCase() === 'content-type' ? contentType : null;
    }
  },
  async text() {
    return body;
  }
});

globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  if (calls.length === 1) {
    return createResponse({
      ok: false,
      status: 502,
      contentType: 'text/html',
      body: '<html>Bad Gateway</html>'
    });
  }
  if (FALLBACK_URL && url === FALLBACK_URL) {
    return createResponse({
      ok: true,
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'OK', players: [] })
    });
  }
  throw new Error(`Unexpected URL: ${url}`);
};

fakeWindow.fetch = (...args) => globalThis.fetch(...args);

const { saveResult, PROXY_ORIGIN, GAS_PROXY_ORIGIN } = await import('../scripts/api.js');

FALLBACK_URL = GAS_PROXY_ORIGIN;

assert.ok(FALLBACK_URL);

assert.equal(window.GAS_FALLBACK_URL, undefined);

const result = await saveResult({ action: 'saveResult', league: 'sundaygames' });

assert.equal(result.ok, true);
assert.equal(result.status, 'OK');
assert.equal(result.message, 'OK');

assert.equal(calls.length, 2);
assert.equal(calls[0].url, PROXY_ORIGIN);
assert.equal(calls[1].url, FALLBACK_URL);

console.log('✅ saveResult fallback test passed');
