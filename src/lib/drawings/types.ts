export type DrawingKind = "hline" | "ray" | "line" | "arrow" | "rect" | "text" | "marker";

export interface PricePoint {
  time: number; // UTC seconds
  price: number;
}

export interface Drawing {
  id: string;
  kind: DrawingKind;
  toolId: string;
  /** anchor points: hline: [p], ray/text/marker: [p], line/arrow/rect: [p1, p2] */
  points: PricePoint[];
  color: string;
  label?: string | undefined;
  extendRight?: boolean | undefined;
  /** UTC replay time when the drawing was created — for honest review later */
  createdAtReplayTime: number;
}

export type ToolGroup = "liquidity" | "structure" | "poi" | "pa" | "general";

export interface ToolDef {
  id: string;
  label: string;
  short: string;
  kind: DrawingKind;
  group: ToolGroup;
  color: string;
  defaultLabel?: string;
  extendRight?: boolean;
  /** marker direction hint */
  markerDir?: "up" | "down";
}

/* Colors are design tokens (CSS variables) so they follow the theme. */
const LIQ = "var(--liquidity)";
const STR = "var(--structure)";
const POI = "var(--poi)";
const PA = "var(--pa)";
const GEN = "var(--info)";

export const TOOLS: ToolDef[] = [
  // Liquidity — horizontal rays from the tap point
  { id: "bsl", label: "Buy-side liquidity", short: "BSL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "BSL", extendRight: true },
  { id: "ssl", label: "Sell-side liquidity", short: "SSL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "SSL", extendRight: true },
  { id: "pdh", label: "Previous day high", short: "PDH", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "PDH", extendRight: true },
  { id: "pdl", label: "Previous day low", short: "PDL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "PDL", extendRight: true },
  { id: "asia-h", label: "Asia high", short: "AsH", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "Asia H", extendRight: true },
  { id: "asia-l", label: "Asia low", short: "AsL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "Asia L", extendRight: true },
  { id: "ldn-h", label: "London high", short: "LdH", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "London H", extendRight: true },
  { id: "ldn-l", label: "London low", short: "LdL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "London L", extendRight: true },
  { id: "ses-h", label: "Session high", short: "SsH", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "Session H", extendRight: true },
  { id: "ses-l", label: "Session low", short: "SsL", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "Session L", extendRight: true },
  { id: "liq", label: "Custom liquidity", short: "LIQ", kind: "ray", group: "liquidity", color: LIQ, defaultLabel: "LIQ", extendRight: true },
  // Structure — labels at swing points
  { id: "hh", label: "Higher high", short: "HH", kind: "marker", group: "structure", color: STR, defaultLabel: "HH", markerDir: "up" },
  { id: "hl", label: "Higher low", short: "HL", kind: "marker", group: "structure", color: STR, defaultLabel: "HL", markerDir: "down" },
  { id: "lh", label: "Lower high", short: "LH", kind: "marker", group: "structure", color: STR, defaultLabel: "LH", markerDir: "up" },
  { id: "ll", label: "Lower low", short: "LL", kind: "marker", group: "structure", color: STR, defaultLabel: "LL", markerDir: "down" },
  { id: "mss", label: "Market structure shift", short: "MSS", kind: "line", group: "structure", color: PA, defaultLabel: "MSS" },
  // POI — zones
  { id: "fvg", label: "Fair value gap", short: "FVG", kind: "rect", group: "poi", color: POI, defaultLabel: "FVG", extendRight: true },
  { id: "ob", label: "Order block", short: "OB", kind: "rect", group: "poi", color: POI, defaultLabel: "OB", extendRight: true },
  { id: "poi", label: "Custom POI", short: "POI", kind: "rect", group: "poi", color: POI, defaultLabel: "POI", extendRight: true },
  // Price action
  { id: "sweep", label: "Liquidity sweep", short: "SWP", kind: "marker", group: "pa", color: PA, defaultLabel: "Sweep", markerDir: "up" },
  { id: "disp", label: "Displacement", short: "DSP", kind: "rect", group: "pa", color: PA, defaultLabel: "Displacement" },
  // General
  { id: "hline", label: "Horizontal line", short: "H", kind: "hline", group: "general", color: GEN },
  { id: "trend", label: "Trend line", short: "TL", kind: "line", group: "general", color: GEN },
  { id: "zone", label: "Rectangle / zone", short: "ZN", kind: "rect", group: "general", color: GEN },
  { id: "arrow", label: "Arrow", short: "AR", kind: "arrow", group: "general", color: GEN },
  { id: "text", label: "Text note", short: "T", kind: "text", group: "general", color: GEN, defaultLabel: "Note" },
];

export const TOOL_GROUPS: { id: ToolGroup; label: string }[] = [
  { id: "liquidity", label: "Liquidity" },
  { id: "structure", label: "Structure" },
  { id: "poi", label: "POI" },
  { id: "pa", label: "Price action" },
  { id: "general", label: "General" },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function isTwoPoint(kind: DrawingKind) {
  return kind === "line" || kind === "arrow" || kind === "rect";
}
