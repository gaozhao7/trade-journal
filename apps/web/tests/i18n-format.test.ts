import { describe, expect, it } from "vitest";
import {
  durationParts,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  shortWeekdays,
} from "../src/lib/i18n-format";

describe("locale-aware money formatting", () => {
  it("formats a valid currency with locale rules", () => {
    expect(formatMoney(1234.5, "USD", "en-US")).toContain("1,234.50");
    expect(formatMoney(1234.5, "USD", "en-US")).toContain("$");
  });

  it("never throws on an empty currency (regression: RangeError from currencies[0] ?? '')", () => {
    const fallback = formatMoney(1234.5, "USD", "en-US");
    expect(() => formatMoney(1234.5, "", "en-US")).not.toThrow();
    expect(formatMoney(1234.5, "", "en-US")).toBe(fallback);
  });

  it("never throws on undefined or malformed currency codes", () => {
    const fallback = formatMoney(12, "USD", "en-US");
    expect(formatMoney(12, undefined as unknown as string, "en-US")).toBe(fallback);
    expect(() => formatMoney(12, "ZZZZ", "en-US")).not.toThrow();
    expect(() => formatMoney(12, "12", "en-US")).not.toThrow();
  });

  it("accepts a lower-case code by normalizing it", () => {
    expect(formatMoney(5, "usd", "en-US")).toBe(formatMoney(5, "USD", "en-US"));
  });

  it("keeps the sign in the text", () => {
    expect(formatMoney(-5, "USD", "en-US")).toContain("-");
    expect(formatMoney(5, "USD", "en-US")).toContain("+");
  });

  it("works for zh-CN as well", () => {
    expect(() => formatMoney(-1234.5, "USD", "zh-CN")).not.toThrow();
    expect(() => formatMoney(0, "JPY", "zh-CN")).not.toThrow();
  });
});

describe("numbers, percentages and dates", () => {
  it("formats numbers and percentages per locale", () => {
    expect(formatNumber(1234.567, 2, "en-US")).toBe("1,234.57");
    expect(formatPercent(0.425, 1, "en-US")).toBe("42.5%");
  });

  it("ignores an unknown or empty time zone instead of throwing", () => {
    expect(() => formatDate("2026-01-02T00:00:00Z", "en-US", undefined, "UTC")).not.toThrow();
    expect(() => formatDate("2026-01-02T00:00:00Z", "en-US", undefined, "")).not.toThrow();
    expect(() =>
      formatDate("2026-01-02T00:00:00Z", "en-US", undefined, "Mars/Phobos"),
    ).not.toThrow();
  });

  it("never throws on an invalid date (regression: RangeError 'Invalid time value')", () => {
    // Intraday charts hand bare time labels to a date formatter.
    expect(() => formatDate("09:35", "en-US")).not.toThrow();
    expect(formatDate("09:35", "en-US")).toBe("–");
    expect(formatDate("not-a-date", "en-US")).toBe("–");
    expect(formatDate(new Date(Number.NaN), "en-US")).toBe("–");
    expect(formatDateTime("09:35", "en-US")).toBe("–");
    expect(formatDateTime(new Date(Number.NaN), "en-US")).toBe("–");
  });

  it("still formats valid dates", () => {
    expect(formatDate("2026-09-14T00:00:00Z", "en-US", undefined, "UTC")).toContain("2026");
    expect(formatDate(new Date(Date.UTC(2026, 8, 14)), "zh-CN", undefined, "UTC")).toContain(
      "2026",
    );
  });

  it("lists locale-ordered short weekdays", () => {
    const days = shortWeekdays("en-US");
    expect(days).toHaveLength(7);
    expect(days[0]).toMatch(/^S/);
  });
});

describe("duration parts", () => {
  it("decomposes milliseconds into the shared units", () => {
    expect(durationParts(null)).toBeNull();
    expect(durationParts(Number.NaN)).toBeNull();
    // Under 30s rounds down to zero minutes; 30s and up rounds to one.
    expect(durationParts(0)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(durationParts(20_000)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(durationParts(30_000)).toEqual({ days: 0, hours: 0, minutes: 1 });
    expect(durationParts(90 * 60_000)).toEqual({ days: 0, hours: 1, minutes: 30 });
    expect(durationParts(26 * 3_600_000)).toEqual({ days: 1, hours: 2, minutes: 0 });
  });
});
