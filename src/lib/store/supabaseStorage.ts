import type { StateStorage } from "zustand/middleware";

import { OWNER_ID } from "@/lib/owner";
import { supabase } from "@/lib/supabaseClient";

const TABLE = "user_state";
const SAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 8000;

const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const cacheName = (name: string) => `cache:${name}`;

function localGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* offline cache only */
  }
}

function localRemove(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function schedule(name: string, delay: number): void {
  const existing = timers.get(name);
  if (existing) clearTimeout(existing);
  timers.set(
    name,
    setTimeout(() => {
      void flushKey(name);
    }, delay),
  );
}

function queueSave(name: string, value: string): void {
  pending.set(name, value);
  schedule(name, SAVE_DELAY_MS);
}

async function flushKey(name: string): Promise<void> {
  const timer = timers.get(name);
  if (timer) {
    clearTimeout(timer);
    timers.delete(name);
  }
  const value = pending.get(name);
  if (value === undefined) return;
  pending.delete(name);

  try {
    const { error } = await supabase.from(TABLE).upsert(
      { user_id: OWNER_ID, key: name, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" },
    );
    if (error) throw error;
  } catch (error) {
    console.error("[supabaseStorage] save failed:", name, error);
    if (!pending.has(name)) pending.set(name, value);
    schedule(name, RETRY_DELAY_MS);
  }
}

/** Push every queued save now (used when the tab hides). */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...pending.keys()].map((n) => flushKey(n)));
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingSaves();
  });
}

/** Zustand storage: Supabase is the source of truth, localStorage is an offline cache. */
export const supabaseStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("value")
        .eq("user_id", OWNER_ID)
        .eq("key", name)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const value = data.value as string;
        localSet(cacheName(name), value);
        return value;
      }
      const cached = localGet(cacheName(name));
      if (cached !== null) queueSave(name, cached);
      return cached;
    } catch (error) {
      console.error("[supabaseStorage] load failed, using local copy:", name, error);
      return localGet(cacheName(name));
    }
  },

  setItem: (name, value) => {
    localSet(cacheName(name), value);
    queueSave(name, value);
  },

  removeItem: async (name) => {
    localRemove(cacheName(name));
    pending.delete(name);
    const timer = timers.get(name);
    if (timer) {
      clearTimeout(timer);
      timers.delete(name);
    }
    const { error } = await supabase.from(TABLE).delete().eq("user_id", OWNER_ID).eq("key", name);
    if (error) console.error("[supabaseStorage] delete failed:", name, error);
  },
};
