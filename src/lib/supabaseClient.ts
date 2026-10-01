import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

/** Shared client for app data (sessions, journal, snapshots). */
export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
