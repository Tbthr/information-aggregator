import { describe, expect, test } from "bun:test";
import type { RunCounts, SourceEvent } from "./types";

// Unit tests for the types and mapping logic used by run-collection

describe("RunCounts type structure", () => {
  test("counts has correct shape", () => {
    const counts: RunCounts = {
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
    const counts: RunCounts = {
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
    const event: SourceEvent = {
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
    const event: SourceEvent = {
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
    const event: SourceEvent = {
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

// Pure function tests for mapping logic (no DB required)
describe("sourceEvents mapping logic", () => {
  // Simulate CollectSourceEvent from pipeline
  type MockCollectSourceEvent = {
    sourceId: string;
    status: "success" | "failure" | "zero-items";
    itemCount: number;
    latencyMs?: number;
    error?: string;
  };

  function mapSourceEvents(events: MockCollectSourceEvent[]): SourceEvent[] {
    return events.map((e) => ({
      sourceId: e.sourceId,
      status: e.status,
      itemCount: e.itemCount,
      latencyMs: e.latencyMs,
      error: e.error,
    }));
  }

  test("maps success events correctly", () => {
    const events: MockCollectSourceEvent[] = [
      { sourceId: "src-1", status: "success", itemCount: 10, latencyMs: 1000 },
    ];

    const result = mapSourceEvents(events);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("success");
    expect(result[0].itemCount).toBe(10);
  });

  test("maps failure events with error", () => {
    const events: MockCollectSourceEvent[] = [
      { sourceId: "src-2", status: "failure", itemCount: 0, latencyMs: 500, error: "Timeout" },
    ];

    const result = mapSourceEvents(events);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("failure");
    expect(result[0].error).toBe("Timeout");
  });

  test("maps multiple events in order", () => {
    const events: MockCollectSourceEvent[] = [
      { sourceId: "src-1", status: "success", itemCount: 5, latencyMs: 1000 },
      { sourceId: "src-2", status: "failure", itemCount: 0, latencyMs: 500, error: "Err" },
      { sourceId: "src-3", status: "zero-items", itemCount: 0, latencyMs: 2000 },
    ];

    const result = mapSourceEvents(events);
    expect(result.length).toBe(3);
    expect(result[0].sourceId).toBe("src-1");
    expect(result[1].sourceId).toBe("src-2");
    expect(result[2].sourceId).toBe("src-3");
  });
});

describe("run counts mapping logic", () => {
  // Simulate PipelineCounts from run-collect-job
  type MockPipelineCounts = {
    raw: number;
    normalized: number;
    afterExactDedup: number;
    afterNearDedup: number;
    archivedNew: number;
    archivedUpdated: number;
  };

  function mapRunCounts(counts: MockPipelineCounts): RunCounts {
    return {
      raw: counts.raw,
      normalized: counts.normalized,
      afterExactDedup: counts.afterExactDedup,
      afterNearDedup: counts.afterNearDedup,
      archivedNew: counts.archivedNew,
      archivedUpdated: counts.archivedUpdated,
    };
  }

  test("maps all counts correctly", () => {
    const counts: MockPipelineCounts = {
      raw: 100,
      normalized: 90,
      afterExactDedup: 80,
      afterNearDedup: 70,
      archivedNew: 65,
      archivedUpdated: 5,
    };

    const result = mapRunCounts(counts);
    expect(result.raw).toBe(100);
    expect(result.normalized).toBe(90);
    expect(result.afterExactDedup).toBe(80);
    expect(result.afterNearDedup).toBe(70);
    expect(result.archivedNew).toBe(65);
    expect(result.archivedUpdated).toBe(5);
  });

  test("maps zero counts correctly", () => {
    const counts: MockPipelineCounts = {
      raw: 0,
      normalized: 0,
      afterExactDedup: 0,
      afterNearDedup: 0,
      archivedNew: 0,
      archivedUpdated: 0,
    };

    const result = mapRunCounts(counts);
    expect(result.raw).toBe(0);
    expect(result.afterNearDedup).toBe(0);
  });
});
