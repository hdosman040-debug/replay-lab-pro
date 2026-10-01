import { useAuthStore } from "@/lib/auth/authStore";
import { supabase } from "@/lib/supabaseClient";

import * as local from "./snapshotStoreLocal";
import type { StoredSnapshot } from "./snapshotStoreLocal";

export type { StoredSnapshot } from "./snapshotStoreLocal";

const BUCKET = "chart-snapshots";
const TABLE = "chart_snapshots";

const userId = (): string | null => useAuthStore.getState().user?.id ?? null;
const filePath = (uid: string, id: string) => `${uid}/${id}`;

async function uploadToCloud(uid: string, s: StoredSnapshot): Promise<void> {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath(uid, s.id), s.blob, {
      upsert: true,
      contentType: s.blob.type || "image/png",
    });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from(TABLE).upsert({
    id: s.id,
    user_id: uid,
    session_id: s.sessionId,
    kind: s.kind,
    journal_record_id: s.journalRecordId ?? null,
    created_at: s.createdAt,
  });
  if (error) throw error;
}

export async function saveSnapshot(snapshot: StoredSnapshot): Promise<void> {
  const uid = userId();
  if (!uid) {
    await local.saveSnapshot(snapshot);
    return;
  }
  try {
    await uploadToCloud(uid, snapshot);
  } catch (error) {
    console.error("[snapshots] cloud save failed, keeping local copy:", error);
    await local.saveSnapshot(snapshot);
  }
}

export async function getSnapshot(id: string): Promise<StoredSnapshot | null> {
  const uid = userId();

  if (uid) {
    try {
      const { data: row, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      if (row) {
        let { data: blob, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(filePath(uid, id));
        if (downloadError || !blob) {
          // Snapshots saved before logins existed live at the bucket root.
          const legacy = await supabase.storage.from(BUCKET).download(id);
          blob = legacy.data;
          downloadError = legacy.error;
        }
        if (downloadError || !blob) throw downloadError ?? new Error("Snapshot file missing");

        const result: StoredSnapshot = {
          id: row.id as string,
          blob,
          createdAt: Number(row.created_at),
          kind: row.kind as StoredSnapshot["kind"],
          sessionId: row.session_id as string,
        };
        if (row.journal_record_id) {
          result.journalRecordId = row.journal_record_id as string;
        }
        return result;
      }
    } catch (error) {
      console.error("[snapshots] cloud load failed, trying local copy:", error);
    }
  }

  const localSnapshot = await local.getSnapshot(id).catch(() => null);
  if (localSnapshot && uid) {
    // One-time migration of on-device snapshots into the signed-in account.
    void uploadToCloud(uid, localSnapshot).catch((error) =>
      console.error("[snapshots] migration upload failed:", error),
    );
  }
  return localSnapshot;
}

export async function deleteSnapshot(id: string): Promise<void> {
  const uid = userId();
  if (uid) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([filePath(uid, id), id]);
    if (removeError) console.error("[snapshots] file delete failed:", removeError);

    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) console.error("[snapshots] row delete failed:", error);
  }
  await local.deleteSnapshot(id).catch(() => undefined);
}

export async function snapshotExists(id: string): Promise<boolean> {
  if (userId()) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) return true;
    } catch (error) {
      console.error("[snapshots] cloud exists check failed:", error);
    }
  }
  return local.snapshotExists(id).catch(() => false);
}
