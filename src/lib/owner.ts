import { supabase } from "@/lib/supabaseClient";

export async function getOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw error ?? new Error("Authenticated user required for cloud snapshot storage.");
  }

  return data.user.id;
}
