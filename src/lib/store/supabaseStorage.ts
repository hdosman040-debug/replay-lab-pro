import type { StateStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabaseClient";
import { accountCacheKey } from "./accountKeys";

const TABLE = "user_state";
const SAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 8000;

let activeUserId: string | null = null;
let generation = 0;

type PendingSave = {
  userId: string;
  generation: number;
  value: string;
};

const pending = new Map<string, PendingSave>();
const inFlight = new Set<Promise<void>>();
const keyWriteChains = new Map<string, Promise<void>>();
let failedSaveCount = 0;

/** True if any queued or already-started save is unfinished. */
export function hasUnsavedChanges(): boolean {
  return pending.size > 0 || inFlight.size > 0;
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearPending(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  pending.clear();
}

export function setStorageUser(userId: string | null): void {
  if (activeUserId === userId) return;
  generation++;
  clearPending();
  activeUserId = userId;
}

export function getStorageUser(): string | null {
  return activeUserId;
}

function requireUser(): string {
  if (!activeUserId) {
    throw new Error("Authenticated user required for journal storage");
  }
  return activeUserId;
}

function localSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // Local cache is optional.
  }
}

function localRemove(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    // Local cache is optional.
  }
}

function schedule(name: string, delay: number): void {
  const previous = timers.get(name);
  if (previous) clearTimeout(previous);

  timers.set(
    name,
    setTimeout(() => { void flushKey(name); }, delay),
  );
}

function queueSave(name: string, value: string): void {
  const userId = requireUser();

  pending.set(name, {
    userId,
    generation,
    value,
  });

  schedule(name, SAVE_DELAY_MS);
}

async function flushKey(name: string): Promise<void> {
  const previous = keyWriteChains.get(name);

  const operation = (async () => {
    if (previous) await previous;
    await performFlushKey(name);
  })();

  keyWriteChains.set(name, operation);
  inFlight.add(operation);

  try {
    await operation;
  } finally {
    inFlight.delete(operation);

    if (keyWriteChains.get(name) === operation) {
      keyWriteChains.delete(name);
    }
  }
}

async function performFlushKey(name: string): Promise<void> {
  const timer = timers.get(name);
  if (timer) clearTimeout(timer);
  timers.delete(name);

  const item = pending.get(name);
  if (!item) return;
  pending.delete(name);

  if (item.userId !== activeUserId || item.generation !== generation) {
    return;
  }

  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: item.userId,
        key: name,
        value: item.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" },
    );

    if (error) throw error;
  } catch (error) {
    failedSaveCount++;
    console.error("[supabaseStorage] save failed:", name, error);

    if (item.userId !== activeUserId || item.generation !== generation) {
      return;
    }

    if (!pending.has(name)) {
      pending.set(name, item);
      schedule(name, RETRY_DELAY_MS);
    }
  }
}

/**
 * Flush outstanding changes and verify that no writes remain.
 * Reject rather than allowing logout after a failed save.
 */
export async function flushAndVerifySaves(): Promise<void> {
  const userId = requireUser();
  const requestGeneration = generation;
  const failuresBefore = failedSaveCount;

  await flushPendingSaves();

  while (inFlight.size > 0) {
    await Promise.all([...inFlight]);
  }

  if (
    activeUserId !== userId ||
    generation !== requestGeneration
  ) {
    throw new Error("Account changed while saving");
  }

  if (failedSaveCount !== failuresBefore || pending.size > 0) {
    throw new Error(
      "Some changes could not be saved. Please retry before logging out.",
    );
  }
}

export async function flushPendingSaves(): Promise<void> {
  await Promise.all([...pending.keys()].map((name) => flushKey(name)));
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushPendingSaves();
    }
  });
}

export const supabaseStorage: StateStorage = {
  getItem: async (name) => {
    const userId = requireUser();
    const requestGeneration = generation;

    const { data, error } = await supabase
      .from(TABLE)
      .select("value")
      .eq("user_id", userId)
      .eq("key", name)
      .maybeSingle();

    if (error) throw error;

    if (userId !== activeUserId || requestGeneration !== generation) {
      throw new Error("Storage account changed during load");
    }

    if (!data) return null;

    const value = data.value as string;
    localSet(accountCacheKey(userId, name), value);
    return value;
  },

  setItem: (name, value) => {
    const userId = requireUser();

    localSet(accountCacheKey(userId, name), value);
    queueSave(name, value);
  },

  removeItem: async (name) => {
    const userId = requireUser();
    const requestGeneration = generation;

    localRemove(accountCacheKey(userId, name));

    pending.delete(name);
    const timer = timers.get(name);
    if (timer) clearTimeout(timer);
    timers.delete(name);

    if (userId !== activeUserId || requestGeneration !== generation) {
      return;
    }

    const previous = keyWriteChains.get(name);

    const operation = (async () => {
      if (previous) await previous;

      if (
        userId !== activeUserId ||
        requestGeneration !== generation
      ) {
        return;
      }

      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("key", name);

      if (error) throw error;
    })();

    keyWriteChains.set(name, operation);
    inFlight.add(operation);

    try {
      await operation;
    } finally {
      inFlight.delete(operation);

      if (keyWriteChains.get(name) === operation) {
        keyWriteChains.delete(name);
      }
    }
  },
};
