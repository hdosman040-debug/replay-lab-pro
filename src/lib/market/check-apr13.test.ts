import { describe, it, expect } from "vitest";
import { supabaseMarketDataProvider } from "./supabaseProvider";

describe("April 13 2020 real provider diagnostic", () => {
  it(
    "loads April 13 through the actual Supabase provider",
    async () => {
      const from = Date.UTC(2020, 3, 13, 0, 0, 0) / 1000;
      const to = Date.UTC(2020, 3, 14, 0, 0, 0) / 1000;

      console.log("");
      console.log("==============================================");
      console.log(" ACTUAL SUPABASE PROVIDER — APRIL 13");
      console.log("==============================================");
      console.log("FROM UTC:", new Date(from * 1000).toISOString());
      console.log("TO UTC  :", new Date(to * 1000).toISOString());

      const candles = await supabaseMarketDataProvider.getCandles({
        symbol: "US30",
        timeframe: "M1",
        from,
        to,
      });

      console.log("");
      console.log("M1 COUNT:", candles.length);

      if (candles.length > 0) {
        console.log("");
        console.log("FIRST 5:");

        for (const c of candles.slice(0, 5)) {
          console.log({
            ...c,
            iso: new Date(c.time * 1000).toISOString(),
          });
        }

        console.log("");
        console.log("LAST 5:");

        for (const c of candles.slice(-5)) {
          console.log({
            ...c,
            iso: new Date(c.time * 1000).toISOString(),
          });
        }

        console.log("");
        console.log(
          "FIRST UNIX:",
          candles[0].time,
          "=>",
          new Date(candles[0].time * 1000).toISOString(),
        );

        console.log(
          "LAST UNIX:",
          candles[candles.length - 1].time,
          "=>",
          new Date(candles[candles.length - 1].time * 1000).toISOString(),
        );
      }

      console.log("");
      console.log("==============================================");

      expect(candles.length).toBeGreaterThan(0);
    },
    30000,
  );
});
