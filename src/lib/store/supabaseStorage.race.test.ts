import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

import {
  flushPendingSaves,
  setStorageUser,
  supabaseStorage,
} from "./supabaseStorage";

const KEY = "ict-terminal.journal.v1";

afterEach(() => {
  setStorageUser(null);
  vi.clearAllTimers();
  vi.useRealTimers();
  mocks.from.mockReset();
});

describe("journal save ordering", () => {
  it("must not allow an older save to overwrite a newer save", async () => {
    vi.useFakeTimers();

    let releaseOld!: () => void;
    let storedValue = "";

    const upsert = vi.fn((row: { value: string }) => {
      if (row.value === "old") {
        return new Promise<{ error: null }>((resolve) => {
          releaseOld = () => {
            storedValue = row.value;
            resolve({ error: null });
          };
        });
      }

      storedValue = row.value;
      return Promise.resolve({ error: null });
    });

    mocks.from.mockReturnValue({ upsert });

    setStorageUser("race-test-user");

    supabaseStorage.setItem(KEY, "old");
    const firstSave = flushPendingSaves();

    expect(upsert).toHaveBeenCalledTimes(1);

    supabaseStorage.setItem(KEY, "new");
    const secondSave = flushPendingSaves();

    expect(upsert).toHaveBeenCalledTimes(1);

    releaseOld();

    await firstSave;
    await secondSave;

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(storedValue).toBe("new");
  });
});
