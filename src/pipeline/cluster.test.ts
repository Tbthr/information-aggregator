import { describe, expect, test } from "bun:test";
import { buildClusters } from "./cluster";

describe("buildClusters", () => {
  test("creates clusters from ranked candidate items", () => {
    const clusters = buildClusters(
      [
        { id: "1", normalizedTitle: "openai released a new model", finalScore: 0.9 },
        { id: "2", normalizedTitle: "openai releases new model", finalScore: 0.8 },
      ],
      "run-1",
    );
    expect(clusters.length).toBe(1);
  });
});
