/**
 * The theme registry: the single place where a theme's identity, base and token
 * values are declared.
 *
 * CSS in `app/globals.css` remains the source of truth for *painting*; this table
 * is the source of truth for *knowing* — it types the contract, gives canvas /
 * export code a fallback that matches the product default, and lets a new theme
 * be added without touching a single business component. `tests/theme.test.ts`
 * asserts every value here against the CSS block of the same theme, so the two
 * can never drift.
 *
 * Client-safe by construction: no Node APIs, no React.
 *
 * Adding a theme is deliberately not a one-file change: register the ID in
 * `lib/theme.ts` (`THEME_IDS` and `THEME_COLOR_SCHEMES`), add the definition
 * here, add the matching `[data-theme="<id>"]` block to `app/globals.css`, and
 * add `Theme.names.<id>` to both locales. The compiler rejects a partial
 * registration; the test suite rejects a mismatched one. The authoritative step
 * list is docs/theme-system-design.md §14.
 */

import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEME_COLOR_SCHEMES,
  type ColorScheme,
  type ThemeId,
} from "./theme";

export interface ThemeTokens {
  /** Page and body text. */
  background: string;
  foreground: string;
  /** Cards and raised surfaces. */
  card: string;
  cardForeground: string;
  /** Menus, dialogs and tooltips. */
  popover: string;
  popoverForeground: string;
  /** Filled controls. */
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  /** Quiet surfaces and the text sitting on them. */
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  /** Destructive actions. */
  destructive: string;
  destructiveForeground: string;
  /** Outlines, inputs and focus. */
  border: string;
  input: string;
  ring: string;
  brand: string;
  /** Chart surfaces. */
  vizSurface: string;
  inkMuted: string;
  gridline: string;
  baseline: string;
  /** Financial semantics. Never the sole carrier of meaning. */
  profit: string;
  profitFill: string;
  loss: string;
  neutralMid: string;
  /** Categorical series, used in fixed order, never cycled. */
  series: [string, string, string, string, string, string, string, string];
  /** Vela annotation colours (the library accepts only literal colours). */
  velaBuy: string;
  velaSell: string;
  velaLabelText: string;
  velaProfitLabelText: string;
  velaLossLabelText: string;
  /** Long-form note rendering. */
  markdownQuoteBorder: string;
  markdownQuoteText: string;
  markdownCodeBg: string;
  markdownTableBorder: string;
  /** Toggle knob. */
  switchKnob: string;
}

/** Elevation and overlay layers, kept out of `ThemeTokens` because they are not colours. */
export interface ThemeShadows {
  card: string;
  tooltip: string;
  menu: string;
  popover: string;
  dialog: string;
  drag: string;
  switchKnob: string;
  overlayBackdrop: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  colorScheme: ColorScheme;
  /** next-intl key inside the `Theme` namespace. Never a display string. */
  nameKey: string;
  tokens: ThemeTokens;
  shadows: ThemeShadows;
}

/** CSS custom property behind each token. Also used by the CSS parity test. */
export const THEME_TOKEN_CSS_VARS: Record<keyof ThemeTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  brand: "--brand",
  vizSurface: "--viz-surface",
  inkMuted: "--ink-muted",
  gridline: "--gridline",
  baseline: "--baseline",
  profit: "--profit",
  profitFill: "--profit-fill",
  loss: "--loss",
  neutralMid: "--neutral-mid",
  series: "--series-1",
  velaBuy: "--vela-buy",
  velaSell: "--vela-sell",
  velaLabelText: "--vela-label-text",
  velaProfitLabelText: "--vela-profit-label-text",
  velaLossLabelText: "--vela-loss-label-text",
  markdownQuoteBorder: "--markdown-quote-border",
  markdownQuoteText: "--markdown-quote-text",
  markdownCodeBg: "--markdown-code-bg",
  markdownTableBorder: "--markdown-table-border",
  switchKnob: "--switch-knob",
};

export const THEME_SHADOW_CSS_VARS: Record<keyof ThemeShadows, string> = {
  card: "--shadow-card",
  tooltip: "--shadow-tooltip",
  menu: "--shadow-menu",
  popover: "--shadow-popover",
  dialog: "--shadow-dialog",
  drag: "--shadow-drag",
  switchKnob: "--shadow-switch",
  overlayBackdrop: "--overlay-backdrop",
};

/** CSS custom property for the nth categorical series colour (1-based). */
export const seriesCssVar = (index: number) => `--series-${index}`;

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  dark: {
    id: "dark",
    colorScheme: "dark",
    nameKey: "names.dark",
    tokens: {
      background: "#08080a",
      foreground: "#f4f4f4",
      card: "#101013",
      cardForeground: "#f4f4f4",
      popover: "#131317",
      popoverForeground: "#f4f4f4",
      primary: "#ececec",
      primaryForeground: "#131316",
      secondary: "#1b1b20",
      secondaryForeground: "#f4f4f4",
      muted: "#17171b",
      mutedForeground: "#9c9ca6",
      accent: "#1b1b20",
      accentForeground: "#f4f4f4",
      destructive: "#d03b3b",
      destructiveForeground: "#fafafa",
      border: "#222228",
      input: "#26262c",
      ring: "#1197e2",
      brand: "#1197e2",
      vizSurface: "#101013",
      inkMuted: "#8b8b95",
      gridline: "#1e1e24",
      baseline: "#30303a",
      profit: "#0ca30c",
      profitFill: "#0ca30c",
      loss: "#d03b3b",
      neutralMid: "#383835",
      series: [
        "#3987e5",
        "#d95926",
        "#199e70",
        "#c98500",
        "#d55181",
        "#008300",
        "#9085e9",
        "#e66767",
      ],
      velaBuy: "#0ca30c",
      velaSell: "#d03b3b",
      velaLabelText: "#f4f4f4",
      velaProfitLabelText: "#ffffff",
      velaLossLabelText: "#ffffff",
      markdownQuoteBorder: "#657386",
      markdownQuoteText: "#9eabc0",
      markdownCodeBg: "#121a27",
      markdownTableBorder: "#344155",
      switchKnob: "#ffffff",
    },
    shadows: {
      card: "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.25)",
      tooltip: "0 12px 32px rgb(0 0 0 / 0.18), 0 2px 8px rgb(0 0 0 / 0.1)",
      menu: "0 12px 36px rgb(0 0 0 / 0.18), 0 3px 8px rgb(0 0 0 / 0.08)",
      popover: "0 18px 60px rgb(0 0 0 / 0.24), 0 4px 12px rgb(0 0 0 / 0.1)",
      dialog: "0 24px 80px rgb(0 0 0 / 0.28), 0 4px 16px rgb(0 0 0 / 0.12)",
      drag: "0 24px 55px rgb(0 0 0 / 0.4), 0 8px 18px rgb(0 0 0 / 0.2)",
      switchKnob: "0 1px 3px rgb(0 0 0 / 0.15)",
      overlayBackdrop: "rgb(0 0 0 / 0.6)",
    },
  },
  light: {
    id: "light",
    colorScheme: "light",
    nameKey: "names.light",
    tokens: {
      background: "#f9f9f7",
      foreground: "#0b0b0b",
      card: "#fcfcfb",
      cardForeground: "#0b0b0b",
      popover: "#fcfcfb",
      popoverForeground: "#0b0b0b",
      primary: "#16161a",
      primaryForeground: "#fafafa",
      secondary: "#f0efec",
      secondaryForeground: "#16161a",
      muted: "#f0efec",
      mutedForeground: "#52514e",
      accent: "#f0efec",
      accentForeground: "#16161a",
      destructive: "#d03b3b",
      destructiveForeground: "#fafafa",
      border: "#e1e0d9",
      input: "#e1e0d9",
      ring: "#0b7cbd",
      brand: "#0b7cbd",
      vizSurface: "#fcfcfb",
      inkMuted: "#686760",
      gridline: "#e1e0d9",
      baseline: "#c3c2b7",
      profit: "#006300",
      profitFill: "#0ca30c",
      loss: "#d03b3b",
      neutralMid: "#f0efec",
      series: [
        "#2a78d6",
        "#eb6834",
        "#1baf7a",
        "#eda100",
        "#e87ba4",
        "#008300",
        "#4a3aa7",
        "#e34948",
      ],
      velaBuy: "#087f23",
      velaSell: "#bd2626",
      velaLabelText: "#0b0b0b",
      velaProfitLabelText: "#ffffff",
      velaLossLabelText: "#ffffff",
      markdownQuoteBorder: "#c3c2b7",
      markdownQuoteText: "#52514e",
      markdownCodeBg: "#f0efec",
      markdownTableBorder: "#e1e0d9",
      switchKnob: "#ffffff",
    },
    shadows: {
      card: "inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.25)",
      tooltip: "0 12px 32px rgb(0 0 0 / 0.18), 0 2px 8px rgb(0 0 0 / 0.1)",
      menu: "0 12px 36px rgb(0 0 0 / 0.18), 0 3px 8px rgb(0 0 0 / 0.08)",
      popover: "0 18px 60px rgb(0 0 0 / 0.24), 0 4px 12px rgb(0 0 0 / 0.1)",
      dialog: "0 24px 80px rgb(0 0 0 / 0.28), 0 4px 16px rgb(0 0 0 / 0.12)",
      drag: "0 24px 55px rgb(0 0 0 / 0.4), 0 8px 18px rgb(0 0 0 / 0.2)",
      switchKnob: "0 1px 3px rgb(0 0 0 / 0.15)",
      overlayBackdrop: "rgb(0 0 0 / 0.6)",
    },
  },
};

export { DEFAULT_THEME_ID, THEME_IDS, THEME_COLOR_SCHEMES };
export type { ColorScheme, ThemeId };

export const getTheme = (id: ThemeId): ThemeDefinition => THEMES[id];

/** `Theme.names.*` message key for a theme, for selectors and accessibility labels. */
export const themeNameKey = (id: ThemeId): string => THEMES[id].nameKey;
