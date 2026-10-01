import type { StateStorage } from "zustand/middleware";

import { useAuthStore } from "@/lib/auth/authStore";
import { supabase } from "@/lib/supabaseClient";

const TABLE = "user_state";
const SAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 8000;
const LEGACY_FLAG = "replay-lab-pro.legacy-migrated";

type Pending = { uid: string; name: string; value: string };

const pending = new Map<string, Pending>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const pendingKey = (uid: string, name: string) => `${uid}|${name}`;
const cacheName = (uid: string, name: string) => `u:${uid}:${name}`;

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

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

function schedule(k: string, delay: number): void {
  const existing = timers.get(k);
  if (existing) clearTimeout(existing);
  timers.set(
    k,
    setTimeout(() => {
      void flushKey(k);
    }, delay),
  );
}

function queueSave(uid: string, name: string, value: string): void {
  const k = pendingKey(uid, name);
  pending.set(k, { uid, name, value });
  schedule(k, SAVE_DELAY_MS);
}

async function flushKey(k: string): Promise<void> {
  const timer = timers.get(k);
  if (timer) {
    clearTimeout(timer);
    timers.delete(k);
  }

  const entry = pending.get(k);
  if (!entry) return;
  pending.delete(k);

  // Never write another account's data into the current session.
  if (currentUserId() !== entry.uid) {
    console.warn("[supabaseStorage] dropped save for a signed-out account:", entry.name);
    return;
  }

  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: entry.uid,
        key: entry.name,
        value: entry.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" },
    );
    if (error) throw error;
  } catch (error) {
    console.error("[supabaseStorage] save failed:", entry.name, error);
    if (!pending.has(k)) pending.set(k, entry);
    schedule(k, RETRY_DELAY_MS);
  }
}

/** Push every queued save now (used before sign-out and when the tab hides). */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...pending.keys()].map((k) => flushKey(k)));
}

/** Called once the first account has adopted any pre-login local data. */
export function markLegacyMigrated(): void {
  localSet(LEGACY_FLAG, "1");
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingSaves();
  });
}

/**
 * Zustand storage backed by the per-user Supabase `user_state` table.
 * - Supabase is the source of truth; localStorage is a per-account offline cache.
 * - The first account on a device adopts data recorded before logins existed.
 * - Writes are batched, and ignored while signed out.
 */
export const supabaseStorage: StateStorage = {
  getItem: async (name) => {
    const uid = currentUserId();
    if (!uid) return null;

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("value")
        .eq("key", name)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        localSet(cacheName(uid, name), data.value as string);
        return data.value as string;
      }

      if (localGet(LEGACY_FLAG) === null) {
        const legacy = localGet(name);
        if (legacy !== null) {
          localSet(cacheName(uid, name), legacy);
          queueSave(uid, name, legacy);
          return legacy;
        }
      }

      return localGet(cacheName(uid, name));
    } catch (error) {
      console.error("[supabaseStorage] load failed, using local copy:", name, error);
      return localGet(cacheName(uid, name));
    }
  },

  setItem: (name, value) => {
    const uid = currentUserId();
    if (!uid) return;
    localSet(cacheName(uid, name), value);
    queueSave(uid, name, value);
  },

  removeItem: async (name) => {
    const uid = currentUserId();
    if (!uid) return;

    localRemove(cacheName(uid, name));
    const k = pendingKey(uid, name);
    pending.delete(k);
    const timer = timers.get(k);
    if (timer) {
      clearTimeout(timer);
      timers.delete(k);
    }

    const { error } = await supabase.from(TABLE).delete().eq("key", name);
    if (error) console.error("[supabaseStorage] delete failed:", name, error);
  },
};
