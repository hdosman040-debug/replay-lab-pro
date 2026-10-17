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
  vi.useRealTimers();
  mocks.from.mockReset();
});

describe("journal operation ordering", () => {
  it("preserves the newest save after save-delete-save", async () => {
    vi.useFakeTimers();

    let releaseFirst!: () => void;
    let stored: string | null = null;
    const operations: string[] = [];

    const upsert = vi.fn((row: { value: string }) => {
      if (row.value === "A") {
        operations.push("save-A-start");

        return new Promise<{ error: null }>((resolve) => {
          releaseFirst = () => {
            stored = "A";
            operations.push("save-A-end");
            resolve({ error: null });
          };
        });
      }

      stored = row.value;
      operations.push("save-B");
      return Promise.resolve({ error: null });
    });

    const deleteQuery = {
      eq: vi.fn().mockReturnThis(),
      then: (
        resolve: (value: { error: null }) => unknown,
      ) => {
        stored = null;
        operations.push("delete");
        return Promise.resolve(resolve({ error: null }));
      },
    };

    mocks.from.mockReturnValue({
      upsert,
      delete: vi.fn().mockReturnValue(deleteQuery),
    });

    setStorageUser("ordering-test-user");

    supabaseStorage.setItem(KEY, "A");
    const first = flushPendingSaves();

    const deleting = supabaseStorage.removeItem(KEY);

    supabaseStorage.setItem(KEY, "B");
    const second = flushPendingSaves();

    releaseFirst();

    await Promise.all([first, deleting, second]);

    expect(stored).toBe("B");
    expect(operations).toEqual([
      "save-A-start",
      "save-A-end",
      "delete",
      "save-B",
    ]);
  });
});
