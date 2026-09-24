import { describe, expect, it } from "vitest";
import { supabaseMarketDataProvider } from "./supabaseProvider";

describe("Supabase real US30 bounds", () => {
  it(
    "returns real M1 bounds",
    async () => {
      const bounds = await supabaseMarketDataProvider.getBounds("US30", "M1");

      console.log("\n===== REAL SUPABASE BOUNDS =====");
      console.log("Earliest:", bounds?.earliest);
      console.log(
        "Earliest UTC:",
        bounds ? new Date(bounds.earliest * 1000).toISOString() : null,
      );
      console.log("Latest:", bounds?.latest);
      console.log(
        "Latest UTC:",
        bounds ? new Date(bounds.latest * 1000).toISOString() : null,
      );
      console.log("===============================\n");

      expect(bounds).not.toBeNull();
      expect(bounds!.earliest).toBeLessThan(bounds!.latest);
    },
    30000,
  );
});
