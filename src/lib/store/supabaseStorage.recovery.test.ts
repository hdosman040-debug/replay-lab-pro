import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountCacheKey } from "./accountKeys";
import {
  client,
  deferred,
  drafts,
  KEY,
  MemoryStorage,
  server,
} from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("pending save recovery", () => {
  it("recovers an unsent trade after a reload", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    old.supabaseStorage.setItem(KEY, "new-trade");
    old.setStorageUser(null);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("new-trade");
    await fresh.flushAndVerifySaves();
    expect(s.value()).toBe("new-trade");
    expect(drafts(cache)).toHaveLength(0);
  });
  it("does not recover another account's private changes", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    old.supabaseStorage.setItem(KEY, "private-a");
    old.setStorageUser(null);
    const fresh = await client(s, cache, "user-b");
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("private-b");
    expect(fresh.exportUnsavedChanges()).not.toContain("private-a");
  });
  it("retries an interrupted upload after a reload", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    s.backend.write.mockRejectedValueOnce(new Error("offline"));
    old.supabaseStorage.setItem(KEY, "new-trade");
    await expect(old.flushAndVerifySaves()).rejects.toThrow("could not be saved");
    old.setStorageUser(null);
    const fresh = await client(s, cache);
    await fresh.flushAndVerifySaves();
    expect(s.value()).toBe("new-trade");
  });
  it("uses the cloud after the pending save was acknowledged", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    old.supabaseStorage.setItem(KEY, "saved");
    await old.flushAndVerifySaves();
    old.setStorageUser(null);
    await s.actualWrite("user-a", KEY, "newer-cloud", 2);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("newer-cloud");
    expect(drafts(cache)).toHaveLength(0);
  });
  it("requires a successful cloud read before recovering anything", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    old.supabaseStorage.setItem(KEY, "pending");
    old.setStorageUser(null);
    s.backend.read.mockRejectedValueOnce(new Error("not authenticated"));
    await expect(client(s, cache)).rejects.toThrow("not authenticated");
    expect(s.backend.write).not.toHaveBeenCalled();
    expect(drafts(cache)).toHaveLength(1);
  });
  it("preserves newer edits when an older request finishes", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      return s.actualWrite(...args);
    });
    old.supabaseStorage.setItem(KEY, "A");
    const saving = old.flushPendingSaves();
    old.supabaseStorage.setItem(KEY, "B");
    wait.resolve();
    await saving;
    old.setStorageUser(null);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("B");
    await fresh.flushAndVerifySaves();
    expect(s.value()).toBe("B");
  });
  it("recovers after the server commits but its acknowledgement is lost", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    s.backend.write.mockImplementationOnce(async (...args) => {
      await s.actualWrite(...args);
      throw new Error("lost reply");
    });
    old.supabaseStorage.setItem(KEY, "saved");
    await expect(old.flushAndVerifySaves()).rejects.toThrow("could not be saved");
    old.setStorageUser(null);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("saved");
    expect(fresh.getSaveStatus()).toBe("saved");
    expect(drafts(cache)).toHaveLength(0);
  });
  it("recovers a newer draft after an earlier commit lost its reply", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      await s.actualWrite(...args);
      throw new Error("lost reply");
    });
    old.supabaseStorage.setItem(KEY, "A");
    const saving = old.flushPendingSaves();
    old.supabaseStorage.setItem(KEY, "B");
    wait.resolve();
    await saving;
    old.setStorageUser(null);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("B");
    await fresh.flushAndVerifySaves();
    expect(s.value()).toBe("B");
  });
  it("preserves old-format pending data without automatically overwriting the cloud", async () => {
    const s = server(),
      cache = new MemoryStorage();
    cache.setItem(`pending:${accountCacheKey("user-a", KEY)}`, "old-unversioned-trade");
    const fresh = await client(s, cache);
    await fresh.flushPendingSaves();
    expect(fresh.getSaveStatus()).toBe("conflict");
    expect(s.value()).toBe("initial");
    expect(fresh.exportUnsavedChanges()).toContain("old-unversioned-trade");
  });
});
