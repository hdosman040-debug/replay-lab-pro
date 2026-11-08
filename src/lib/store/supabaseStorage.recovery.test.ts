import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: mocks.from } }));

const KEY = "ict-terminal.journal.v1";
let stored = "cloud-before-trade";
let readError: unknown = null;
let storage: typeof import("./supabaseStorage");
const cache = new Map<string, string>();
const upsert = vi.fn(async (row: { value: string }) => {
  stored = row.value;
  return { error: null };
});

async function reload(userId = "user-a") {
  vi.clearAllTimers();
  vi.resetModules();
  storage = await import("./supabaseStorage");
  storage.setStorageUser(userId);
}

beforeEach(async () => {
  vi.useFakeTimers();
  cache.clear();
  stored = "cloud-before-trade";
  readError = null;
  upsert.mockClear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => cache.set(key, value),
    removeItem: (key: string) => cache.delete(key),
  });
  mocks.from.mockImplementation(() => {
    const query = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: { value: stored }, error: readError })),
    };
    return { select: vi.fn(() => query), upsert };
  });
  await reload();
});

afterEach(() => {
  storage.setStorageUser(null);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pending journal save recovery", () => {
  it("recovers a trade after a reload before the delayed cloud save", async () => {
    storage.supabaseStorage.setItem(KEY, "journal-with-new-trade");
    await reload();

    await expect(storage.supabaseStorage.getItem(KEY)).resolves.toBe("journal-with-new-trade");
    await storage.flushAndVerifySaves();
    expect(stored).toBe("journal-with-new-trade");
  });

  it("never restores another account's pending journal", async () => {
    storage.supabaseStorage.setItem(KEY, "private-user-a");
    await reload("user-b");

    await expect(storage.supabaseStorage.getItem(KEY)).resolves.toBe("cloud-before-trade");
    await storage.flushPendingSaves();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("retries a failed upload after reloading without losing the trade", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    upsert.mockRejectedValueOnce(new Error("Connection interrupted"));
    storage.supabaseStorage.setItem(KEY, "trade-during-failed-upload");
    await expect(storage.flushAndVerifySaves()).rejects.toThrow("could not be saved");
    log.mockRestore();

    await reload();
    await expect(storage.supabaseStorage.getItem(KEY)).resolves.toBe("trade-during-failed-upload");
    await storage.flushAndVerifySaves();
    expect(stored).toBe("trade-during-failed-upload");
  });

  it("uses fresh cloud data once a pending save was acknowledged", async () => {
    storage.supabaseStorage.setItem(KEY, "saved-trade");
    await storage.flushAndVerifySaves();
    stored = "newer-cloud-review";
    await reload();

    await expect(storage.supabaseStorage.getItem(KEY)).resolves.toBe("newer-cloud-review");
    await storage.flushPendingSaves();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("still requires a successful authenticated cloud read before recovery", async () => {
    storage.supabaseStorage.setItem(KEY, "local-trade");
    await reload();
    readError = { message: "Permission denied" };

    await expect(storage.supabaseStorage.getItem(KEY)).rejects.toEqual(readError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("retains the pending value when an older in-flight save finishes", async () => {
    let finishOld!: (value: { error: null }) => void;
    upsert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    storage.supabaseStorage.setItem(KEY, "old");
    const saving = storage.flushPendingSaves();
    storage.supabaseStorage.setItem(KEY, "new-trade");
    finishOld({ error: null });
    await saving;
    await reload();

    await expect(storage.supabaseStorage.getItem(KEY)).resolves.toBe("new-trade");
  });
});
