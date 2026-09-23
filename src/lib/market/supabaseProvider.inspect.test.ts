import { describe, it } from "vitest";
import { supabaseMarketDataProvider } from "./supabaseProvider";

describe("Inspect real Supabase US30 M1 data", () => {
  it("prints the first real candles", async () => {
    const from = Date.UTC(2016, 9, 1, 0, 0) / 1000;
    const to = Date.UTC(2016, 10, 1, 0, 0) / 1000;

    const candles = await supabaseMarketDataProvider.getCandles({
      symbol: "US30",
      timeframe: "M1",
      from,
      to,
    });

    console.log("\n===== REAL SUPABASE DATA =====");
    console.log("Candle count:", candles.length);

    if (candles.length > 0) {
      console.log("First 10 candles:");
      console.log(candles.slice(0, 10));

      console.log("\nFirst timestamp UTC:");
      console.log(new Date(candles[0]!.time * 1000).toISOString());

      console.log("\nLast timestamp UTC:");
      console.log(
        new Date(candles[candles.length - 1]!.time * 1000).toISOString(),
      );
    }

    console.log("==============================\n");
  });
});
