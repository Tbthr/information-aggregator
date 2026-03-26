import { describe, expect, test, mock } from "bun:test";

// Set up mocks BEFORE importing the module under test
mock.module("../../pipeline/run-collect-job", () => ({
  runCollectJob: mock(async () => ({
    sourceEvents: [
      {
        sourceId: "src-1",
        status: "success" as const,
        itemCount: 10,
        latencyMs: 1000,
        error: undefined,
      },
      {
        sourceId: "src-2",
        status: "failure" as const,
        itemCount: 0,
        latencyMs: 500,
        error: "Connection refused",
      },
    ],
    counts: {
      raw: 100,
      normalized: 90,
      afterExactDedup: 80,
      afterNearDedup: 75,
      archivedNew: 70,
      archivedUpdated: 5,
    },
    archived: { newCount: 70, updateCount: 5 },
    failures: [],
    candidates: [],
  })),
}));

// Import after mocks are set up
import { runCollection, type RunCollectionResult } from "./run-collection";

describe("runCollection", () => {
  test("returns correct RunCollectionResult structure", async () => {
    const result: RunCollectionResult = await runCollection();

    expect(result.triggered).toBe(true);
    expect(result.sourceEvents.length).toBe(2);
    expect(result.counts.raw).toBe(100);
    expect(result.counts.normalized).toBe(90);
    expect(result.counts.afterExactDedup).toBe(80);
    expect(result.counts.afterNearDedup).toBe(75);
    expect(result.counts.archivedNew).toBe(70);
    expect(result.counts.archivedUpdated).toBe(5);
  });

  test("maps source events correctly", async () => {
    const result = await runCollection();

    const successEvent = result.sourceEvents.find((e) => e.status === "success");
    expect(successEvent?.sourceId).toBe("src-1");
    expect(successEvent?.itemCount).toBe(10);
    expect(successEvent?.latencyMs).toBe(1000);
    expect(successEvent?.error).toBeUndefined();

    const failureEvent = result.sourceEvents.find((e) => e.status === "failure");
    expect(failureEvent?.sourceId).toBe("src-2");
    expect(failureEvent?.itemCount).toBe(0);
    expect(failureEvent?.error).toBe("Connection refused");
  });

  test("maps counts correctly", async () => {
    const result = await runCollection();

    expect(result.counts.raw).toBe(100);
    expect(result.counts.normalized).toBe(90);
    expect(result.counts.afterExactDedup).toBe(80);
    expect(result.counts.afterNearDedup).toBe(75);
    expect(result.counts.archivedNew).toBe(70);
    expect(result.counts.archivedUpdated).toBe(5);
  });
});

describe("RunCounts type structure", () => {
  test("counts has correct shape", () => {
    const counts: RunCollectionResult["counts"] = {
      raw: 100,
      normalized: 90,
      afterExactDedup: 80,
      afterNearDedup: 75,
      archivedNew: 70,
      archivedUpdated: 5,
    };

    expect(counts.raw).toBe(100);
    expect(counts.normalized).toBe(90);
    expect(counts.afterExactDedup).toBe(80);
    expect(counts.afterNearDedup).toBe(75);
    expect(counts.archivedNew).toBe(70);
    expect(counts.archivedUpdated).toBe(5);
  });

  test("archived counts are optional", () => {
    const counts: RunCollectionResult["counts"] = {
      raw: 100,
      normalized: 90,
      afterExactDedup: 80,
      afterNearDedup: 75,
    };

    expect(counts.archivedNew).toBeUndefined();
    expect(counts.archivedUpdated).toBeUndefined();
  });
});

describe("SourceEvent type structure", () => {
  test("success event has correct shape", () => {
    const event: RunCollectionResult["sourceEvents"][number] = {
      sourceId: "src-1",
      status: "success",
      itemCount: 10,
      latencyMs: 1500,
      error: undefined,
    };

    expect(event.status).toBe("success");
    expect(event.itemCount).toBe(10);
    expect(event.latencyMs).toBe(1500);
    expect(event.error).toBeUndefined();
  });

  test("failure event has correct shape", () => {
    const event: RunCollectionResult["sourceEvents"][number] = {
      sourceId: "src-2",
      status: "failure",
      itemCount: 0,
      latencyMs: 500,
      error: "Connection refused",
    };

    expect(event.status).toBe("failure");
    expect(event.itemCount).toBe(0);
    expect(event.error).toBe("Connection refused");
  });

  test("zero-items event has correct shape", () => {
    const event: RunCollectionResult["sourceEvents"][number] = {
      sourceId: "src-3",
      status: "zero-items",
      itemCount: 0,
      latencyMs: 2000,
      error: undefined,
    };

    expect(event.status).toBe("zero-items");
    expect(event.itemCount).toBe(0);
  });
});
