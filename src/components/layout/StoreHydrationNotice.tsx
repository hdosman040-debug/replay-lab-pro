import type { StoreHydrationState } from "@/lib/store/hydrate";

export function StoreHydrationNotice({ state }: { state: StoreHydrationState }) {
  if (state.status === "ready") return null;

  if (state.status === "loading") {
    return <p role="status" className="p-4 text-sm text-muted-foreground">Loading your saved workspace…</p>;
  }

  return (
    <div role="alert" className="m-4 space-y-3 rounded-lg border border-red-500/50 bg-surface p-4 text-sm">
      <p className="font-semibold">Could not load your saved workspace.</p>
      <p className="break-words text-xs text-muted-foreground">{state.error}</p>
      <button type="button" className="touch-btn border border-border text-sm" onClick={state.retry}>
        Retry loading
      </button>
    </div>
  );
}
