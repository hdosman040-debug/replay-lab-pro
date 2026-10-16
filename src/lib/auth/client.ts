import { supabase } from "../supabaseClient";

/** Authentication and data requests share the same session. */
export const supabaseAuth = supabase;
