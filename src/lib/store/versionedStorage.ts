import type { StateStorage } from "zustand/middleware";
import { accountCacheKey } from "./accountKeys";

export type CloudState = { revision: number; value: string | null };
export interface StateBackend {
  read(userId: string, name: string): Promise<CloudState | null>;
  write(
    userId: string,
    name: string,
    value: string | null,
    revision: number | null,
  ): Promise<CloudState>;
}
export class SaveConflict extends Error {
  constructor() {
    super("Another tab or device changed your saved data.");
  }
}
export type SaveStatus = "saved" | "saving" | "error" | "conflict";
type Draft = {
  format: 2;
  name: string;
  value: string | null;
  baseRevision: number | null;
  baseKnown: boolean;
  after?: CloudState;
};
type Pending = Draft & { userId: string; generation: number };
type StoredDraft = { key: string; raw: string; draft: Draft };

/** One instance per tab; a write always compares the revision this tab loaded. */
export function createVersionedStorage(backend: StateBackend, cache: () => Storage | undefined) {
  const instance = globalThis.crypto.randomUUID();
  let user: string | null = null;
  let generation = 0,
    failures = 0;
  let paused = false;
  let status: SaveStatus = "saved";
  const listeners = new Set<() => void>();
  const known = new Map<string, CloudState | null>();
  const pending = new Map<string, Pending>();
  const queued = new Set<Pending>();
  const running = new Map<string, Pending>();
  const chains = new Map<string, Promise<void>>();
  const inFlight = new Set<Promise<void>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const blocked = new Set<string>(),
    errors = new Set<string>();
  const recovered = new Map<string, StoredDraft[]>();

  function publish() {
    const next: SaveStatus = blocked.size
      ? "conflict"
      : errors.size
        ? "error"
        : pending.size || inFlight.size
          ? "saving"
          : "saved";
    if (next !== status) {
      status = next;
      listeners.forEach((fn) => fn());
    }
  }
  function requireUser() {
    if (!user) throw new Error("Authenticated user required for journal storage");
    return user;
  }
  const accountPrefix = (id: string) => `pending-v2:cache:user:${encodeURIComponent(id)}:`;
  const outboxKey = (id: string, name: string) =>
    `pending-v2:${accountCacheKey(id, name)}:${instance}`;
  function serialize(item: Draft): string {
    const { format, name, value, baseRevision, baseKnown, after } = item;
    return JSON.stringify({
      format,
      name,
      value,
      baseRevision,
      baseKnown,
      ...(after ? { after } : {}),
    });
  }
  function persist(item: Pending) {
    try {
      const storage = cache();
      if (!storage) throw new Error("Local storage unavailable");
      storage.setItem(outboxKey(item.userId, item.name), serialize(item));
    } catch {
      errors.add(item.name);
      publish();
    }
  }
  function removeExact(key: string, raw: string) {
    try {
      const storage = cache();
      if (storage?.getItem(key) === raw) storage.removeItem(key);
    } catch {
      /* Keep backup. */
    }
  }
  function replaceExact(item: Pending, previous: string) {
    try {
      if (cache()?.getItem(outboxKey(item.userId, item.name)) === previous) persist(item);
    } catch {
      errors.add(item.name);
    }
  }
  function current(item: Pending) {
    return item.userId === user && item.generation === generation;
  }
  function schedule(name: string, delay: number) {
    const timer = timers.get(name);
    if (timer) clearTimeout(timer);
    if (!paused && !blocked.has(name))
      timers.set(
        name,
        setTimeout(() => {
          void flushKey(name);
        }, delay),
      );
  }
  function collect(id: string, name: string): StoredDraft[] {
    const result: StoredDraft[] = [];
    try {
      const storage = cache();
      if (!storage) return result;
      const prefix = `pending-v2:${accountCacheKey(id, name)}:`;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix)) continue;
        const raw = storage.getItem(key);
        if (raw === null) continue;
        try {
          const d = JSON.parse(raw) as Draft;
          if (
            d.format !== 2 ||
            d.name !== name ||
            !(d.value === null || typeof d.value === "string") ||
            !(
              d.baseRevision === null ||
              (Number.isSafeInteger(d.baseRevision) && d.baseRevision > 0)
            ) ||
            typeof d.baseKnown !== "boolean" ||
            (d.after &&
              (!Number.isSafeInteger(d.after.revision) ||
                !(d.after.value === null || typeof d.after.value === "string")))
          )
            throw new Error("Invalid draft");
          result.push({ key, raw, draft: d });
        } catch {
          result.push({
            key,
            raw,
            draft: { format: 2, name, value: raw, baseRevision: null, baseKnown: false },
          });
        }
      }
      // Old versions did not record a base revision. Preserve those edits for review.
      const key = `pending:${accountCacheKey(id, name)}`;
      const raw = storage.getItem(key);
      if (raw !== null)
        result.push({
          key,
          raw,
          draft: { format: 2, name, value: raw, baseRevision: null, baseKnown: false },
        });
    } catch {
      errors.add(name);
    }
    return result;
  }
  function enqueue(name: string, value: string | null): Pending {
    const id = requireUser();
    const previous = pending.get(name);
    if (previous) queued.delete(previous);
    const base = known.get(name);
    const item: Pending = {
      format: 2,
      name,
      value,
      userId: id,
      generation,
      baseRevision: base?.revision ?? null,
      baseKnown: known.has(name),
    };
    const before = running.get(name);
    if (before && current(before))
      item.after = { revision: (before.baseRevision ?? 0) + 1, value: before.value };
    pending.set(name, item);
    queued.add(item);
    persist(item);
    if (!item.baseKnown) blocked.add(name);
    schedule(name, 1500);
    publish();
    return item;
  }
  function acknowledge(item: Pending, cloud: CloudState) {
    removeExact(outboxKey(item.userId, item.name), serialize(item));
    if (!current(item)) return;
    known.set(item.name, cloud);
    for (const candidate of queued) {
      if (
        candidate !== item &&
        current(candidate) &&
        candidate.name === item.name &&
        candidate.baseRevision === item.baseRevision
      ) {
        const old = serialize(candidate);
        candidate.baseRevision = cloud.revision;
        candidate.baseKnown = true;
        delete candidate.after;
        replaceExact(candidate, old);
      }
    }
    for (const draft of recovered.get(item.name) ?? []) removeExact(draft.key, draft.raw);
    recovered.delete(item.name);
    errors.delete(item.name);
  }
  async function perform(item: Pending) {
    if (!current(item) || paused || blocked.has(item.name)) return;
    running.set(item.name, item);
    // A reload may occur after the server commits but before its reply reaches this tab.
    for (const other of queued) {
      if (
        other !== item &&
        current(other) &&
        other.name === item.name &&
        other.baseRevision === item.baseRevision
      ) {
        const raw = serialize(other);
        other.after = { revision: (item.baseRevision ?? 0) + 1, value: item.value };
        replaceExact(other, raw);
      }
    }
    try {
      if (!item.baseKnown) throw new SaveConflict();
      let cloud: CloudState;
      try {
        cloud = await backend.write(item.userId, item.name, item.value, item.baseRevision);
      } catch (error) {
        if (!(error instanceof SaveConflict)) throw error;
        const latest = await backend.read(item.userId, item.name);
        if (!current(item)) return;
        if (
          latest &&
          latest.value === item.value &&
          latest.revision === (item.baseRevision ?? 0) + 1
        )
          cloud = latest;
        else if (
          latest &&
          item.after?.revision === latest.revision &&
          item.after.value === latest.value
        ) {
          const raw = serialize(item);
          item.baseRevision = latest.revision;
          delete item.after;
          replaceExact(item, raw);
          cloud = await backend.write(item.userId, item.name, item.value, item.baseRevision);
        } else throw error;
      }
      acknowledge(item, cloud);
    } catch (error) {
      failures++;
      if (!current(item)) return;
      if (error instanceof SaveConflict) blocked.add(item.name);
      else errors.add(item.name);
      if (
        !pending.has(item.name) &&
        ![...queued].some((x) => x !== item && current(x) && x.name === item.name)
      )
        pending.set(item.name, item);
      schedule(item.name, 8000);
    } finally {
      if (running.get(item.name) === item) running.delete(item.name);
      if (pending.get(item.name) !== item) queued.delete(item);
      publish();
    }
  }
  async function flushKey(name: string): Promise<void> {
    const timer = timers.get(name);
    if (timer) clearTimeout(timer);
    timers.delete(name);
    if (paused || blocked.has(name)) return;
    const item = pending.get(name);
    if (!item) return;
    pending.delete(name);
    const previous = chains.get(name);
    const operation = (async () => {
      if (previous) await previous;
      await perform(item);
    })();
    chains.set(name, operation);
    inFlight.add(operation);
    publish();
    try {
      await operation;
    } finally {
      inFlight.delete(operation);
      if (chains.get(name) === operation) chains.delete(name);
      publish();
    }
  }
  async function flushPendingSaves() {
    await Promise.all([...pending.keys()].map(flushKey));
  }
  async function flushAndVerifySaves() {
    const id = requireUser(),
      requestGeneration = generation,
      failuresBefore = failures;
    await flushPendingSaves();
    while (inFlight.size) await Promise.all([...inFlight]);
    if (user !== id || generation !== requestGeneration)
      throw new Error("Account changed while saving");
    if (failures !== failuresBefore || pending.size || blocked.size)
      throw new Error(
        "Some changes could not be saved. Resolve the save notice before logging out.",
      );
  }
  function setStorageUser(id: string | null) {
    if (user === id) return;
    generation++;
    timers.forEach(clearTimeout);
    timers.clear();
    pending.clear();
    known.clear();
    blocked.clear();
    errors.clear();
    recovered.clear();
    queued.clear();
    running.clear();
    paused = false;
    user = id;
    publish();
  }
  const supabaseStorage: StateStorage = {
    getItem: async (name) => {
      const id = requireUser(),
        requestGeneration = generation;
      const cloud = await backend.read(id, name);
      if (id !== user || requestGeneration !== generation)
        throw new Error("Storage account changed during load");
      const remaining: StoredDraft[] = [];
      for (const draft of collect(id, name)) {
        if (draft.draft.value === (cloud?.value ?? null)) removeExact(draft.key, draft.raw);
        else remaining.push(draft);
      }
      const local = pending.get(name) ?? running.get(name);
      // A second hydration read must not advance the base of an existing local edit.
      if (local) {
        if (
          (cloud?.revision ?? null) !== local.baseRevision &&
          cloud?.value !== local.value &&
          !(cloud && local.after?.revision === cloud.revision && local.after.value === cloud.value)
        )
          blocked.add(name);
        publish();
        return local.value;
      }
      known.set(name, cloud);
      if (remaining.length) {
        const first = remaining[0]!.draft;
        const safe = remaining.every(
          ({ draft }) =>
            draft.baseKnown &&
            draft.value === first.value &&
            (draft.baseRevision === (cloud?.revision ?? null) ||
              (cloud &&
                draft.after?.revision === cloud.revision &&
                draft.after.value === cloud.value)),
        );
        if (!safe) {
          blocked.add(name);
          publish();
          return cloud?.value ?? null;
        }
        recovered.set(name, remaining);
        enqueue(name, first.value);
        return first.value;
      }
      return cloud?.value ?? null;
    },
    setItem: (name, value) => {
      enqueue(name, value);
    },
    removeItem: async (name) => {
      enqueue(name, null);
      await flushKey(name);
      if (blocked.has(name) || pending.has(name))
        throw new Error("Deletion could not be saved. Your previous data is protected.");
    },
  };
  function recoveryEntries() {
    const id = requireUser(),
      entries = new Map<string, string>();
    try {
      const storage = cache();
      if (storage)
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (
            key &&
            (key.startsWith(accountPrefix(id)) ||
              key.startsWith(`pending:cache:user:${encodeURIComponent(id)}:`))
          ) {
            const raw = storage.getItem(key);
            if (raw !== null) entries.set(key, raw);
          }
        }
    } catch {
      /* Include memory even if browser storage is unavailable. */
    }
    for (const item of [...running.values(), ...queued, ...pending.values()])
      if (current(item)) entries.set(outboxKey(id, item.name), serialize(item));
    return entries;
  }
  function exportUnsavedChanges() {
    return JSON.stringify(
      {
        format: "replay-lab-unsaved-v2",
        userId: requireUser(),
        exportedAt: new Date().toISOString(),
        entries: [...recoveryEntries()].map(([key, raw]) => ({ key, raw })),
      },
      null,
      2,
    );
  }
  async function archiveForCloudReload() {
    const id = requireUser(),
      requestGeneration = generation;
    paused = true;
    timers.forEach(clearTimeout);
    timers.clear();
    while (inFlight.size) await Promise.all([...inFlight]);
    if (user !== id || requestGeneration !== generation)
      throw new Error("Account changed while preparing recovery");
    const storage = cache();
    if (!storage)
      throw new Error(
        "Could not keep a recovery backup. Download your unsaved copy and keep this tab open.",
      );
    const entries = recoveryEntries();
    storage.setItem(
      `recovery-archive:${encodeURIComponent(id)}:${Date.now()}:${instance}`,
      JSON.stringify([...entries]),
    );
    for (const [key, raw] of entries) removeExact(key, raw);
    pending.clear();
    queued.clear();
    blocked.clear();
    errors.clear();
    publish();
  }
  return {
    supabaseStorage,
    setStorageUser,
    getStorageUser: () => user,
    flushPendingSaves,
    flushAndVerifySaves,
    hasUnsavedChanges: () => pending.size > 0 || inFlight.size > 0 || blocked.size > 0,
    getSaveStatus: () => status,
    subscribeSaveStatus: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    exportUnsavedChanges,
    archiveForCloudReload,
  };
}
