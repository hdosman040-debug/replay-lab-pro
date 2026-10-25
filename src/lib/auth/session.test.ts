import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { initialAuthSession, needsIdentityReload, nextAuthSession } from "./session";
const user = { id: "a", email: "a@example.com" } as User;

describe("auth transitions", () => {
  it("does not treat an ordinary existing session as recovery", () => {
    expect(nextAuthSession(initialAuthSession, "INITIAL_SESSION", user).recoveryUserId).toBeNull();
  });
  it("retains early recovery through initialization, but clears it on update or identity change", () => {
    const recovery = nextAuthSession(initialAuthSession, "PASSWORD_RECOVERY", user);
    expect(nextAuthSession(recovery, "INITIAL_SESSION", user).recoveryUserId).toBe("a");
    expect(nextAuthSession(recovery, "USER_UPDATED", user).recoveryUserId).toBeNull();
    expect(nextAuthSession(recovery, "SIGNED_IN", { ...user, id: "b" }).recoveryUserId).toBeNull();
    expect(nextAuthSession(recovery, "SIGNED_OUT", null).recoveryUserId).toBeNull();
  });
  it("lets the auth form finish while retaining workspace identity reloads", () => {
    expect(needsIdentityReload(true, null, "a", "/login")).toBe(false);
    expect(needsIdentityReload(true, "a", "b", "/login")).toBe(false);
    expect(needsIdentityReload(true, "a", "b", "/journal")).toBe(true);
    expect(needsIdentityReload(true, "a", null, "/")).toBe(true);
    expect(needsIdentityReload(true, "a", "a", "/")).toBe(false);
    expect(needsIdentityReload(false, null, "a", "/")).toBe(false);
  });
});
