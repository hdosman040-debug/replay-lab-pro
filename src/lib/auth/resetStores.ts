import { useJournalStore } from "@/lib/store/journalStore";
import { useSessionStore } from "@/lib/store/sessionStore";

import { useAuthStore } from "./authStore";

/**
 * When the user signs out, wipe the in-memory stores so the next account on
 * this device never sees (or overwrites) someone else's data. Writes are
 * ignored while signed out, so this never touches the cloud copy.
 */
useAuthStore.subscribe((state, prev) => {
  if (prev.user && !state.user) {
    useSessionStore.setState({ sessions: {}, activeSessionId: null });
    useJournalStore.setState({ records: [] });
  }
});
