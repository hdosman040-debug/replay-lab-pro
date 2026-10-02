import { useEffect, useState } from "react";

import { useJournalStore } from "./journalStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";

let hydrated = false;

/** Rehydrate the local stores once; returns true when done. */
export function useStoresHydrated(): boolean {
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    if (hydrated) {
      setReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([
      useSessionStore.persist.rehydrate(),
      useJournalStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]).then(() => {
      hydrated = true;
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
