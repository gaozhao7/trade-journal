"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME_ID } from "@/lib/theme";
import { getTheme, seriesCssVar } from "@/lib/theme-registry";

export interface VizTokens {
  surface: string;
  inkMuted: string;
  gridline: string;
  baseline: string;
  brand: string;
  profit: string;
  profitFill: string;
  loss: string;
  series: string[];
  foreground: string;
  card: string;
  border: string;
  /** Resolved `--shadow-tooltip`: canvas/SVG tooltips get the same elevation as DOM ones. */
  tooltipShadow: string;
  /** Vela annotations, which only accept literal colours. */
  velaBuy: string;
  velaSell: string;
  velaLabelText: string;
  velaProfitLabelText: string;
  velaLossLabelText: string;
}

/**
 * Fallbacks come from the registry's default theme, so a browser that cannot
 * resolve custom properties degrades to the product default instead of to a
 * stale copy of yesterday's palette.
 */
const defaults = getTheme(DEFAULT_THEME_ID).tokens;
const defaultShadows = getTheme(DEFAULT_THEME_ID).shadows;

/** Resolve the design tokens from the document so canvas painters match the theme. */
export const readVizTokens = (): VizTokens => {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surface: v("--viz-surface", defaults.vizSurface),
    inkMuted: v("--ink-muted", defaults.inkMuted),
    gridline: v("--gridline", defaults.gridline),
    baseline: v("--baseline", defaults.baseline),
    brand: v("--brand", defaults.brand),
    profit: v("--profit", defaults.profit),
    profitFill: v("--profit-fill", defaults.profitFill),
    loss: v("--loss", defaults.loss),
    series: defaults.series.map((fallback, index) => v(seriesCssVar(index + 1), fallback)),
    foreground: v("--foreground", defaults.foreground),
    card: v("--card", defaults.card),
    border: v("--border", defaults.border),
    tooltipShadow: v("--shadow-tooltip", defaultShadows.tooltip),
    velaBuy: v("--vela-buy", defaults.velaBuy),
    velaSell: v("--vela-sell", defaults.velaSell),
    velaLabelText: v("--vela-label-text", defaults.velaLabelText),
    velaProfitLabelText: v("--vela-profit-label-text", defaults.velaProfitLabelText),
    velaLossLabelText: v("--vela-loss-label-text", defaults.velaLossLabelText),
  };
};

/**
 * Resolved viz colors. SVG charts could use `var(--x)` strings, but ECharts
 * paints to canvas, which can't — so every chart resolves tokens through this
 * hook and re-resolves when the theme changes.
 *
 * `data-theme` is the signal; `class` and `style` stay in the filter so an
 * adapter that only flipped `.dark` (or only `color-scheme`) still repaints.
 * Redundant notifications are suppressed by the value comparison below, and the
 * provider's `journal-theme-change` event handles consumers that repaint
 * imperatively instead of re-rendering.
 */
let tokens: VizTokens | null = null;
/** Serialized form of `tokens`, so a redraw compares two strings, not two objects. */
let snapshot = "";
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
const getTokens = () => tokens;
const getServerTokens = () => null;
function subscribeTokens(listener: () => void) {
  listeners.add(listener);
  if (!observer) {
    const read = () => {
      const next = readVizTokens();
      // `readVizTokens` builds its object in a fixed key order and allocates a new
      // `series` array every time, so a shallow field compare would report a change
      // on every read. Serializing normalizes the array; caching the previous string
      // keeps this to one stringify per mutation, and the string is what makes a
      // future "which token changed?" investigation a simple diff.
      const nextSnapshot = JSON.stringify(next);
      if (nextSnapshot === snapshot) return;
      snapshot = nextSnapshot;
      tokens = next;
      listeners.forEach((notify) => notify());
    };
    observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    read();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      observer?.disconnect();
      observer = null;
      tokens = null;
      snapshot = "";
    }
  };
}
/** Every mounted chart shares one theme observer and one computed-style read. */
export const useVizTokens = (): VizTokens | null =>
  useSyncExternalStore(subscribeTokens, getTokens, getServerTokens);

export const tooltipStyle = (t: VizTokens): React.CSSProperties => ({
  background: t.card,
  border: `1px solid ${t.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.6,
  color: t.foreground,
  boxShadow: t.tooltipShadow,
});
