export const locales = ["en-US", "zh-CN"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh-CN";
export const localeCookie = "journal-locale";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && locales.includes(value as Locale);
