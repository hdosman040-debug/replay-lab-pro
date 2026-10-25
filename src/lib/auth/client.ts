import { recordAuthSession } from "./session";
import { supabase } from "../supabaseClient";

/** Authentication and data requests share the same session. */
export const supabaseAuth = supabase;

// Subscribe before React mounts: URL recovery can finish before the root effect.
// Never retain user state in the server-side module instance.
if (typeof window !== "undefined") {
  const { data } = supabaseAuth.auth.onAuthStateChange((event, session) => {
    recordAuthSession(event, session?.user ?? null);
  });
  if (import.meta.hot) import.meta.hot.dispose(() => data.subscription.unsubscribe());
}
