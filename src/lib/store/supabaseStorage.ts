import { supabase } from "@/lib/supabaseClient";
import {
  createVersionedStorage,
  SaveConflict,
  type CloudState,
  type StateBackend,
} from "./versionedStorage";

const TABLE = "user_state";
function state(row: { revision: number; value: string; deleted: boolean }): CloudState {
  if (!Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.deleted !== "boolean") {
    throw new Error("The save service is being updated. Reload and try again.");
  }
  return { revision: row.revision, value: row.deleted ? null : row.value };
}
export const stateBackend: StateBackend = {
  async read(userId, name) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("value,revision,deleted")
      .eq("user_id", userId)
      .eq("key", name)
      .maybeSingle();
    if (error) throw error;
    return data ? state(data) : null;
  },
  async write(userId, name, value, revision) {
    const fields = { value: value ?? "", deleted: value === null, revision: (revision ?? 0) + 1 };
    const query =
      revision === null
        ? supabase.from(TABLE).insert({ user_id: userId, key: name, ...fields })
        : supabase
            .from(TABLE)
            .update(fields)
            .eq("user_id", userId)
            .eq("key", name)
            .eq("revision", revision);
    const { data, error } = await query.select("value,revision,deleted").maybeSingle();
    if (error?.code === "23505" || error?.code === "40001") throw new SaveConflict();
    if (error) throw error;
    if (!data) throw new SaveConflict();
    return state(data);
  },
};
const storage = createVersionedStorage(stateBackend, () =>
  typeof localStorage === "undefined" ? undefined : localStorage,
);
export const {
  supabaseStorage,
  setStorageUser,
  getStorageUser,
  flushPendingSaves,
  flushAndVerifySaves,
  hasUnsavedChanges,
  getSaveStatus,
  subscribeSaveStatus,
  exportUnsavedChanges,
  archiveForCloudReload,
} = storage;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingSaves();
  });
  window.addEventListener("online", () => {
    void flushPendingSaves();
  });
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
