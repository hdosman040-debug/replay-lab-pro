import type { JournalRecord, TradePlan } from "./types";

export const DEMO_STARTING_BALANCE = 1000;
export const DEMO_RISK_PER_TRADE = 25;
export const US30_POINT_VALUE_PER_LOT = 1;

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
  const trades = records
    .filter((record) => record.kind === "trade" && record.trade)
    .map((record) => record.trade!)
    .filter((trade) => trade.resultR !== undefined)
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
