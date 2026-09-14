/**
 * The print theme.
 *
 * A PDF is a light document: `pdf-lib` cannot read CSS custom properties, and a
 * dark-on-dark export would be unusable, so the exported sheet deliberately does
 * NOT follow the screen theme. These named values are the single source of truth
 * for both the pdf-lib drawing calls and the on-screen PDF preview, so the
 * preview never claims a fidelity the file does not have.
 *
 * Values are stored as pdf-lib expects them (0-1 channels) to keep the produced
 * bytes exactly as they were before this module existed; `printCss` converts for
 * the DOM preview.
 */

export interface PrintColor {
  r: number;
  g: number;
  b: number;
}

export const PRINT_THEME = {
  /** Paper. */
  paper: { r: 1, g: 1, b: 1 },
  /** Title and body copy. */
  foreground: { r: 0.16, g: 0.19, b: 0.24 },
  /** Subtitle and secondary notes. */
  muted: { r: 0.4, g: 0.44, b: 0.5 },
  /** Page footer. */
  rule: { r: 0.5, g: 0.5, b: 0.5 },
} satisfies Record<string, PrintColor>;

/** `rgb(r g b)` for the DOM preview, matching what pdf-lib paints on the page. */
export const printCss = (color: PrintColor): string =>
  `rgb(${Math.round(color.r * 255)} ${Math.round(color.g * 255)} ${Math.round(color.b * 255)})`;
