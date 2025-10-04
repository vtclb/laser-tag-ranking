import assert from 'node:assert/strict';

function createElementStub() {
  return {
    addEventListener() {},
    removeEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    prepend() {},
    querySelectorAll() { return { forEach() {} }; },
    querySelector() { return null; },
    set textContent(value) { this._textContent = value; },
    get textContent() { return this._textContent || ''; },
    dataset: {},
    value: '',
  };
}

const elementCache = new Map();
const documentStub = {
  getElementById(id) {
    if (!elementCache.has(id)) {
      elementCache.set(id, createElementStub());
    }
    return elementCache.get(id);
  },
  createElement() {
    return createElementStub();
  },
  createTextNode() {
    return {};
  },
  addEventListener() {},
  removeEventListener() {},
  documentElement: {
    requestFullscreen() {},
  },
};
documentStub.querySelectorAll = () => ({ forEach() {} });
documentStub.exitFullscreen = () => {};

globalThis.document = documentStub;

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  document: documentStub,
  location: { origin: 'https://example.com' },
};
window.window = window;

globalThis.location = window.location;

globalThis.navigator = { userAgent: 'node' };

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

globalThis.sessionStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

globalThis.__gamedayTestHook = {};

await import('../scripts/gameday.js');

const { parseGameRow } = globalThis.__gamedayTestHook;

assert.equal(typeof parseGameRow, 'function', 'parseGameRow should be exposed for tests');

const match = parseGameRow({
  Timestamp: '   ',
  Date: '02.03.2024',
  Team1: 'Alpha',
  Team2: 'Bravo',
  Winner: 'Team1',
});

assert.equal(match.rawTimestamp, '02.03.2024');
assert.equal(match.date, '2024-03-02');
assert.ok(match.timestamp instanceof Date);
assert.equal(Number.isNaN(match.timestamp.getTime()), false);

const retained = [match].filter(g => g.timestamp || g.date);
assert.equal(retained.length, 1);

console.log('✅ gameday parse fallback test passed');
