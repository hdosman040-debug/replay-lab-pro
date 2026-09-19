import { useEffect, useState } from "react";

import { useJournalStore } from "./journalStore";
import { useSessionStore } from "./sessionStore";
import { useSettingsStore } from "./settingsStore";

let hydrated = false;

/** Rehydrate persisted stores on the client once; returns true when done. */
export function useStoresHydrated(): boolean {
  const [ready, setReady] = useState(hydrated);
  useEffect(() => {
    if (hydrated) {
      setReady(true);
      return;
    }
    Promise.all([
      useSessionStore.persist.rehydrate(),
      useJournalStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]).then(() => {
      hydrated = true;
      setReady(true);
    });
  }, []);
  return ready;
}
