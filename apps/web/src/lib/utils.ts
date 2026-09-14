import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatMoney, formatNumber, formatPercent } from "./i18n-format";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const DEFAULT_LOCALE = "en-US";

/**
 * Signed money — the sign is ALWAYS in the text; color never carries P&L alone.
 *
 * Pass the active locale (from `useFormat()` / `useLocale()`); the default keeps
 * legacy call sites working until they are migrated.
 */
export const fmtMoney = (value: number, currency = "USD", locale = DEFAULT_LOCALE): string =>
  formatMoney(value, currency, locale);

export const fmtNumber = (value: number, digits = 2, locale = DEFAULT_LOCALE): string =>
  formatNumber(value, digits, locale);

export const fmtPercent = (value: number | null, digits = 1, locale = DEFAULT_LOCALE): string =>
  value === null ? "–" : formatPercent(value, digits, locale);

/**
 * @deprecated Durations are localized through `useFormat().duration` so units
 * follow the active locale. Kept only for legacy call sites.
 */
export const fmtDuration = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) return "–";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

export const pnlClass = (value: number): string =>
  value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted-foreground";
