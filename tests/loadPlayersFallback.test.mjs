import assert from 'node:assert/strict';

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
  removeEventListener() {},
};
fakeWindow.window = fakeWindow;

globalThis.window = fakeWindow;
globalThis.location = fakeWindow.location;

const csvByUrl = new Map();
let lastRequestUrl = null;

const createResponse = (body) => ({
  ok: true,
  status: 200,
  async text() {
    return body;
  }
});

globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) throw new Error(`Unexpected request: ${String(input)}`);
  try {
    lastRequestUrl = new URL(url);
  } catch (err) {
    throw new Error(`Invalid URL: ${url}`);
  }

  let lookupKey = url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('cb')) {
      parsed.searchParams.delete('cb');
      const params = parsed.searchParams.toString();
      lookupKey = `${parsed.origin}${parsed.pathname}${params ? `?${params}` : ''}`;
    }
  } catch {
    /* ignore, fallback to raw url */
  }

  if (!csvByUrl.has(lookupKey)) {
    throw new Error(`Unexpected URL: ${url}`);
  }
  return createResponse(csvByUrl.get(lookupKey));
};

fakeWindow.fetch = (...args) => globalThis.fetch(...args);

const {
  fetchCsv,
  loadPlayers,
  CSV_URLS,
  getLeagueFeedUrl,
  fetchLeagueCsv,
  parsePlayersFromCsv,
} = await import('../scripts/api.js');

csvByUrl.set(
  CSV_URLS.kids.ranking,
  '\ufeff"Nickname","Points"\n"Alpha",123\n"Foxtrot, Kid",456\n'
);
csvByUrl.set(
  CSV_URLS.sundaygames.ranking,
  '\ufeffNickname,Points\nBravo,789\n'
);

const kidsRows = await fetchCsv(getLeagueFeedUrl('kids'));

assert.equal(Array.isArray(kidsRows), true);
assert.equal(kidsRows.length > 0, true);
assert.equal(Object.prototype.hasOwnProperty.call(kidsRows[0], 'Nickname'), true);
assert.equal(kidsRows[0].Nickname, 'Alpha');

const kidsCsv = await fetchLeagueCsv('kids');
assert.equal(typeof kidsCsv, 'string');
assert.ok(lastRequestUrl instanceof URL);
assert.equal(lastRequestUrl.searchParams.has('cb'), true);
const cbValue = lastRequestUrl.searchParams.get('cb');
assert.ok(cbValue);
assert.equal(/^[0-9]+$/.test(cbValue), true);

const kidsPlayers = parsePlayersFromCsv(kidsCsv);
assert.equal(kidsPlayers.length > 0, true);
assert.equal(kidsPlayers[0].nick, 'Alpha');
assert.equal(kidsPlayers[1].nick, 'Foxtrot, Kid');

const sundayCsv = await fetchLeagueCsv('sundaygames');
const sundayPlayers = parsePlayersFromCsv(sundayCsv);
assert.equal(sundayPlayers.length > 0, true);
assert.equal(sundayPlayers[0].nick, 'Bravo');

const wrappedPlayers = await loadPlayers('kids');
assert.equal(Array.isArray(wrappedPlayers), true);
assert.equal(wrappedPlayers.length, kidsPlayers.length);
assert.equal(wrappedPlayers[0].nick, 'Alpha');

console.log('✅ league CSV fallback parser test passed');
