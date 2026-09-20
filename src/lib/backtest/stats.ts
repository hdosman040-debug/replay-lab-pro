import type { JournalRecord } from "./types";

export interface Stats {
  total: number;
  trades: number;
  noTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalR: number;
  avgR: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  bySetup: Record<string, number>;
  byDirection: Record<string, number>;
  bySession: Record<string, number>;
  byNoTradeReason: Record<string, number>;
}

const empty = (): Stats => ({
  total: 0,
  trades: 0,
  noTrades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: 0,
  totalR: 0,
  avgR: 0,
  avgWin: 0,
  avgLoss: 0,
  largestWin: 0,
  largestLoss: 0,
  maxWinStreak: 0,
  maxLossStreak: 0,
  bySetup: {},
  byDirection: {},
  bySession: {},
  byNoTradeReason: {},
});

function bump(map: Record<string, number>, key: string) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Descriptive statistics over manually recorded records.
 * Research and self-review only — never a signal or a prediction.
 */
export function computeStats(records: JournalRecord[]): Stats {
  const s = empty();
  s.total = records.length;
  const chrono = [...records].sort((a, b) => a.createdAt - b.createdAt);
  let winStreak = 0;
  let lossStreak = 0;
  const winRs: number[] = [];
  const lossRs: number[] = [];

  for (const r of chrono) {
    bump(s.bySession, r.session);
    if (r.kind === "no_trade") {
      s.noTrades++;
      bump(s.byNoTradeReason, r.noTradeReason ?? "other");
      continue;
    }
    const t = r.trade;
    if (!t) continue;
    s.trades++;
    bump(s.bySetup, r.analysis.setup.setupType.trim() || "Unlabelled");
    bump(s.byDirection, t.direction);
    const R = t.resultR ?? 0;
    s.totalR += R;
    if (t.result === "win") {
      s.wins++;
      winRs.push(R);
      winStreak++;
      lossStreak = 0;
    } else if (t.result === "loss") {
      s.losses++;
      lossRs.push(R);
      lossStreak++;
      winStreak = 0;
    } else {
      s.breakeven++;
      winStreak = 0;
      lossStreak = 0;
    }
    s.maxWinStreak = Math.max(s.maxWinStreak, winStreak);
    s.maxLossStreak = Math.max(s.maxLossStreak, lossStreak);
    s.largestWin = Math.max(s.largestWin, R);
    s.largestLoss = Math.min(s.largestLoss, R);
  }

  const decided = s.wins + s.losses;
  s.winRate = decided ? (s.wins / decided) * 100 : 0;
  s.avgR = s.trades ? s.totalR / s.trades : 0;
  s.avgWin = winRs.length ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0;
  s.avgLoss = lossRs.length ? lossRs.reduce((a, b) => a + b, 0) / lossRs.length : 0;
  return s;
}
