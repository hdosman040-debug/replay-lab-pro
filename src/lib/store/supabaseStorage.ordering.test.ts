import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, deferred, KEY, server } from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("journal operation ordering", () => {
  it("preserves the newest save after save-delete-save", async () => {
    const s = server(),
      c = await client(s),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      return s.actualWrite(...args);
    });
    c.supabaseStorage.setItem(KEY, "A");
    const first = c.flushPendingSaves();
    const deleting = c.supabaseStorage.removeItem(KEY);
    c.supabaseStorage.setItem(KEY, "B");
    const second = c.flushPendingSaves();
    wait.resolve();
    await Promise.all([first, deleting, second]);
    expect(s.backend.write.mock.calls.map((call) => call[2])).toEqual(["A", null, "B"]);
    expect(s.value()).toBe("B");
    expect(s.revision()).toBe(4);
  });
});
