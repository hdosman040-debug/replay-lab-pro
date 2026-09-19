import { mockMarketDataProvider } from "./mockProvider";
import type { MarketDataProvider } from "./provider";

/**
 * Single access point for market data. Swap the implementation here
 * (e.g. SupabaseMarketDataProvider) without touching the replay engine or UI.
 */
let provider: MarketDataProvider = mockMarketDataProvider;

export function getMarketDataProvider(): MarketDataProvider {
  return provider;
}

export function setMarketDataProvider(p: MarketDataProvider) {
  provider = p;
}

export * from "./types";
export type { MarketDataProvider } from "./provider";
