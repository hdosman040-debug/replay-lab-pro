import type { User } from "@supabase/supabase-js";

/** Friendly label for the signed-in user (email, or social username). */
export function accountName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const pick = (k: string): string | null => {
    const v = meta?.[k];
    return typeof v === "string" && v ? v : null;
  };
  return (
    user.email ??
    pick("user_name") ??
    pick("preferred_username") ??
    pick("full_name") ??
    pick("name") ??
    "your account"
  );
}
