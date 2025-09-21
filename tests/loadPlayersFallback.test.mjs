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

const createResponse = (body) => ({
  ok: true,
  status: 200,
  async text() {
    return body;
  }
});

globalThis.fetch = async (url) => {
  if (!csvByUrl.has(url)) {
    throw new Error(`Unexpected URL: ${url}`);
  }
  return createResponse(csvByUrl.get(url));
};

fakeWindow.fetch = (...args) => globalThis.fetch(...args);

const {
  fetchCsv,
  loadPlayers,
  CSV_URLS,
  getLeagueFeedUrl,
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

const kidsPlayers = await loadPlayers('kids');
assert.equal(kidsPlayers.length > 0, true);
assert.equal(kidsPlayers[0].nick, 'Alpha');

const sundayPlayers = await loadPlayers('sundaygames');
assert.equal(sundayPlayers.length > 0, true);
assert.equal(sundayPlayers[0].nick, 'Bravo');

console.log('✅ loadPlayers fallback parser test passed');
