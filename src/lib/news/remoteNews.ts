import { createClient } from "@supabase/supabase-js";

import { parseCalendarCsv, saveNewsEvents, type NewsEvent } from "./calendar";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const BUCKET = "market-data-file";
const NEWS_PATH = "US30/NEWS/usd-high-impact.csv";

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Downloads the news file from Supabase, saves a copy on the phone, and returns the events. */
export async function refreshNewsFromSupabase(): Promise<NewsEvent[]> {
  const { data, error } = await supabase.storage.from(BUCKET).download(NEWS_PATH);
  if (error || !data) {
    throw new Error(error?.message ?? "News file not found");
  }
  const events = parseCalendarCsv(await data.text());
  if (events.length === 0) {
    throw new Error("News file is empty");
  }
  saveNewsEvents(events);
  return events;
}
