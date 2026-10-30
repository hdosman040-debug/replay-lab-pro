import { resultRAt, type JournalRecord, type TradePlan } from "./types";
import { uniqueJournalExecutions } from "./uniqueJournalExecutions";

export const DEMO_STARTING_BALANCE = 1000;
export const DEMO_RISK_PER_TRADE = 25;
export const US30_POINT_VALUE_PER_LOT = 1;

/** Propanium ONE-STEP profile currently listed for the 2.5K challenge. */
export const PROPANIUM_ONE_STEP_2500 = {
  startingBalance: 2500,
  profitTargetPercent: 9,
  dailyDrawdownPercent: 4,
  maximumDrawdownPercent: 7,
  dailyResetTimezone: "UTC",
} as const;

export function tradeRiskDistance(trade: Pick<TradePlan, "entry" | "stopLoss">) {
  return Math.abs(trade.entry - trade.stopLoss);
}

export function calculateLotSize(
  trade: Pick<TradePlan, "entry" | "stopLoss">,
  riskAmount = DEMO_RISK_PER_TRADE,
  pointValuePerLot = US30_POINT_VALUE_PER_LOT,
) {
  const distance = tradeRiskDistance(trade);

  if (distance <= 0 || pointValuePerLot <= 0) return 0;

  return riskAmount / (distance * pointValuePerLot);
}

export function calculateTradePnl(
  trade: Pick<TradePlan, "resultR">,
  riskAmount = DEMO_RISK_PER_TRADE,
) {
  return (trade.resultR ?? 0) * riskAmount;
}

export interface AccountPoint {
  trade: number;
  balance: number;
  pnl: number;
  resultR: number;
}

export interface DemoAccount {
  startingBalance: number;
  riskPerTrade: number;
  riskPercent: number;
  balance: number;
  totalPnl: number;
  returnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  points: AccountPoint[];
}

export function computeDemoAccount(records: JournalRecord[]): DemoAccount {
  const trades = uniqueJournalExecutions(records)
    .filter((record) => record.kind === "trade" && record.trade)
    .map((record) => record.trade!)
    .filter(
      (trade) =>
        trade.status === "closed" &&
        (trade.result === "win" || trade.result === "loss" || trade.result === "breakeven"),
    )
    .map((trade) => {
      const resultR =
        typeof trade.resultR === "number" && Number.isFinite(trade.resultR)
          ? trade.resultR
          : typeof trade.exitPrice === "number" &&
              Number.isFinite(trade.exitPrice) &&
              Number.isFinite(trade.entry) &&
              Number.isFinite(trade.stopLoss) &&
              Math.abs(trade.entry - trade.stopLoss) > 0
            ? resultRAt(trade, trade.exitPrice)
            : null;

      return resultR === null ? null : { ...trade, resultR };
    })
    .filter((trade): trade is TradePlan & { resultR: number } => trade !== null)
    .sort((a, b) => (a.closedAt ?? a.plannedAt) - (b.closedAt ?? b.plannedAt));

  let balance = DEMO_STARTING_BALANCE;
  let peak = balance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  const points: AccountPoint[] = [
    {
      trade: 0,
      balance: DEMO_STARTING_BALANCE,
      pnl: 0,
      resultR: 0,
    },
  ];

  for (const [index, trade] of trades.entries()) {
    const pnl = calculateTradePnl(trade);
    balance += pnl;

    peak = Math.max(peak, balance);

    const drawdown = Math.max(0, peak - balance);
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);

    points.push({
      trade: index + 1,
      balance,
      pnl,
      resultR: trade.resultR ?? 0,
    });
  }

  const totalPnl = balance - DEMO_STARTING_BALANCE;
  const returnPercent = (totalPnl / DEMO_STARTING_BALANCE) * 100;

  return {
    startingBalance: DEMO_STARTING_BALANCE,
    riskPerTrade: DEMO_RISK_PER_TRADE,
    riskPercent: (DEMO_RISK_PER_TRADE / DEMO_STARTING_BALANCE) * 100,
    balance,
    totalPnl,
    returnPercent,
    maxDrawdown,
    maxDrawdownPercent,
    points,
  };
}

export type ChallengeState = "not_started" | "active" | "passed" | "breached";

export interface PropaniumChallengeAccount {
  startingBalance: number;
  balance: number;
  totalPnl: number;
  returnPercent: number;
  targetBalance: number;
  targetProgressPercent: number;
  maximumDrawdownFloor: number;
  dailyDrawdownFloor: number;
  dailyLossLimit: number;
  dailyLossUsed: number;
  riskPercent: number;
  state: ChallengeState;
  breachReason: "daily_drawdown" | "maximum_drawdown" | null;
  tradesProcessed: number;
}

/**
 * Replays journal outcomes through the Propanium 2.5K ONE-STEP limits.
 * Risk is compounded from current balance. Daily loss uses the UTC day-open
 * balance and each trade's recorded maximum adverse R when available.
 */
export function computePropaniumOneStepAccount(
  records: JournalRecord[],
  riskPercent = 1,
  startedAt: number | null = null,
): PropaniumChallengeAccount {
  const safeRiskPercent = Number.isFinite(riskPercent)
    ? Math.min(10, Math.max(0.1, riskPercent))
    : 1;
  const eligibleRecords = startedAt === null ? [] : records.filter((record) => record.createdAt >= startedAt);
  const trades = uniqueJournalExecutions(eligibleRecords)
    .filter((record) => record.kind === "trade" && record.trade)
    .map((record) => record.trade!)
    .filter(
      (trade) =>
        trade.status === "closed" &&
        (trade.result === "win" || trade.result === "loss" || trade.result === "breakeven"),
    )
    .map((trade) => {
      const resultR =
        typeof trade.resultR === "number" && Number.isFinite(trade.resultR)
          ? trade.resultR
          : typeof trade.exitPrice === "number" && Number.isFinite(trade.exitPrice)
            ? resultRAt(trade, trade.exitPrice)
            : null;
      return resultR === null || !Number.isFinite(resultR) ? null : { ...trade, resultR };
    })
    .filter((trade): trade is TradePlan & { resultR: number } => trade !== null)
    .sort((a, b) => (a.closedAt ?? a.plannedAt) - (b.closedAt ?? b.plannedAt));

  const { startingBalance, profitTargetPercent, dailyDrawdownPercent, maximumDrawdownPercent } =
    PROPANIUM_ONE_STEP_2500;
  const targetBalance = startingBalance * (1 + profitTargetPercent / 100);
  const maximumDrawdownFloor = startingBalance * (1 - maximumDrawdownPercent / 100);
  let balance = startingBalance;
  let dayKey = "";
  let dayStartBalance = startingBalance;
  let dailyDrawdownFloor = dayStartBalance * (1 - dailyDrawdownPercent / 100);
  let dailyLossLimit = dayStartBalance * (dailyDrawdownPercent / 100);
  let dailyLowEquity = dayStartBalance;
  let state: ChallengeState = startedAt === null ? "not_started" : "active";
  let breachReason: PropaniumChallengeAccount["breachReason"] = null;
  let tradesProcessed = 0;

  for (const trade of trades) {
    if (state !== "active") break;
    const closeTime = trade.closedAt ?? trade.plannedAt;
    const nextDayKey = new Date(closeTime * 1000).toISOString().slice(0, 10);
    if (nextDayKey !== dayKey) {
      dayKey = nextDayKey;
      dayStartBalance = balance;
      dailyDrawdownFloor = dayStartBalance * (1 - dailyDrawdownPercent / 100);
      dailyLossLimit = dayStartBalance * (dailyDrawdownPercent / 100);
      dailyLowEquity = balance;
    }

    const riskAmount = balance * (safeRiskPercent / 100);
    const adverseR = Math.abs(
      typeof trade.maxAdverseR === "number" && Number.isFinite(trade.maxAdverseR)
        ? trade.maxAdverseR
        : Math.min(0, trade.resultR),
    );
    dailyLowEquity = Math.min(dailyLowEquity, balance - riskAmount * adverseR);
    if (dailyLowEquity <= dailyDrawdownFloor) {
      state = "breached";
      breachReason = "daily_drawdown";
      tradesProcessed++;
      break;
    }
    if (balance - riskAmount * adverseR <= maximumDrawdownFloor) {
      state = "breached";
      breachReason = "maximum_drawdown";
      tradesProcessed++;
      break;
    }

    balance += trade.resultR * riskAmount;
    dailyLowEquity = Math.min(dailyLowEquity, balance);
    tradesProcessed++;
    if (balance <= maximumDrawdownFloor) {
      state = "breached";
      breachReason = "maximum_drawdown";
    } else if (balance >= targetBalance) {
      state = "passed";
    }
  }

  const totalPnl = balance - startingBalance;
  return {
    startingBalance,
    balance,
    totalPnl,
    returnPercent: (totalPnl / startingBalance) * 100,
    targetBalance,
    targetProgressPercent: Math.max(0, Math.min(100, (totalPnl / (targetBalance - startingBalance)) * 100)),
    maximumDrawdownFloor,
    dailyDrawdownFloor,
    dailyLossLimit,
    dailyLossUsed: Math.max(0, dayStartBalance - dailyLowEquity),
    riskPercent: safeRiskPercent,
    state,
    breachReason,
    tradesProcessed,
  };
}
