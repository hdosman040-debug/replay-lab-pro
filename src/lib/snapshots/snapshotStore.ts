import { OWNER_ID } from "@/lib/owner";
import { supabase } from "@/lib/supabaseClient";

import * as local from "./snapshotStoreLocal";
import type { StoredSnapshot } from "./snapshotStoreLocal";

export type { StoredSnapshot } from "./snapshotStoreLocal";

const BUCKET = "chart-snapshots";
const TABLE = "chart_snapshots";

const filePath = (id: string) => `${OWNER_ID}/${id}`;

async function uploadToCloud(s: StoredSnapshot): Promise<void> {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath(s.id), s.blob, { upsert: true, contentType: s.blob.type || "image/png" });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from(TABLE).upsert({
    id: s.id,
    user_id: OWNER_ID,
    session_id: s.sessionId,
    kind: s.kind,
    journal_record_id: s.journalRecordId ?? null,
    created_at: s.createdAt,
  });
  if (error) throw error;
}

export async function saveSnapshot(snapshot: StoredSnapshot): Promise<void> {
  try {
    await uploadToCloud(snapshot);
  } catch (error) {
    console.error("[snapshots] cloud save failed, keeping local copy:", error);
    await local.saveSnapshot(snapshot);
  }
}

export async function getSnapshot(id: string): Promise<StoredSnapshot | null> {
  try {
    const { data: row, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw error;

    if (row) {
      // Files saved under an earlier account live at <old user id>/<id>; very old ones at the bucket root.
      let { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(`${row.user_id as string}/${id}`);
      if (downloadError || !blob) {
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
      if (row.journal_record_id) result.journalRecordId = row.journal_record_id as string;
      return result;
    }
  } catch (error) {
    console.error("[snapshots] cloud load failed, trying local copy:", error);
  }

  const localSnapshot = await local.getSnapshot(id).catch(() => null);
  if (localSnapshot) {
    void uploadToCloud(localSnapshot).catch((error) =>
      console.error("[snapshots] migration upload failed:", error),
    );
  }
  return localSnapshot;
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { data: row } = await supabase.from(TABLE).select("user_id").eq("id", id).maybeSingle();
  const paths = [filePath(id), id];
  if (row?.user_id) paths.push(`${row.user_id as string}/${id}`);

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) console.error("[snapshots] file delete failed:", removeError);

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) console.error("[snapshots] row delete failed:", error);

  await local.deleteSnapshot(id).catch(() => undefined);
}

export async function snapshotExists(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from(TABLE).select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) return true;
  } catch (error) {
    console.error("[snapshots] cloud exists check failed:", error);
  }
  return local.snapshotExists(id).catch(() => false);
}
