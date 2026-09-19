import type { Drawing } from "@/lib/drawings/types";
import type { Symbol, Timeframe } from "@/lib/market/types";

export type Bias = "bullish" | "bearish" | "neutral" | "";
export type Direction = "long" | "short";
export type PremiumDiscount = "premium" | "discount" | "equilibrium" | "";

/** Manual ICT analysis — every field is typed by the trader. Nothing is auto-detected. */
export interface Analysis {
  htfBias: Bias;
  currentBias: Bias;
  dol: string;
  erl: string;
  irl: string;
  premiumDiscount: PremiumDiscount;
  liquidity: {
    bsl: string;
    ssl: string;
    pdh: string;
    pdl: string;
    asiaHigh: string;
    asiaLow: string;
    londonHigh: string;
    londonLow: string;
    sessionHigh: string;
    sessionLow: string;
  };
  structure: { hh: string; hl: string; lh: string; ll: string; mss: string };
  setup: {
    sweep: string;
    displacement: string;
    fvg: string;
    ob: string;
    setupType: string;
    direction: Direction | "";
  };
  notes: string;
  confidence: number; // 1-5
  reasonForTrade: string;
  reasonForNoTrade: string;
}

export const emptyAnalysis = (): Analysis => ({
  htfBias: "",
  currentBias: "",
  dol: "",
  erl: "",
  irl: "",
  premiumDiscount: "",
  liquidity: {
    bsl: "",
    ssl: "",
    pdh: "",
    pdl: "",
    asiaHigh: "",
    asiaLow: "",
    londonHigh: "",
    londonLow: "",
    sessionHigh: "",
    sessionLow: "",
  },
  structure: { hh: "", hl: "", lh: "", ll: "", mss: "" },
  setup: { sweep: "", displacement: "", fvg: "", ob: "", setupType: "", direction: "" },
  notes: "",
  confidence: 3,
  reasonForTrade: "",
  reasonForNoTrade: "",
});

export type TradeStatus = "planned" | "active" | "closed";
export type TradeResult = "win" | "loss" | "breakeven";

export interface TradePlan {
  id: string;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: TradeStatus;
  plannedAt: number; // replay time
  activatedAt?: number;
  closedAt?: number;
  /** what the replay observed after activation (informational only) */
  observed?: { hit: "tp" | "sl"; at: number } | null;
  result?: TradeResult;
  exitPrice?: number;
  resultR?: number;
  maxFavorableR?: number;
  maxAdverseR?: number;
}

export function riskDistance(t: Pick<TradePlan, "entry" | "stopLoss">) {
  return Math.abs(t.entry - t.stopLoss);
}
export function rewardDistance(t: Pick<TradePlan, "entry" | "takeProfit">) {
  return Math.abs(t.takeProfit - t.entry);
}
export function rrRatio(t: Pick<TradePlan, "entry" | "stopLoss" | "takeProfit">) {
  const r = riskDistance(t);
  return r === 0 ? 0 : rewardDistance(t) / r;
}
export function resultRAt(t: Pick<TradePlan, "entry" | "stopLoss" | "direction">, exit: number) {
  const r = riskDistance(t);
  if (r === 0) return 0;
  const pnl = t.direction === "long" ? exit - t.entry : t.entry - exit;
  return pnl / r;
}

export const WORKFLOW_STEPS = [
  { id: "context", label: "Analyze market context" },
  { id: "liquidity", label: "Mark liquidity" },
  { id: "dol", label: "Identify DOL" },
  { id: "poi", label: "Mark POIs" },
  { id: "wait", label: "Wait for price to develop" },
  { id: "sweep", label: "Mark sweep" },
  { id: "displacement", label: "Identify displacement" },
  { id: "mss", label: "Confirm MSS" },
  { id: "plan", label: "Plan entry, SL, TP" },
  { id: "replay", label: "Replay forward" },
  { id: "record", label: "Record outcome" },
  { id: "journal", label: "Journal" },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]["id"];

export interface ReplaySession {
  id: string;
  name: string;
  symbol: Symbol;
  timeframe: Timeframe;
  startTime: number; // UTC seconds
  currentTime: number; // UTC seconds — the replay clock
  speed: number; // candles per second
  drawings: Drawing[];
  analysis: Analysis;
  trade: TradePlan | null;
  workflowDone: WorkflowStepId[];
  createdAt: number; // wall clock ms
  updatedAt: number;
}

export type NoTradeReason =
  | "no_setup"
  | "setup_invalidated"
  | "missed_setup"
  | "rules_not_met"
  | "poor_conditions"
  | "waiting_confirmation"
  | "other";

export const NO_TRADE_REASONS: { id: NoTradeReason; label: string }[] = [
  { id: "no_setup", label: "No trade" },
  { id: "setup_invalidated", label: "Setup invalidated" },
  { id: "missed_setup", label: "Missed setup" },
  { id: "rules_not_met", label: "Did not meet rules" },
  { id: "poor_conditions", label: "Poor conditions" },
  { id: "waiting_confirmation", label: "Waiting for confirmation" },
  { id: "other", label: "Other reason" },
];

export interface JournalRecord {
  id: string;
  kind: "trade" | "no_trade";
  sessionId: string;
  symbol: Symbol;
  timeframe: Timeframe;
  /** replay time of the decision (UTC seconds) */
  decisionTime: number;
  session: string; // Asia / London / New York
  analysis: Analysis;
  trade: TradePlan | null;
  noTradeReason?: NoTradeReason;
  mistakes: string;
  notes: string;
  /** chart state snapshot for later review */
  drawings: Drawing[];
  createdAt: number;
}
