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

describe("journal deletion ordering", () => {
  it("must not recreate a record after deletion", async () => {
    vi.useFakeTimers();

    let releaseSave!: () => void;
    let storedValue: string | null = null;

    const upsert = vi.fn((row: { value: string }) =>
      new Promise<{ error: null }>((resolve) => {
        releaseSave = () => {
          storedValue = row.value;
          resolve({ error: null });
        };
      }),
    );

    const deleteQuery = {
      eq: vi.fn().mockReturnThis(),
    };

    const deleteOperation = {
      then: (
        resolve: (value: { error: null }) => unknown,
      ) => {
        storedValue = null;
        return Promise.resolve(resolve({ error: null }));
      },
    };

    deleteQuery.eq
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(deleteOperation);

    mocks.from.mockReturnValue({
      upsert,
      delete: vi.fn().mockReturnValue(deleteQuery),
    });

    setStorageUser("delete-race-user");

    supabaseStorage.setItem(KEY, "old");
    const saving = flushPendingSaves();

    expect(upsert).toHaveBeenCalledTimes(1);

    const deleting = supabaseStorage.removeItem(KEY);

    releaseSave();

    await saving;
    await deleting;

    expect(storedValue).toBeNull();
  });
});
