import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

/** False when the environment variables were not injected at build time. */
export const isSupabaseConfigured = Boolean(
  url &&
  key &&
  (() => {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" ||
        (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))
      );
    } catch {
      return false;
    }
  })(),
);

export const supabase = createClient(
  isSupabaseConfigured ? url! : "https://placeholder.supabase.co",
  isSupabaseConfigured ? key! : "placeholder-anon-key",
);
