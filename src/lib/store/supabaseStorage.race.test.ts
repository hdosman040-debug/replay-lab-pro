import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, deferred, KEY, server } from "./versionedStorage.testSupport";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("journal save ordering", () => {
  it("never lets an older in-flight save overwrite a newer draft", async () => {
    const s = server(),
      c = await client(s),
      wait = deferred();
    s.backend.write.mockImplementationOnce(async (...args) => {
      await wait.promise;
      return s.actualWrite(...args);
    });
    c.supabaseStorage.setItem(KEY, "old");
    const first = c.flushPendingSaves();
    c.supabaseStorage.setItem(KEY, "new");
    const second = c.flushPendingSaves();
    expect(s.backend.write).toHaveBeenCalledTimes(1);
    wait.resolve();
    await Promise.all([first, second]);
    expect(s.value()).toBe("new");
    expect(s.revision()).toBe(3);
    expect(s.backend.write).toHaveBeenLastCalledWith("user-a", KEY, "new", 2);
    expect(c.hasUnsavedChanges()).toBe(false);
  });
});
