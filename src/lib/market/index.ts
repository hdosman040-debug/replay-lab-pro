import { supabaseMarketDataProvider } from "./supabaseProvider";
import type { MarketDataProvider } from "./provider";

export type { MarketDataProvider } from "./provider";

/**
 * Production market-data provider.
 *
 * Replay and workspace market data must always come from
 * the real Supabase historical dataset.
 *
 * Mock data is intentionally not exposed through the
 * production market-data API.
 */
export function getMarketDataProvider(): MarketDataProvider {
  return supabaseMarketDataProvider;
}

export * from "./types";
