import { useEffect, useState } from "react";

import { getStorageUser, supabaseStorage } from "./supabaseStorage";
import { useJournalStore } from "./journalStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";

let hydratedUser: string | null = null;
let pendingHydration: Promise<void> | null = null;

async function hydrateForUser(userId: string): Promise<void> {
  if (hydratedUser === userId) return;

  if (getStorageUser() !== userId) {
    throw new Error("Account changed before hydration");
  }

  // Verify both cloud reads explicitly. Zustand can otherwise swallow
  // storage errors and complete hydration with default empty state.
  await Promise.all([
    supabaseStorage.getItem("ict-terminal.sessions.v1"),
    supabaseStorage.getItem("ict-terminal.journal.v1"),
  ]);

  if (getStorageUser() !== userId) {
    throw new Error("Account changed during storage verification");
  }

  await Promise.all([
    useSessionStore.persist.rehydrate(),
    useJournalStore.persist.rehydrate(),
    useSettingsStore.persist.rehydrate(),
  ]);

  if (getStorageUser() !== userId) {
    throw new Error("Account changed during hydration");
  }

  hydratedUser = userId;
}

/** Returns true only after authenticated cloud data has loaded. */
export function useStoresHydrated(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const userId = getStorageUser();

    if (!userId) {
      setReady(false);
      return;
    }

    if (hydratedUser === userId) {
      setReady(true);
      return;
    }

    let cancelled = false;

    if (!pendingHydration) {
      pendingHydration = hydrateForUser(userId).finally(() => {
        pendingHydration = null;
      });
    }

    pendingHydration.then(() => {
      if (!cancelled && getStorageUser() === userId) {
        setReady(true);
      }
    }).catch((error: unknown) => {
      console.error("[hydrate] Account data could not be loaded:", error);
      if (!cancelled) setReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
