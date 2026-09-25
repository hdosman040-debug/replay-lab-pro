import { useEffect, useState } from "react";
import { getSnapshot } from "@/lib/snapshots/snapshotStore";

interface TradeSnapshotsProps {
  beforeSnapshotId: string | undefined;
  afterSnapshotId: string | undefined;
}

interface SnapshotImageProps {
  id: string | undefined;
  label: string;
}

function SnapshotImage({ id, label }: SnapshotImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!id) {
      setSrc(null);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    void getSnapshot(id)
      .then((snapshot) => {
        if (cancelled) return;

        if (!snapshot) {
          setError(true);
          setLoading(false);
          return;
        }

        objectUrl = URL.createObjectURL(snapshot.blob);
        setSrc(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);

  if (!id) return null;

  return (
    <div className="space-y-1.5">
      <div className="eyebrow">{label}</div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-md border border-border bg-surface-2 text-xs text-muted-foreground">
          Loading snapshot…
        </div>
      ) : error || !src ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-border bg-surface-2 px-3 text-center text-xs text-muted-foreground">
          Snapshot unavailable on this device/browser.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-black">
          <img
            src={src}
            alt={`${label} chart snapshot`}
            className="block h-auto w-full"
          />
        </div>
      )}
    </div>
  );
}

export function TradeSnapshots({
  beforeSnapshotId,
  afterSnapshotId,
}: TradeSnapshotsProps) {
  if (!beforeSnapshotId && !afterSnapshotId) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="eyebrow">Chart Review</h3>

      <div className="space-y-4">
        <SnapshotImage id={beforeSnapshotId} label="Before Trade" />
        <SnapshotImage id={afterSnapshotId} label="After Trade" />
      </div>
    </section>
  );
}
