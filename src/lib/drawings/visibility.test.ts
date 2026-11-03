import { describe, expect, it } from "vitest";
import { visibleDrawingsAt } from "./types";

describe("drawing replay visibility", () => {
  it("hides drawings created after the replay clock", () => {
    const drawings = [
      { id: "before", createdAtReplayTime: 100 },
      { id: "exact", createdAtReplayTime: 200 },
      { id: "future", createdAtReplayTime: 300 },
    ];

    expect(visibleDrawingsAt(drawings, 200).map((d) => d.id)).toEqual([
      "before",
      "exact",
    ]);
  });

  it("does not mutate the stored drawing list", () => {
    const drawings = [
      { id: "future", createdAtReplayTime: 300 },
      { id: "before", createdAtReplayTime: 100 },
    ];

    visibleDrawingsAt(drawings, 200);

    expect(drawings.map((d) => d.id)).toEqual(["future", "before"]);
  });
});
