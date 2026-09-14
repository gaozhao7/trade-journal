import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyTheme,
  colorSchemeFor,
  DEFAULT_THEME_ID,
  isThemeId,
  readThemeFromDom,
  THEME_COLOR_SCHEMES,
  themeHtmlAttributes,
  THEME_IDS,
  THEME_INIT_SCRIPT,
  THEME_KEY,
  themePreference,
  type ThemeId,
} from "../src/lib/theme";
import {
  getTheme,
  seriesCssVar,
  THEMES,
  THEME_SHADOW_CSS_VARS,
  THEME_TOKEN_CSS_VARS,
  type ThemeShadows,
  type ThemeTokens,
} from "../src/lib/theme-registry";

interface FakeRoot {
  dataset: Record<string, string>;
  style: Record<string, string>;
  classList: {
    toggle: (name: string, force?: boolean) => void;
    contains: (name: string) => boolean;
  };
}

/** Minimal documentElement stand-in: the DOM contract touches exactly these three things. */
const createRoot = () => {
  const classes = new Set<string>();
  const root: FakeRoot = {
    dataset: {},
    style: {},
    classList: {
      toggle: (name, force) => {
        const on = force ?? !classes.has(name);
        if (on) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
  };
  return { root: root as unknown as HTMLElement, raw: root, classes };
};

const runInitScript = (saved: string | null, blocked = false) => {
  const { root, raw, classes } = createRoot();
  runInNewContext(THEME_INIT_SCRIPT, {
    localStorage: {
      getItem: (key: string) => {
        expect(key).toBe(THEME_KEY);
        if (blocked) throw new Error("blocked");
        return saved;
      },
    },
    document: { documentElement: root },
  });
  return { raw, classes };
};

describe("journal appearance", () => {
  it("defaults to dark and accepts only registered themes", () => {
    expect(themePreference(null)).toBe("dark");
    expect(themePreference("system")).toBe("dark");
    expect(themePreference("invalid")).toBe("dark");
    // Every registered ID round-trips, so registering a theme is enough for this
    // resolver — no component or resolver change is needed.
    for (const id of THEME_IDS) expect(themePreference(id)).toBe(id);
    // `terminal` is the rejection sample: an ID nobody registered yet must land on
    // the product default rather than on `undefined`.
    expect(themePreference("terminal")).toBe(DEFAULT_THEME_ID);
    expect(isThemeId("dark")).toBe(true);
    expect(isThemeId("terminal")).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });

  it("applies the DOM contract before hydration", () => {
    for (const saved of [null, "dark", "light", "invalid"]) {
      const { raw, classes } = runInitScript(saved);
      const expected = themePreference(saved);
      expect(raw.dataset.theme).toBe(expected);
      expect(classes.has("dark")).toBe(THEME_COLOR_SCHEMES[expected] === "dark");
      expect(raw.style.colorScheme).toBe(THEME_COLOR_SCHEMES[expected]);
    }
  });

  it("still renders dark when browser storage is blocked", () => {
    const { raw, classes } = runInitScript(null, true);
    expect(raw.dataset.theme).toBe("dark");
    expect(classes.has("dark")).toBe(true);
    expect(raw.style.colorScheme).toBe("dark");
  });

  it("keeps the pre-paint script free of the full registry", () => {
    // A length threshold would false-alarm as soon as a theme is added, so assert
    // on content: the script carries the key and the id -> base map, and nothing
    // else out of the registry.
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_KEY));
    for (const id of THEME_IDS) expect(THEME_INIT_SCRIPT).toContain(id);
    const registryValues: string[] = [];
    for (const id of THEME_IDS) {
      const theme = getTheme(id);
      for (const key of Object.keys(THEME_TOKEN_CSS_VARS) as (keyof ThemeTokens)[]) {
        if (key === "series") registryValues.push(...theme.tokens.series);
        else registryValues.push(theme.tokens[key]);
      }
      for (const key of Object.keys(THEME_SHADOW_CSS_VARS) as (keyof ThemeShadows)[]) {
        registryValues.push(theme.shadows[key]);
      }
    }
    for (const value of registryValues) {
      expect(THEME_INIT_SCRIPT, `the pre-paint script must not embed ${value}`).not.toContain(
        value,
      );
    }
    // No custom-property plumbing either: the script toggles attributes, it does
    // not carry the token table.
    expect(THEME_INIT_SCRIPT).not.toContain("--");
  });

  it("renders the server-side <html> contract from the product default", () => {
    expect(DEFAULT_THEME_ID).toBe("dark");
    const attributes = themeHtmlAttributes(DEFAULT_THEME_ID);
    expect(attributes["data-theme"]).toBe("dark");
    expect(attributes.className).toBe("dark");
    expect(attributes.style.colorScheme).toBe("dark");
  });

  it("omits .dark for a light-base theme", () => {
    const attributes = themeHtmlAttributes("light");
    expect(attributes["data-theme"]).toBe("light");
    expect(attributes.className).toBeUndefined();
    expect(attributes.style.colorScheme).toBe("light");
  });

  it("writes data-theme, .dark and color-scheme together", () => {
    for (const id of THEME_IDS) {
      const { root, raw, classes } = createRoot();
      applyTheme(root, id);
      expect(raw.dataset.theme).toBe(id);
      expect(classes.has("dark")).toBe(colorSchemeFor(id) === "dark");
      expect(raw.style.colorScheme).toBe(colorSchemeFor(id));
    }
  });

  it("reads the applied theme back from the DOM, falling back to dark", () => {
    const { root, raw } = createRoot();
    expect(readThemeFromDom(root)).toBe(DEFAULT_THEME_ID);
    raw.dataset.theme = "light";
    expect(readThemeFromDom(root)).toBe("light");
    raw.dataset.theme = "terminal";
    expect(readThemeFromDom(root)).toBe(DEFAULT_THEME_ID);
  });
});

describe("theme registry", () => {
  it("exposes one definition per theme ID, with unique identity", () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort());
    const definitions = THEME_IDS.map(getTheme);
    expect(definitions.map((definition) => definition.id)).toEqual([...THEME_IDS]);
    expect(new Set(definitions.map((definition) => definition.nameKey)).size).toBe(
      THEME_IDS.length,
    );
    for (const definition of definitions) expect(definition.nameKey).toMatch(/^names\./);
  });

  it("keeps the inlined scheme map in step with the registry", () => {
    expect(DEFAULT_THEME_ID).toBe(THEME_IDS[0]);
    for (const id of THEME_IDS) {
      expect(THEME_COLOR_SCHEMES[id]).toBe(getTheme(id).colorScheme);
    }
  });

  it("declares a complete, non-empty token set for every theme", () => {
    for (const id of THEME_IDS) {
      const theme = getTheme(id);
      expect(Object.keys(theme.tokens).sort()).toEqual(Object.keys(THEME_TOKEN_CSS_VARS).sort());
      expect(Object.keys(theme.shadows).sort()).toEqual(Object.keys(THEME_SHADOW_CSS_VARS).sort());
      for (const key of Object.keys(THEME_TOKEN_CSS_VARS) as (keyof ThemeTokens)[]) {
        if (key === "series") continue;
        expect(theme.tokens[key], `${id}.${key} must be a literal colour`).toMatch(
          /^#[0-9a-f]{3,8}$/i,
        );
      }
      expect(theme.tokens.series).toHaveLength(8);
      for (const swatch of theme.tokens.series) expect(swatch).toMatch(/^#/);
      for (const value of Object.values(theme.shadows)) expect(value.length).toBeGreaterThan(0);
    }
  });

  it("names every registered theme in both locales", () => {
    // `nameKey` is metadata: nothing renders it yet, so no other check can see it.
    // check-i18n.mjs only compares the two locales against each other (a name
    // missing from *both* passes) and check-i18n-keys.mjs only sees static t("…")
    // call sites. This is therefore the only guard for the translation step of
    // docs/theme-system-design.md §14.3.
    const namesFor = (locale: string) =>
      (
        JSON.parse(
          readFileSync(new URL(`../src/i18n/messages/${locale}.json`, import.meta.url), "utf8"),
        ) as { Theme?: { names?: Record<string, unknown> } }
      ).Theme?.names ?? {};
    for (const locale of ["en-US", "zh-CN"]) {
      const names = namesFor(locale);
      for (const id of THEME_IDS) {
        const [namespace, key] = getTheme(id).nameKey.split(".");
        expect(namespace, `${locale}: nameKey must live under Theme.names`).toBe("names");
        expect(key, `${locale}: ${id} must name its own key`).toBe(id);
        const value = names[id];
        expect(typeof value, `${locale} is missing Theme.names.${id}`).toBe("string");
        expect(String(value).trim(), `${locale} has an empty Theme.names.${id}`).not.toBe("");
      }
      // A stale name left behind after a theme is removed would otherwise linger.
      expect(Object.keys(names).sort(), `${locale} names themes that are not registered`).toEqual(
        [...THEME_IDS].sort(),
      );
    }
  });

  it("mirrors every registry value in the matching globals.css theme block", () => {
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const blockFor = (marker: string) => {
      const at = css.indexOf(marker);
      if (at < 0) throw new Error(`globals.css is missing the ${marker} block`);
      const open = css.indexOf("{", at);
      const close = css.indexOf("\n}", open);
      if (open < 0 || close < 0) throw new Error(`globals.css has an unbalanced ${marker} block`);
      return css.slice(open, close);
    };
    const declared = (block: string) => {
      const out: Record<string, string> = {};
      for (const match of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
        const name = match[1];
        const value = match[2];
        if (name && value) out[name] = value.trim();
      }
      return out;
    };
    const expectedFor = (id: ThemeId) => {
      const theme = getTheme(id);
      const out: Record<string, string> = {};
      for (const key of Object.keys(THEME_TOKEN_CSS_VARS) as (keyof ThemeTokens)[]) {
        if (key === "series") {
          theme.tokens.series.forEach((value, index) => {
            out[seriesCssVar(index + 1)] = value;
          });
        } else {
          out[THEME_TOKEN_CSS_VARS[key]] = theme.tokens[key];
        }
      }
      for (const key of Object.keys(THEME_SHADOW_CSS_VARS) as (keyof ThemeShadows)[]) {
        out[THEME_SHADOW_CSS_VARS[key]] = theme.shadows[key];
      }
      return out;
    };
    const blocks: Record<ThemeId, string> = {
      light: blockFor('[data-theme="light"]'),
      dark: blockFor('[data-theme="dark"]'),
    };
    // Radius stays a shared, theme-independent variable.
    const shared = new Set(["--radius"]);
    for (const id of THEME_IDS) {
      const vars = declared(blocks[id]);
      const expected = expectedFor(id);
      for (const [name, value] of Object.entries(expected)) {
        expect(vars[name], `${name} missing from the ${id} block`).toBe(value);
      }
      const unknown = Object.keys(vars).filter((name) => !shared.has(name) && !(name in expected));
      expect(unknown, `tokens declared in CSS but not in the registry (${id})`).toEqual([]);
    }
  });

  it("keeps literal hex and functional colours out of components", () => {
    // Colours live in the registry (and, for print, in lib/export-theme.ts);
    // anything else must go through a token.
    //
    // Scope, stated precisely so nobody mistakes this for a full CSS colour
    // auditor. It catches: HEX, `rgb()/rgba()/hsl()/hsla()/oklch()/oklab()/
    // lab()/lch()/color()` written with literal channels, and `white` / `black`
    // used as a property value. It deliberately does NOT catch:
    //   - `rgb(var(--x))` and friends, which are token-driven by construction;
    //   - computed calls such as `rgb(color.r, ...)`;
    //   - colour keywords inside Tailwind class strings (`bg-white`), which are
    //     the sanctioned route for keyword colours;
    //   - `transparent` / `currentColor`, which are legitimate browser semantics.
    const src = fileURLToPath(new URL("../src", import.meta.url));
    const allowed = new Set([join("lib", "theme-registry.ts")]);
    const literal = new RegExp(
      [
        "#[0-9a-fA-F]{3,8}\\b",
        "\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\\(\\s*(?:[\\d.]|from\\b|srgb|display-p3|oklch)",
        "(?:color|fill|stroke|background|background-color|border-color)\\s*:\\s*[\"'](?:white|black)[\"']",
      ].join("|"),
    );
    const offenders: string[] = [];
    for (const entry of readdirSync(src, { recursive: true, encoding: "utf8" })) {
      if (!/\.(ts|tsx)$/.test(entry) || allowed.has(entry)) continue;
      readFileSync(join(src, entry), "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (literal.test(line)) offenders.push(`${entry}:${index + 1} ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
