import { describe, expect, it } from "vitest";
import { supabaseMarketDataProvider } from "./supabaseProvider";

describe("Supabase US30 available data", () => {
  it(
    "inspects the available dataset range",
    async () => {
      const bounds = await supabaseMarketDataProvider.getBounds("US30", "M1");

      console.log("\n===== SUPABASE DATASET RANGE =====");

      if (!bounds) {
        console.log("No bounds returned");
        throw new Error("Supabase returned no US30 M1 bounds");
      }

      const earliest = new Date(bounds.earliest * 1000);
      const latest = new Date(bounds.latest * 1000);

      console.log("Earliest UTC:", earliest.toISOString());
      console.log("Latest UTC:", latest.toISOString());
      console.log(
        "Approx years covered:",
        latest.getUTCFullYear() - earliest.getUTCFullYear() + 1,
      );

      console.log("=================================\n");

      expect(bounds.earliest).toBeLessThan(bounds.latest);
    },
    30000,
  );
});
