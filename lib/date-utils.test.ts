import { describe, test, expect } from "bun:test";
import {
  beijingDayRange,
  formatUtcDate,
} from "./date-utils";

describe("beijingDayRange", () => {
  test("北京时间 2026-03-28 00:00 对应 UTC 03-27 16:00", () => {
    const { start, end } = beijingDayRange("2026-03-28");
    expect(formatUtcDate(start)).toBe("2026-03-27");
    expect(start.getUTCHours()).toBe(16);
  });

  test("北京时间 2026-03-28 23:59 对应 UTC 03-28 15:59", () => {
    const { end } = beijingDayRange("2026-03-28");
    expect(formatUtcDate(end)).toBe("2026-03-28");
    expect(end.getUTCHours()).toBe(15);
    expect(end.getUTCMinutes()).toBe(59);
  });

  test("end 在 start 之后（跨日边界）", () => {
    const { start, end } = beijingDayRange("2026-03-28");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  test("跨月边界：北京时间 1月31日", () => {
    const { start, end } = beijingDayRange("2026-01-31");
    expect(formatUtcDate(start)).toBe("2026-01-30");
    expect(formatUtcDate(end)).toBe("2026-01-31");
  });

  test("跨年边界：北京时间 12月31日", () => {
    const { start, end } = beijingDayRange("2025-12-31");
    expect(formatUtcDate(start)).toBe("2025-12-30");
    expect(formatUtcDate(end)).toBe("2025-12-31");
  });
});
