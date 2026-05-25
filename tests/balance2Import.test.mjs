import test from 'node:test';
import assert from 'node:assert/strict';

class DummyEl {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.dataset = {};
    this.parentNode = this;
    this.firstChild = null;
    this.firstElementChild = null;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return new DummyEl(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  appendChild() { return new DummyEl(); }
  insertBefore() { return new DummyEl(); }
  insertAdjacentElement() { return new DummyEl(); }
  insertAdjacentHTML() {}
  setAttribute() {}
  remove() {}
  matches() { return false; }
}

const localStorageStub = {
  map: new Map(),
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; },
  setItem(k, v) { this.map.set(k, String(v)); },
  removeItem(k) { this.map.delete(k); },
  clear() { this.map.clear(); },
};

test('balance2 modules import smoke test', async () => {
  globalThis.window = globalThis;
  globalThis.window.location = { search: '', hash: '' };
  globalThis.localStorage = localStorageStub;
  globalThis.alert = () => {};
  globalThis.confirm = () => false;
  globalThis.document = {
    body: new DummyEl(),
    createElement() { return new DummyEl(); },
    getElementById() { return new DummyEl(); },
    querySelector() { return new DummyEl(); },
    querySelectorAll() { return []; },
    addEventListener() {},
  };

  const modules = [
    '../v2/scripts/balance2/app.js',
    '../v2/scripts/balance2/ui.js',
    '../v2/scripts/balance2/state.js',
    '../v2/scripts/balance2/schoolPayload.js',
    '../v2/scripts/balance2/validation.js',
    '../v2/scripts/balance2/schoolMode.js',
  ];

  for (const mod of modules) {
    await assert.doesNotReject(() => import(mod), `import failed: ${mod}`);
  }
});
