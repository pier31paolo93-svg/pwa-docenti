import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { vi } from "vitest";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
// Node 25 exposes an incomplete Storage object without --localstorage-file.
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
});
