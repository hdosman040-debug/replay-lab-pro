import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, deferred, KEY, server } from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("journal deletion ordering", () => {
  it("does not recreate data after a deletion", async () => {
    const s = server(),
      c = await client(s),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      return s.actualWrite(...args);
    });
    c.supabaseStorage.setItem(KEY, "old");
    const saving = c.flushPendingSaves();
    const deleting = c.supabaseStorage.removeItem(KEY);
    wait.resolve();
    await Promise.all([saving, deleting]);
    expect(s.value()).toBeNull();
    expect(s.revision()).toBe(3);
  });
  it("rejects a stale deletion from another device", async () => {
    const s = server(),
      a = await client(s),
      b = await client(s);
    a.supabaseStorage.setItem(KEY, "new-cloud");
    await a.flushAndVerifySaves();
    await expect(b.supabaseStorage.removeItem(KEY)).rejects.toThrow("Deletion could not be saved");
    expect(s.value()).toBe("new-cloud");
    expect(b.getSaveStatus()).toBe("conflict");
  });
});
