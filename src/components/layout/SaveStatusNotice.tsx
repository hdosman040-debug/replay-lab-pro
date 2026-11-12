import { useState, useSyncExternalStore } from "react";
import {
  archiveForCloudReload,
  exportUnsavedChanges,
  flushPendingSaves,
  getSaveStatus,
  subscribeSaveStatus,
} from "@/lib/store/supabaseStorage";

export function SaveStatusNotice() {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, () => "saved" as const);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === "saved" || status === "saving") return null;
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportUnsavedChanges()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `replay-lab-unsaved-${Date.now()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function reloadCloud() {
    setBusy(true);
    setError(null);
    try {
      download();
      await archiveForCloudReload();
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }
  return (
    <div
      role="alert"
      className="shrink-0 space-y-2 border-b border-amber-500/50 bg-surface px-4 py-3 text-sm"
    >
      <p className="font-semibold">
        {status === "conflict"
          ? "Saving paused: another saved version needs review."
          : "Your latest changes have not finished saving."}
      </p>
      <p className="text-xs text-muted-foreground">
        {status === "conflict"
          ? "Your changes have not replaced the cloud version. Download the unsaved copy before reloading saved data."
          : "Keep this tab open. You can retry saving or download your unsaved changes."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="touch-btn border border-border text-xs"
          onClick={download}
          disabled={busy}
        >
          Download unsaved copy
        </button>
        {status === "conflict" ? (
          <button
            type="button"
            className="touch-btn border border-border text-xs"
            onClick={() => void reloadCloud()}
            disabled={busy}
          >
            {busy ? "Keeping backup…" : "Download backup & reload cloud"}
          </button>
        ) : (
          <button
            type="button"
            className="touch-btn border border-border text-xs"
            onClick={() => void flushPendingSaves()}
            disabled={busy}
          >
            Retry saving
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
