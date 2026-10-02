import { describe, it, expect } from "vitest";
import { getMarketDataProvider } from "@/lib/market";
import { loadReplayView } from "./engine";

describe("April 13 2020 replay engine diagnostic", () => {
  it(
    "checks M1 and M5 through the actual replay engine",
    async () => {
      const provider = getMarketDataProvider();

      const horizons = [
        Date.UTC(2020, 3, 13, 0, 0, 0) / 1000,
        Date.UTC(2020, 3, 13, 1, 30, 0) / 1000,
        Date.UTC(2020, 3, 13, 1, 31, 0) / 1000,
        Date.UTC(2020, 3, 13, 5, 0, 0) / 1000,
        Date.UTC(2020, 3, 13, 12, 0, 0) / 1000,
        Date.UTC(2020, 3, 13, 22, 59, 0) / 1000,
      ];

      console.log("");
      console.log("====================================================");
      console.log(" APRIL 13 2020 — REPLAY ENGINE DIAGNOSTIC");
      console.log(" PROVIDER:", provider.id);
      console.log("====================================================");

      for (const horizon of horizons) {
        console.log("");
        console.log("----------------------------------------------------");
        console.log("HORIZON:", new Date(horizon * 1000).toISOString());

        for (const tf of ["M1", "M5"] as const) {
          const view = await loadReplayView(
            provider,
            "US30",
            tf,
            horizon,
            300,
          );

          console.log("");
          console.log("TIMEFRAME:", tf);
          console.log("completed:", view.completed.length);
          console.log(
            "forming:",
            view.forming
              ? {
                  ...view.forming,
                  iso: new Date(view.forming.time * 1000).toISOString(),
                }
              : null,
          );
          console.log(
            "last completed:",
            view.completed.length
              ? {
                  ...view.completed[view.completed.length - 1]!,
                  iso: new Date(
                    view.completed[view.completed.length - 1]!.time * 1000,
                  ).toISOString(),
                }
              : null,
          );
          console.log(
            "loadedFrom:",
            new Date(view.loadedFrom * 1000).toISOString(),
          );
        }
      }

      console.log("");
      console.log("====================================================");

      expect(true).toBe(true);
    },
    60000,
  );
});
