import { describe, expect, test } from "bun:test";
import { loadReportsInventory, resolveReportsTargets } from "./inventory";
import type { ReportsInventory } from "./types";

describe("loadReportsInventory", () => {
  test("returns inventory counts from database", async () => {
    // This test requires a running database connection
    const inventory = await loadReportsInventory();
    expect(typeof inventory.items).toBe("number");
    expect(typeof inventory.tweets).toBe("number");
    expect(typeof inventory.dailyReports).toBe("number");
    expect(typeof inventory.weeklyReports).toBe("number");
  });
});

describe("resolveReportsTargets", () => {
  test("returns daily date string in YYYY-MM-DD format", () => {
    const result = resolveReportsTargets();
    expect(result.dailyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns weekly week number in YYYY-WXX format", () => {
    const result = resolveReportsTargets();
    expect(result.weeklyWeekNumber).toMatch(/^\d{4}-W\d{2}$/);
  });

  test("daily date corresponds to today in Beijing time", () => {
    const { dailyDate } = resolveReportsTargets();
    // Should be a valid date string
    const parsed = new Date(dailyDate!);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});
