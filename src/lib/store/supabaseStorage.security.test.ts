import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVersionedStorage } from "./versionedStorage";
import { client, deferred, KEY, MemoryStorage, server } from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("authenticated versioned storage", () => {
  it("requires an authenticated account", async () => {
    const s = server(),
      c = createVersionedStorage(s.backend, () => new MemoryStorage());
    await expect(c.supabaseStorage.getItem(KEY)).rejects.toThrow("Authenticated user required");
    expect(() => c.supabaseStorage.setItem(KEY, "private")).toThrow("Authenticated user required");
    expect(s.backend.read).not.toHaveBeenCalled();
  });
  it("reads only the current account", async () => {
    const s = server(),
      c = await client(s);
    c.setStorageUser("user-b");
    expect(await c.supabaseStorage.getItem(KEY)).toBe("private-b");
    expect(s.backend.read).toHaveBeenLastCalledWith("user-b", KEY);
  });
  it("rejects cloud failures without returning cached data", async () => {
    const s = server(),
      c = await client(s);
    s.backend.read.mockRejectedValueOnce(new Error("Permission denied"));
    await expect(c.supabaseStorage.getItem(KEY)).rejects.toThrow("Permission denied");
  });
  it("rejects a read that finishes after an account switch", async () => {
    const s = server(),
      c = await client(s),
      wait = deferred<{ value: string; revision: number }>();
    s.backend.read.mockReturnValueOnce(wait.promise);
    const read = c.supabaseStorage.getItem(KEY);
    c.setStorageUser("user-b");
    wait.resolve({ value: "private-a", revision: 1 });
    await expect(read).rejects.toThrow("account changed");
  });
  it("does not transfer queued writes to a new account", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      c = await client(s, cache);
    c.supabaseStorage.setItem(KEY, "private-a");
    c.setStorageUser("user-b");
    await c.flushPendingSaves();
    expect(s.backend.write).not.toHaveBeenCalled();
    expect(c.exportUnsavedChanges()).not.toContain("private-a");
  });
  it("keeps an in-flight write bound to its original account", async () => {
    const s = server(),
      c = await client(s),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      return s.actualWrite(...args);
    });
    c.supabaseStorage.setItem(KEY, "private-a");
    const flush = c.flushPendingSaves();
    c.setStorageUser("user-b");
    await c.supabaseStorage.getItem(KEY);
    wait.resolve();
    await flush;
    expect(s.backend.write).toHaveBeenCalledWith("user-a", KEY, "private-a", 1);
    expect(c.getStorageUser()).toBe("user-b");
    expect(await c.supabaseStorage.getItem(KEY)).toBe("private-b");
  });
  it("never saves a state that was not loaded first", async () => {
    const s = server(),
      c = createVersionedStorage(s.backend, () => new MemoryStorage());
    c.setStorageUser("user-a");
    c.supabaseStorage.setItem(KEY, "unbased");
    await c.flushPendingSaves();
    expect(s.backend.write).not.toHaveBeenCalled();
    expect(c.getSaveStatus()).toBe("conflict");
    expect(c.exportUnsavedChanges()).toContain("unbased");
  });
});
