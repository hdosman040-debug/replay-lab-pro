import { vi } from "vitest";
import {
  createVersionedStorage,
  SaveConflict,
  type CloudState,
  type StateBackend,
} from "./versionedStorage";
export const KEY = "ict-terminal.journal.v1";
export class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  clear() {
    this.values.clear();
  }
}
export function server() {
  const rows = new Map<string, CloudState>();
  const rowKey = (user: string, name: string) => `${user}:${name}`;
  rows.set(rowKey("user-a", KEY), { value: "initial", revision: 1 });
  rows.set(rowKey("user-b", KEY), { value: "private-b", revision: 1 });
  const actualWrite: StateBackend["write"] = async (user, name, value, revision) => {
    const key = rowKey(user, name),
      old = rows.get(key);
    if ((old?.revision ?? null) !== revision) throw new SaveConflict();
    const result = { value, revision: (revision ?? 0) + 1 };
    rows.set(key, result);
    return { ...result };
  };
  const backend = {
    read: vi.fn(async (user: string, name: string) => {
      const data = rows.get(rowKey(user, name));
      return data ? { ...data } : null;
    }),
    write: vi.fn(actualWrite),
  };
  return {
    rows,
    backend,
    actualWrite,
    value: () => rows.get(rowKey("user-a", KEY))?.value,
    revision: () => rows.get(rowKey("user-a", KEY))?.revision,
  };
}
export type TestServer = ReturnType<typeof server>;
export async function client(s: TestServer, cache = new MemoryStorage(), user = "user-a") {
  const storage = createVersionedStorage(s.backend, () => cache);
  storage.setStorageUser(user);
  await storage.supabaseStorage.getItem(KEY);
  return storage;
}
export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function drafts(cache: MemoryStorage) {
  return [...cache.values.entries()].filter(([key]) => key.startsWith("pending-v2:"));
}
