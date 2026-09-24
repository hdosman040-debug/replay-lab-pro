import { mockMarketDataProvider } from "./mockProvider";
import { supabaseMarketDataProvider } from "./supabaseProvider";
import type { MarketDataProvider } from "./provider";

export type { MarketDataProvider } from "./provider";

let provider: MarketDataProvider = mockMarketDataProvider;

export function getMarketDataProvider(): MarketDataProvider {
  return provider;
}

export function setMarketDataProvider(p: MarketDataProvider) {
  provider = p;
}

export function setMarketDataProviderById(id: "mock" | "supabase") {
  provider = id === "supabase"
    ? supabaseMarketDataProvider
    : mockMarketDataProvider;
}

export function useSupabaseMarketDataProvider() {
  provider = supabaseMarketDataProvider;
}

export function useMockMarketDataProvider() {
  provider = mockMarketDataProvider;
}

export * from "./types";
