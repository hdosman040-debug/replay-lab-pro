import { flushPendingSaves } from "@/lib/store/supabaseStorage";
import { supabase } from "@/lib/supabaseClient";

/** Save anything pending, then sign out of this device only. */
export async function signOut(): Promise<void> {
  await flushPendingSaves();
  await supabase.auth.signOut({ scope: "local" });
}
