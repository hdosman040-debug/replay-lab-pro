import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const supabase = createClient(url, key);

describe("Inspect Supabase US30 M1 Storage", () => {
  it(
    "lists years and files",
    async () => {
      const { data: years, error: yearError } = await supabase.storage
        .from("market-data-file")
        .list("US30/M1", {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });

      if (yearError) {
        throw new Error(yearError.message);
      }

      console.log("\n===== SUPABASE YEARS =====");
      console.log((years ?? []).map((x) => x.name).join(", "));

      const yearNames = (years ?? [])
        .map((x) => x.name)
        .filter((name) => /^\d{4}$/.test(name));

      for (const year of yearNames) {
        const { data: files, error } = await supabase.storage
          .from("market-data-file")
          .list(`US30/M1/${year}`, {
            limit: 1000,
            sortBy: { column: "name", order: "asc" },
          });

        if (error) {
          throw new Error(`${year}: ${error.message}`);
        }

        console.log(
          `${year}:`,
          (files ?? []).map((x) => x.name).join(", "),
        );
      }

      console.log("=========================\n");
    },
    30000,
  );
});
