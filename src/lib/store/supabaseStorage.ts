import type { StateStorage } from "zustand/middleware";

import { supabase } from "@/lib/supabaseClient";

const TABLE = "app_state";
const SAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 8000;

const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

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
    /* local copy is only an offline cache */
  }
}

function localRemove(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function schedule(key: string, delay: number): void {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      void flushKey(key);
    }, delay),
  );
}

async function flushKey(key: string): Promise<void> {
  const timer = timers.get(key);
  if (timer) {
    clearTimeout(timer);
    timers.delete(key);
  }

  const value = pending.get(key);
  if (value === undefined) return;
  pending.delete(key);

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (error) {
    console.error("[supabaseStorage] save failed:", key, error);
    // Keep the data and retry later unless a newer value arrived.
    if (!pending.has(key)) pending.set(key, value);
    schedule(key, RETRY_DELAY_MS);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      for (const key of [...pending.keys()]) void flushKey(key);
    }
  });
}

/**
 * Zustand storage backed by the Supabase `app_state` table.
 * - Supabase is the source of truth.
 * - localStorage is kept as an offline cache and as a one-time migration
 *   source: if Supabase has no row yet but local data exists, it is uploaded.
 * - Writes are batched so replay clock ticks don't hit the network each step.
 */
export const supabaseStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("value")
        .eq("key", name)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        localSet(name, data.value);
        return data.value as string;
      }

      const local = localGet(name);
      if (local !== null) {
        pending.set(name, local);
        void flushKey(name);
      }
      return local;
    } catch (error) {
      console.error("[supabaseStorage] load failed, using local copy:", name, error);
      return localGet(name);
    }
  },

  setItem: (name, value) => {
    localSet(name, value);
    pending.set(name, value);
    schedule(name, SAVE_DELAY_MS);
  },

  removeItem: async (name) => {
    localRemove(name);
    pending.delete(name);
    const timer = timers.get(name);
    if (timer) {
      clearTimeout(timer);
      timers.delete(name);
    }
    const { error } = await supabase.from(TABLE).delete().eq("key", name);
    if (error) console.error("[supabaseStorage] delete failed:", name, error);
  },
};
