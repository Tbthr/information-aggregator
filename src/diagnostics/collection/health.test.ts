import { describe, expect, test } from "bun:test";
import { classifySourceHealth, type SourceHealthSummary } from "./health";

describe("classifySourceHealth", () => {
  test("consecutiveFailures = 0 with recent success is healthy", () => {
    const now = new Date().toISOString();
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "healthy",
      consecutiveFailures: 0,
      lastSuccessAt: now,
      lastFailureAt: undefined,
      lastError: undefined,
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("healthy");
  });

  test("consecutiveFailures = 0 with no history is healthy", () => {
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "healthy",
      consecutiveFailures: 0,
      lastSuccessAt: undefined,
      lastFailureAt: undefined,
      lastError: undefined,
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("healthy");
  });

  test("consecutiveFailures > 0 but last success is recent is warning", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "warning",
      consecutiveFailures: 2,
      lastSuccessAt: twoHoursAgo,
      lastFailureAt: twoHoursAgo,
      lastError: "Some error",
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("warning");
  });

  test("consecutiveFailures > 0 with no recent success is failing", () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "failing",
      consecutiveFailures: 5,
      lastSuccessAt: oneDayAgo,
      lastFailureAt: oneDayAgo,
      lastError: "Connection timeout",
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("failing");
  });

  test("consecutiveFailures > 0 with lastSuccessAt older than lastFailureAt is failing", () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "failing",
      consecutiveFailures: 3,
      lastSuccessAt: twoDaysAgo,
      lastFailureAt: oneDayAgo,
      lastError: "Repeated failures",
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("failing");
  });

  test("missing lastSuccessAt and lastFailureAt with failures is failing", () => {
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "failing",
      consecutiveFailures: 1,
      lastSuccessAt: undefined,
      lastFailureAt: undefined,
      lastError: "Unknown error",
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("failing");
  });

  test("undefined consecutiveFailures defaults to healthy", () => {
    const detail: SourceHealthSummary = {
      sourceId: "src-1",
      sourceName: "Test Source",
      status: "healthy",
      consecutiveFailures: 0,
      lastSuccessAt: undefined,
      lastFailureAt: undefined,
      lastError: undefined,
    };

    const result = classifySourceHealth(detail);
    expect(result).toBe("healthy");
  });
});
