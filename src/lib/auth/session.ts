import { createContext } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";

export type AuthSessionState = {
  user: User | null;
  recoveryUserId: string | null;
};

export const initialAuthSession: AuthSessionState = {
  user: null,
  recoveryUserId: null,
};

// Root owns this state so PASSWORD_RECOVERY is not lost before Login mounts.
// Recovery intent lasts only for this document. Reloading requires a fresh link.
export function nextAuthSession(
  previous: AuthSessionState,
  event: AuthChangeEvent,
  user: User | null,
): AuthSessionState {
  return {
    user,
    recoveryUserId:
      event === "PASSWORD_RECOVERY" && user
        ? user.id
        : user && previous.recoveryUserId === user.id && event !== "USER_UPDATED"
          ? previous.recoveryUserId
          : null,
  };
}

export const AuthSessionContext = createContext(initialAuthSession);

export function needsIdentityReload(
  initialized: boolean,
  previousId: string | null,
  nextId: string | null,
  pathname: string,
) {
  // Auth forms navigate after the request completes. They contain no workspace
  // stores; the full success navigation clears state before opening a workspace.
  return initialized && previousId !== nextId && pathname !== "/login";
}

let currentAuthSession = initialAuthSession;
export function recordAuthSession(event: AuthChangeEvent, user: User | null) {
  currentAuthSession = nextAuthSession(currentAuthSession, event, user);
}
export function getAuthSession() {
  return currentAuthSession;
}
