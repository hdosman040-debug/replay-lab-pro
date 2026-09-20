import type { ReactNode } from "react";

/** Mobile bottom sheet. Tap the scrim or Close to dismiss. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="safe-bottom relative max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-3 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" className="chip" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
