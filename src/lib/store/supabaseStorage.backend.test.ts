import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: mocks.from } }));
import { stateBackend } from "./supabaseStorage";
import { SaveConflict } from "./versionedStorage";
import { KEY } from "./versionedStorage.testSupport";
let query: {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { value: "new", revision: 3, deleted: false }, error: null }),
  };
  mocks.from.mockReturnValue(query);
});
describe("Supabase compare-and-set adapter", () => {
  it("filters a write by owner, key and previously read revision", async () => {
    await stateBackend.write("user-a", KEY, "new", 2);
    expect(query.eq.mock.calls).toEqual([
      ["user_id", "user-a"],
      ["key", KEY],
      ["revision", 2],
    ]);
    expect(query.update).toHaveBeenCalledWith({ value: "new", deleted: false, revision: 3 });
    expect(query.select).toHaveBeenCalledWith("value,revision,deleted");
  });
  it("inserts a missing row without upsert", async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: { value: "new", revision: 1, deleted: false },
      error: null,
    });
    await stateBackend.write("user-a", KEY, "new", null);
    expect(query.insert).toHaveBeenCalledWith({
      user_id: "user-a",
      key: KEY,
      value: "new",
      deleted: false,
      revision: 1,
    });
    expect(query.update).not.toHaveBeenCalled();
  });
  it("treats zero updated rows as a conflict", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(stateBackend.write("user-a", KEY, "new", 2)).rejects.toBeInstanceOf(SaveConflict);
  });
  it.each(["23505", "40001"])("treats database error %s as a conflict", async (code) => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { code } });
    await expect(stateBackend.write("user-a", KEY, "new", null)).rejects.toBeInstanceOf(
      SaveConflict,
    );
  });
  it("uses a versioned tombstone instead of physically deleting a row", async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: { value: "", revision: 3, deleted: true },
      error: null,
    });
    expect(await stateBackend.write("user-a", KEY, null, 2)).toEqual({ revision: 3, value: null });
    expect(query.update).toHaveBeenCalledWith({ value: "", deleted: true, revision: 3 });
  });
  it("scopes reads and retains tombstone revisions", async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: { value: "", revision: 7, deleted: true },
      error: null,
    });
    expect(await stateBackend.read("user-a", KEY)).toEqual({ revision: 7, value: null });
    expect(query.eq.mock.calls).toEqual([
      ["user_id", "user-a"],
      ["key", KEY],
    ]);
  });
  it("rejects an unversioned service response", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { value: "old" }, error: null });
    await expect(stateBackend.read("user-a", KEY)).rejects.toThrow("save service is being updated");
  });
});
