"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  durationParts,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  shortWeekdays,
  weekdayShort,
} from "./i18n-format";

export interface Formatters {
  locale: string;
  money: (value: number, currency?: string) => string;
  number: (value: number, digits?: number) => string;
  percent: (value: number | null, digits?: number) => string;
  date: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
    timeZone?: string,
  ) => string;
  dateTime: (
    value: Date | number | string,
    options?: Intl.DateTimeFormatOptions,
    timeZone?: string,
  ) => string;
  weekdayShort: (index: number) => string;
  weekdays: () => string[];
  duration: (ms: number | null | undefined) => string;
}

/**
 * Locale-bound formatters for numbers, money, dates and durations.
 *
 * Usage: `const format = useFormat(); format.money(value, currency)`.
 */
export const useFormat = (): Formatters => {
  const locale = useLocale();
  const t = useTranslations("Common");
  return useMemo<Formatters>(() => {
    const duration = (ms: number | null | undefined): string => {
      const parts = durationParts(ms);
      if (!parts) return "–";
      const { days, hours, minutes } = parts;
      if (days > 0) return t("duration.daysHours", { days, hours });
      if (hours > 0) return t("duration.hoursMinutes", { hours, minutes });
      if (minutes >= 1) return t("duration.minutes", { minutes });
      return t("duration.lessThanMinute");
    };
    return {
      locale,
      money: (value, currency = "USD") => formatMoney(value, currency, locale),
      number: (value, digits = 2) => formatNumber(value, digits, locale),
      percent: (value, digits = 1) => (value === null ? "–" : formatPercent(value, digits, locale)),
      date: (value, options, timeZone) => formatDate(value, locale, options, timeZone),
      dateTime: (value, options, timeZone) => formatDateTime(value, locale, options, timeZone),
      weekdayShort: (index) => weekdayShort(locale, index),
      weekdays: () => shortWeekdays(locale),
      duration,
    };
  }, [locale, t]);
};

/** Standalone duration formatter for components that only need that one helper. */
export const useDuration = (): Formatters["duration"] => useFormat().duration;
