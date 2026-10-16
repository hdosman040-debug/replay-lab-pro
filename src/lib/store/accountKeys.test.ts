import { describe, expect, it } from "vitest";
import { accountCacheKey, accountStorageKey } from "./accountKeys";

describe("account-specific storage keys", () => {
  it("separates different users", () => {
    expect(accountCacheKey("user-a", "journal"))
      .not.toBe(accountCacheKey("user-b", "journal"));
  });

  it("separates different stores", () => {
    expect(accountCacheKey("user-a", "journal"))
      .not.toBe(accountCacheKey("user-a", "sessions"));
  });

  it("does not reuse legacy cache keys", () => {
    expect(accountCacheKey("user-a", "journal"))
      .not.toBe("cache:journal");
  });

  it("requires a user identity", () => {
    expect(() => accountCacheKey("", "journal")).toThrow();
    expect(() => accountStorageKey(" ", "journal")).toThrow();
  });

  it("produces deterministic account storage keys", () => {
    expect(accountStorageKey("user-a", "journal"))
      .toBe(accountStorageKey("user-a", "journal"));
  });

  it("encodes separators in identifiers", () => {
    expect(accountCacheKey("a:b", "c"))
      .not.toBe(accountCacheKey("a", "b:c"));
  });
});
