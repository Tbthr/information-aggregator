import { describe, test, expect } from "bun:test";
import {
  beijingDayRange,
  beijingWeekRange,
  parseWeekNumber,
  formatUtcDate,
  utcWeekNumber,
} from "./date-utils";

describe("beijingDayRange", () => {
  test("北京时间 2026-03-28 00:00 对应 UTC 03-27 16:00", () => {
    const { start, end } = beijingDayRange("2026-03-28");
    expect(formatUtcDate(start)).toBe("2026-03-27");
    expect(start.getUTCHours()).toBe(16);
  });

  test("北京时间 2026-03-28 23:59 对应 UTC 03-29 15:59", () => {
    const { end } = beijingDayRange("2026-03-28");
    expect(formatUtcDate(end)).toBe("2026-03-29");
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

describe("beijingWeekRange", () => {
  test("2026-03-28（周六）返回当周范围：周一 03-23 ~ 周日 03-29", () => {
    const { start, end } = beijingWeekRange(new Date("2026-03-28T12:00:00Z"));
    expect(formatUtcDate(start)).toBe("2026-03-23"); // 周一
    expect(formatUtcDate(end)).toBe("2026-03-29");  // 周日
  });

  test("2026-03-23（周一）返回当周范围", () => {
    const { start, end } = beijingWeekRange(new Date("2026-03-23T00:00:00Z"));
    expect(formatUtcDate(start)).toBe("2026-03-23");
    expect(formatUtcDate(end)).toBe("2026-03-29");
  });

  test("2026-01-01（周四）落在 W01 周范围内", () => {
    const { start, end } = beijingWeekRange(new Date("2026-01-01T00:00:00Z"));
    // 2026-01-01 是周四，属于 W01（周一 2025-12-29 ~ 周日 2026-01-04）
    expect(formatUtcDate(start)).toBe("2025-12-29");
    expect(formatUtcDate(end)).toBe("2026-01-04");
  });
});

describe("parseWeekNumber", () => {
  test("2026-W13 → 2026-03-23（周一）", () => {
    const monday = parseWeekNumber("2026-W13");
    expect(formatUtcDate(monday)).toBe("2026-03-23");
  });

  test("2026-W01 → 2025-12-29（周一）", () => {
    const monday = parseWeekNumber("2026-W01");
    expect(formatUtcDate(monday)).toBe("2025-12-29");
  });

  test("2025-W01 → 2024-12-30（周一）", () => {
    const monday = parseWeekNumber("2025-W01");
    expect(formatUtcDate(monday)).toBe("2024-12-30");
  });

  test("2024-W01 → 2024-01-01（周一）", () => {
    const monday = parseWeekNumber("2024-W01");
    expect(formatUtcDate(monday)).toBe("2024-01-01");
  });

  test("2027-W52 → 2027-12-27（周一）", () => {
    const monday = parseWeekNumber("2027-W52");
    expect(formatUtcDate(monday)).toBe("2027-12-27");
  });

  test("parseWeekNumber 是 utcWeekNumber 的逆函数", () => {
    // 用已知的周一反推 week number，再 parse 回来
    const knownMonday = new Date(Date.UTC(2026, 2, 23)); // 2026-03-23
    const weekNum = utcWeekNumber(knownMonday);
    expect(weekNum).toBe("2026-W13");
    const parsed = parseWeekNumber(weekNum);
    expect(formatUtcDate(parsed)).toBe("2026-03-23");
  });
});
