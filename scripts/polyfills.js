(() => {
  const globalScope =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
      ? self
      : this;

  if (typeof globalScope.URLSearchParams === "function") {
    return;
  }

  const replacePlus = /\+/g;

  const decode = (input) => {
    try {
      return decodeURIComponent(String(input).replace(replacePlus, " "));
    } catch (error) {
      return String(input);
    }
  };

  const encode = (input) =>
    encodeURIComponent(String(input)).replace(/%20/g, "+");

  class URLSearchParamsShim {
    constructor(init = "") {
      this._entries = [];

      if (init instanceof URLSearchParamsShim) {
        for (const [key, value] of init._entries) {
          this.append(key, value);
        }
      } else if (typeof init === "string") {
        this._fromString(init);
      } else if (Array.isArray(init)) {
        for (const pair of init) {
          if (!pair) continue;
          const [key, value] = pair;
          this.append(key, value);
        }
      } else if (init && typeof init === "object") {
        for (const key of Object.keys(init)) {
          this.append(key, init[key]);
        }
      }
    }

    _fromString(str) {
      const input = String(str).replace(/^\?/, "");
      if (!input) {
        return;
      }

      const segments = input.split("&");
      for (const segment of segments) {
        if (!segment) continue;
        const eqIndex = segment.indexOf("=");
        let key;
        let value;
        if (eqIndex === -1) {
          key = decode(segment);
          value = "";
        } else {
          key = decode(segment.slice(0, eqIndex));
          value = decode(segment.slice(eqIndex + 1));
        }
        this.append(key, value);
      }
    }

    append(name, value = "") {
      this._entries.push({ name: String(name), value: String(value) });
    }

    delete(name) {
      const key = String(name);
      this._entries = this._entries.filter((entry) => entry.name !== key);
    }

    get(name) {
      const key = String(name);
      const found = this._entries.find((entry) => entry.name === key);
      return found ? found.value : null;
    }

    getAll(name) {
      const key = String(name);
      return this._entries
        .filter((entry) => entry.name === key)
        .map((entry) => entry.value);
    }

    has(name) {
      const key = String(name);
      return this._entries.some((entry) => entry.name === key);
    }

    set(name, value = "") {
      const key = String(name);
      const val = String(value);
      let replaced = false;
      const next = [];
      for (const entry of this._entries) {
        if (entry.name === key) {
          if (!replaced) {
            next.push({ name: key, value: val });
            replaced = true;
          }
        } else {
          next.push(entry);
        }
      }
      if (!replaced) {
        next.push({ name: key, value: val });
      }
      this._entries = next;
    }

    sort() {
      this._entries.sort((a, b) => {
        if (a.name === b.name) {
          return 0;
        }
        return a.name < b.name ? -1 : 1;
      });
    }

    forEach(callback, thisArg) {
      for (const [key, value] of this) {
        callback.call(thisArg, value, key, this);
      }
    }

    *entries() {
      for (const entry of this._entries) {
        yield [entry.name, entry.value];
      }
    }

    *keys() {
      for (const entry of this._entries) {
        yield entry.name;
      }
    }

    *values() {
      for (const entry of this._entries) {
        yield entry.value;
      }
    }

    [Symbol.iterator]() {
      return this.entries();
    }

    toString() {
      return this._entries
        .map((entry) => `${encode(entry.name)}=${encode(entry.value)}`)
        .join("&");
    }
  }

  globalScope.URLSearchParams = URLSearchParamsShim;
})();
