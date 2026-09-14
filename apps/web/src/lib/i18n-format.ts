/**
 * Locale-aware formatting helpers.
 *
 * Components should prefer the React hooks in `@/lib/use-format` so the active
 * locale is picked up automatically. These pure functions take an explicit
 * locale and are meant for utilities, factories and Server Components.
 */

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
const percentFormatters = new Map<string, Intl.NumberFormat>();

const key = (...parts: (string | number)[]) => parts.join("|");

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;
const FALLBACK_CURRENCY = "USD";

/**
 * `Intl.NumberFormat` throws a RangeError for an empty or malformed currency,
 * and callers routinely pass `""` when a data set has no currency yet
 * (`currencies[0] ?? ""`). Normalize instead of crashing the render.
 */
const normalizeCurrency = (currency: string | null | undefined): string => {
  const value = typeof currency === "string" ? currency : "";
  return CURRENCY_PATTERN.test(value) ? value.toUpperCase() : FALLBACK_CURRENCY;
};

const createMoneyFormatter = (locale: string, currency: string): Intl.NumberFormat => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      signDisplay: "exceptZero",
    });
  } catch {
    // Never let a bad currency/locale take down a render; degrade to a plain number.
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  }
};

/** Signed money. The sign is always part of the text so color never carries P&L alone. */
export const formatMoney = (value: number, currency: string, locale: string): string => {
  const code = normalizeCurrency(currency);
  const cacheKey = key(locale, code);
  let formatter = moneyFormatters.get(cacheKey);
  if (!formatter) {
    formatter = createMoneyFormatter(locale, code);
    moneyFormatters.set(cacheKey, formatter);
  }
  return formatter.format(value);
};

export const formatNumber = (value: number, digits: number, locale: string): string => {
  const cacheKey = key(locale, digits);
  let formatter = numberFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: digits });
    numberFormatters.set(cacheKey, formatter);
  }
  return formatter.format(value);
};

/** `value` is a ratio (0.42 renders as 42%). */
export const formatPercent = (value: number, digits: number, locale: string): string => {
  const cacheKey = key(locale, digits);
  let formatter = percentFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: digits,
    });
    percentFormatters.set(cacheKey, formatter);
  }
  return formatter.format(value);
};

const validTimeZones = new Set<string>();

/** `Intl.DateTimeFormat` throws on an unknown/empty zone; drop it instead. */
const safeTimeZone = (timeZone?: string): string | undefined => {
  if (!timeZone) return undefined;
  if (validTimeZones.has(timeZone)) return timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    validTimeZones.add(timeZone);
    return timeZone;
  } catch {
    return undefined;
  }
};

const toDate = (value: Date | number | string): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Shown when a value cannot be represented as a date — never throw mid-render. */
const INVALID_DATE = "–";

export const formatDate = (
  value: Date | number | string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  timeZone?: string,
): string => {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  const zone = safeTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat(locale, zone ? { ...options, timeZone: zone } : options).format(
      date,
    );
  } catch {
    return INVALID_DATE;
  }
};

export const formatDateTime = (
  value: Date | number | string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  timeZone?: string,
): string => {
  const date = toDate(value);
  if (!date) return INVALID_DATE;
  const zone = safeTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat(locale, zone ? { ...options, timeZone: zone } : options).format(
      date,
    );
  } catch {
    return INVALID_DATE;
  }
};

/** Locale-ordered short weekday names: `shortWeekdays("en-US")[0] === "Sun"`. */
export const shortWeekdays = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-07 was a Sunday, so index i maps to weekday i.
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(Date.UTC(2024, 0, 7 + index))),
  );
};

export const weekdayShort = (locale: string, index: number): string =>
  shortWeekdays(locale)[index] ?? String(index);

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

/** Decompose milliseconds into the units used by the shared duration messages. */
export const durationParts = (ms: number | null | undefined): DurationParts | null => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return { days: 0, hours: 0, minutes: 0 };
  const minutes = totalMinutes;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (hours < 24) return { days: 0, hours, minutes: minutes % 60 };
  return { days, hours: hours % 24, minutes: minutes % 60 };
};
