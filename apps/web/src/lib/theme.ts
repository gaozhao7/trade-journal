/**
 * Theme identity, the DOM contract, and the pre-paint bootstrap.
 *
 * A theme is a stable `ThemeId`, never "the dark one" or "the light one".
 * `ColorScheme` only describes the light/dark base that third-party libraries
 * (Vela, `.dark` consumers, native form controls) understand, so a future theme
 * may be `terminal` while still declaring `colorScheme: "dark"`.
 *
 * This module must stay free of React and of the theme registry so the inline
 * <head> script can import nothing but plain constants.
 */

export const THEME_IDS = ["dark", "light"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ColorScheme = "light" | "dark";

export const THEME_KEY = "journal-theme-v1";
export const DEFAULT_THEME_ID: ThemeId = "dark";

/** Fired on `window` after a theme change so imperative surfaces (Vela, canvas) can repaint. */
export const THEME_CHANGE_EVENT = "journal-theme-change";

export interface ThemeChangeDetail {
  theme: ThemeId;
  colorScheme: ColorScheme;
}

/**
 * `id -> colorScheme`, the only theme data the pre-paint script inlines. Kept
 * separate from the registry so <head> never carries the token table.
 *
 * This is one of three registration points — `THEME_IDS` here, this map, and
 * `THEMES` in the registry. All three are typed as `Record<ThemeId, …>`, so
 * `tsc` rejects a partial registration, but it cannot check the *values*: adding
 * a theme also needs a `[data-theme="<id>"]` block in globals.css and
 * `Theme.names.<id>` in both locales. The full, mandatory step list lives in
 * docs/theme-system-design.md §14.
 */
export const THEME_COLOR_SCHEMES: Record<ThemeId, ColorScheme> = {
  dark: "dark",
  light: "light",
};

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);

/** Resolve a stored value into a registered theme. Anything unknown falls back to dark. */
export const themePreference = (value: string | null): ThemeId =>
  isThemeId(value) ? value : DEFAULT_THEME_ID;

export const colorSchemeFor = (id: ThemeId): ColorScheme => THEME_COLOR_SCHEMES[id];

/**
 * The single writer of the DOM theme contract. `data-theme`, `.dark` and
 * `color-scheme` always change together — never update one of them in isolation.
 */
export function applyTheme(root: HTMLElement, id: ThemeId): void {
  const scheme = colorSchemeFor(id);
  root.dataset.theme = id;
  root.classList.toggle("dark", scheme === "dark");
  root.style.colorScheme = scheme;
}

export function readThemeFromDom(root: HTMLElement): ThemeId {
  const id = root.dataset.theme;
  return isThemeId(id) ? id : DEFAULT_THEME_ID;
}

/** The theme currently applied to the document, for adapters that must stay imperative. */
export const currentThemeId = (): ThemeId => readThemeFromDom(document.documentElement);

export const currentColorScheme = (): ColorScheme => colorSchemeFor(currentThemeId());

/**
 * Server-rendered `<html>` attributes. The server cannot read localStorage, so it
 * emits the product default; the script below overwrites it before first paint.
 */
export function themeHtmlAttributes(id: ThemeId) {
  const colorScheme = colorSchemeFor(id);
  return {
    "data-theme": id,
    className: colorScheme === "dark" ? "dark" : undefined,
    style: { colorScheme },
  };
}

/**
 * Runs in <head>, before the page paints. A saved light theme must not flash dark
 * while React hydrates. No OS preference override: dark is the product default.
 */
export const THEME_INIT_SCRIPT = `(()=>{const key=${JSON.stringify(THEME_KEY)};const fallback=${JSON.stringify(DEFAULT_THEME_ID)};const schemes=${JSON.stringify(THEME_COLOR_SCHEMES)};let id=fallback;try{const saved=localStorage.getItem(key);if(saved&&Object.prototype.hasOwnProperty.call(schemes,saved))id=saved}catch{}const scheme=schemes[id]||"dark";const root=document.documentElement;root.dataset.theme=id;root.classList.toggle("dark",scheme==="dark");root.style.colorScheme=scheme})();`;
