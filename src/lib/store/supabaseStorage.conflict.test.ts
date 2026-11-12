import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, drafts, KEY, MemoryStorage, server } from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("saves from multiple tabs and devices", () => {
  it("rejects a stale device write and keeps its local changes", async () => {
    const s = server(),
      a = await client(s),
      cache = new MemoryStorage(),
      b = await client(s, cache);
    a.supabaseStorage.setItem(KEY, "device-a");
    b.supabaseStorage.setItem(KEY, "device-b");
    await a.flushAndVerifySaves();
    await expect(b.flushAndVerifySaves()).rejects.toThrow("could not be saved");
    expect(s.value()).toBe("device-a");
    expect(b.getSaveStatus()).toBe("conflict");
    expect(b.exportUnsavedChanges()).toContain("device-b");
    const attempts = s.backend.write.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(s.backend.write).toHaveBeenCalledTimes(attempts);
  });
  it("does not let two tabs overwrite each other's durable drafts", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      a = await client(s, cache),
      b = await client(s, cache);
    a.supabaseStorage.setItem(KEY, "tab-a");
    b.supabaseStorage.setItem(KEY, "tab-b");
    expect(drafts(cache)).toHaveLength(2);
    await a.flushAndVerifySaves();
    await b.flushPendingSaves();
    expect(drafts(cache)).toHaveLength(1);
    expect(b.exportUnsavedChanges()).toContain("tab-b");
  });
  it("does not apply a stale pending draft after a reload", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      old = await client(s, cache);
    old.supabaseStorage.setItem(KEY, "offline-edit");
    old.setStorageUser(null);
    await s.actualWrite("user-a", KEY, "other-device", 1);
    const fresh = await client(s, cache);
    await fresh.flushPendingSaves();
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("other-device");
    expect(s.value()).toBe("other-device");
    expect(fresh.getSaveStatus()).toBe("conflict");
    expect(fresh.exportUnsavedChanges()).toContain("offline-edit");
  });
  it("does not automatically pick a winner between different unsaved drafts", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      a = await client(s, cache),
      b = await client(s, cache);
    a.supabaseStorage.setItem(KEY, "A");
    b.supabaseStorage.setItem(KEY, "B");
    a.setStorageUser(null);
    b.setStorageUser(null);
    const fresh = await client(s, cache);
    await fresh.flushPendingSaves();
    expect(fresh.getSaveStatus()).toBe("conflict");
    expect(s.backend.write).not.toHaveBeenCalled();
    expect(drafts(cache)).toHaveLength(2);
  });
  it("resolves a first-insert race without upserting over another device", async () => {
    const s = server();
    s.rows.delete(`user-a:${KEY}`);
    const a = await client(s),
      b = await client(s);
    a.supabaseStorage.setItem(KEY, "A");
    b.supabaseStorage.setItem(KEY, "B");
    await a.flushAndVerifySaves();
    await b.flushPendingSaves();
    expect(s.value()).toBe("A");
    expect(b.getSaveStatus()).toBe("conflict");
  });
  it("does not resurrect deleted data from a stale tab", async () => {
    const s = server(),
      a = await client(s),
      b = await client(s);
    await a.supabaseStorage.removeItem(KEY);
    b.supabaseStorage.setItem(KEY, "stale");
    await b.flushPendingSaves();
    expect(s.value()).toBeNull();
    expect(s.revision()).toBe(2);
    expect(b.getSaveStatus()).toBe("conflict");
  });
  it("retains the revision across delete and recreation", async () => {
    const s = server(),
      a = await client(s),
      stale = await client(s);
    await a.supabaseStorage.removeItem(KEY);
    a.supabaseStorage.setItem(KEY, "recreated");
    await a.flushAndVerifySaves();
    stale.supabaseStorage.setItem(KEY, "old");
    await stale.flushPendingSaves();
    expect(s.value()).toBe("recreated");
    expect(s.revision()).toBe(3);
    expect(stale.getSaveStatus()).toBe("conflict");
  });
  it("archives the unsaved draft before an explicit cloud reload", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      a = await client(s, cache);
    a.supabaseStorage.setItem(KEY, "unsaved");
    await s.actualWrite("user-a", KEY, "remote", 1);
    await a.flushPendingSaves();
    await a.archiveForCloudReload();
    expect([...cache.values.values()].some((v) => v.includes("unsaved"))).toBe(true);
    expect(drafts(cache)).toHaveLength(0);
    const fresh = await client(s, cache);
    expect(await fresh.supabaseStorage.getItem(KEY)).toBe("remote");
    expect(fresh.getSaveStatus()).toBe("saved");
  });
  it("does not clear drafts if archiving fails", async () => {
    const s = server(),
      cache = new MemoryStorage(),
      a = await client(s, cache);
    a.supabaseStorage.setItem(KEY, "unsaved");
    vi.spyOn(cache, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    await expect(a.archiveForCloudReload()).rejects.toThrow("Quota exceeded");
    expect(drafts(cache)).toHaveLength(1);
    expect(a.exportUnsavedChanges()).toContain("unsaved");
  });
  it("does not advance a draft's base when a second cloud read sees a remote save", async () => {
    const s = server(),
      a = await client(s);
    a.supabaseStorage.setItem(KEY, "local");
    await s.actualWrite("user-a", KEY, "remote", 1);
    expect(await a.supabaseStorage.getItem(KEY)).toBe("local");
    await a.flushPendingSaves();
    expect(s.value()).toBe("remote");
    expect(a.getSaveStatus()).toBe("conflict");
  });
});
