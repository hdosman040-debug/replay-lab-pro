import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

import {
  getStorageUser,
  setStorageUser,
  supabaseStorage,
  flushPendingSaves,
} from "./supabaseStorage";

const KEY = "ict-terminal.journal.v1";

function mockRead(value: string | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: value === null ? null : { value },
    error,
  });
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnValue({ eq, maybeSingle });
  mocks.from.mockReturnValue({ select });
  return { eq, maybeSingle };
}

beforeEach(() => {
  setStorageUser(null);
  mocks.from.mockReset();
});

describe("authenticated journal storage", () => {
  it("requires an authenticated account", async () => {
    await expect(supabaseStorage.getItem(KEY)).rejects.toThrow(
      "Authenticated user required",
    );
    expect(() => supabaseStorage.setItem(KEY, "{}")).toThrow(
      "Authenticated user required",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reads data under the current user ID", async () => {
    setStorageUser("user-a");
    const { eq } = mockRead('{"records":[]}');

    await expect(supabaseStorage.getItem(KEY)).resolves.toBe(
      '{"records":[]}',
    );
    expect(eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(eq).toHaveBeenCalledWith("key", KEY);
  });

  it("rejects cloud failures rather than restoring old data", async () => {
    setStorageUser("user-a");
    mockRead(null, { message: "Permission denied" });

    await expect(supabaseStorage.getItem(KEY)).rejects.toEqual({
      message: "Permission denied",
    });
  });

  it("rejects a read that finishes after an account switch", async () => {
    let resolveRead!: (value: unknown) => void;
    const maybeSingle = vi.fn().mockReturnValue(
      new Promise((resolve) => { resolveRead = resolve; }),
    );
    const eq = vi.fn().mockReturnThis();
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq, maybeSingle }),
    });

    setStorageUser("user-a");
    const request = supabaseStorage.getItem(KEY);

    setStorageUser("user-b");
    resolveRead({ data: { value: "private-a" }, error: null });

    await expect(request).rejects.toThrow("account changed");
  });

  it("does not transfer queued writes to another user", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert });

    setStorageUser("user-a");
    supabaseStorage.setItem(KEY, "private-a");

    setStorageUser("user-b");
    await flushPendingSaves();

    expect(upsert).not.toHaveBeenCalled();
    expect(getStorageUser()).toBe("user-b");
  });

  it("keeps an in-flight write bound to its original user", async () => {
    let finishWrite!: (value: { error: null }) => void;

    const upsert = vi.fn().mockImplementation(
      () => new Promise((resolve) => {
        finishWrite = resolve;
      }),
    );

    mocks.from.mockReturnValue({ upsert });

    setStorageUser("user-a");
    supabaseStorage.setItem(KEY, "private-a");

    const write = flushPendingSaves();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        value: "private-a",
      }),
      { onConflict: "user_id,key" },
    );

    setStorageUser(null);
    setStorageUser("user-b");

    finishWrite({ error: null });
    await write;

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(getStorageUser()).toBe("user-b");
  });

  it("writes only to the account that queued the data", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ upsert });

    setStorageUser("user-a");
    supabaseStorage.setItem(KEY, "private-a");
    await flushPendingSaves();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        key: KEY,
        value: "private-a",
      }),
      { onConflict: "user_id,key" },
    );
  });
});
