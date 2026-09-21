import { useState } from "react";

import { TOOL_GROUPS, TOOLS, type ToolGroup } from "@/lib/drawings/types";

export function ToolStrip({
  activeTool,
  onPick,
  onUndo,
  onRedo,
  onDeleteSelected,
  hasSelection,
}: {
  activeTool: string | null;
  onPick: (id: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}) {
  const [group, setGroup] = useState<ToolGroup>("liquidity");
  const tools = TOOLS.filter((t) => t.group === group);
  return (
    <div className="shrink-0 border-t border-border bg-surface">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 pt-2">
        {TOOL_GROUPS.map((g) => (
          <button key={g.id} type="button" className="chip shrink-0" data-active={group === g.id} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-2 py-2">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            className="chip num shrink-0"
            data-active={activeTool === t.id}
            style={{ color: activeTool === t.id ? undefined : t.color }}
            onClick={() => onPick(activeTool === t.id ? null : t.id)}
          >
            {t.short}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <button type="button" className="chip shrink-0" onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="chip shrink-0" onClick={onRedo}>
          Redo
        </button>
        <button
          type="button"
          className="chip shrink-0"
          disabled={!hasSelection}
          style={{ color: hasSelection ? "var(--bear)" : undefined, opacity: hasSelection ? 1 : 0.4 }}
          onClick={onDeleteSelected}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
