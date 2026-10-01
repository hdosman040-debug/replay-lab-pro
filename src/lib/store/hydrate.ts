import { useEffect, useState } from "react";

import "@/lib/auth/resetStores";
import { useAuthStore } from "@/lib/auth/authStore";

import { useJournalStore } from "./journalStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";
import { markLegacyMigrated } from "./supabaseStorage";

let hydratedFor: string | null = null;

/** Rehydrate the stores for the signed-in user; returns true when done. */
export function useStoresHydrated(): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      hydratedFor = null;
      setReady(false);
      return;
    }

    if (hydratedFor === userId) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    Promise.all([
      useSessionStore.persist.rehydrate(),
      useJournalStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]).then(() => {
      if (cancelled) return;
      markLegacyMigrated();
      hydratedFor = userId;
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return ready;
}
