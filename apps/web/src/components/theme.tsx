"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  colorSchemeFor,
  DEFAULT_THEME_ID,
  isThemeId,
  readThemeFromDom,
  THEME_CHANGE_EVENT,
  THEME_KEY,
  themePreference,
  type ColorScheme,
  type ThemeChangeDetail,
  type ThemeId,
} from "@/lib/theme";
import { getTheme, type ThemeDefinition } from "@/lib/theme-registry";
import { Button } from "./ui/button";

export interface ThemeContextValue {
  /** The active theme ID. Business components branch on tokens, never on this. */
  theme: ThemeId;
  /** The light/dark base, for third-party libraries that only understand two modes. */
  colorScheme: ColorScheme;
  /** True once the pre-paint result has been read back after hydration. */
  ready: boolean;
  /** The single entry point for anything that wants to change the theme. */
  setTheme: (theme: ThemeId) => void;
  /** Compatibility entry point for the binary toggle; not the only way in. */
  toggle: () => void;
  /** Non-blocking notice when the choice cannot be persisted. */
  error: string | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_ID,
  colorScheme: colorSchemeFor(DEFAULT_THEME_ID),
  ready: false,
  setTheme: () => {},
  toggle: () => {},
  error: null,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Theme");
  const [theme, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<ThemeId>(DEFAULT_THEME_ID);

  /** Write the DOM contract and tell imperative consumers. The only mutation path. */
  const commit = useCallback((next: ThemeId) => {
    const changed = current.current !== next;
    current.current = next;
    setThemeId(next);
    applyTheme(document.documentElement, next);
    if (changed)
      window.dispatchEvent(
        new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, {
          detail: { theme: next, colorScheme: colorSchemeFor(next) },
        }),
      );
  }, []);

  useEffect(() => {
    // Read the pre-paint result, including its storage-unavailable fallback.
    commit(readThemeFromDom(document.documentElement));
    setReady(true);
    const sync = (event: StorageEvent) => {
      // A null key means localStorage.clear(): fall back to the default theme.
      if (event.key !== THEME_KEY && event.key !== null) return;
      setError(null);
      commit(themePreference(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [commit]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      if (!isThemeId(next)) return;
      commit(next);
      try {
        localStorage.setItem(THEME_KEY, next);
        setError(null);
      } catch {
        // The page keeps the chosen theme; only persistence is unavailable.
        setError(t("saveError"));
      }
    },
    [commit, t],
  );

  const toggle = useCallback(
    () => setTheme(current.current === "dark" ? "light" : "dark"),
    [setTheme],
  );

  return (
    <ThemeContext.Provider
      value={{ theme, colorScheme: colorSchemeFor(theme), ready, setTheme, toggle, error }}
    >
      {children}
      {error && (
        <p
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-32px)] rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
        >
          {error}
        </p>
      )}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/** The full definition (base, display-name key, tokens, shadows) of the active theme. */
export const useThemeDefinition = (): ThemeDefinition => {
  const { theme } = useTheme();
  return getTheme(theme);
};

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const t = useTranslations("Theme");
  const { theme, ready, toggle } = useContext(ThemeContext);
  const label = theme === "dark" ? t("switchToLight") : t("switchToDark");
  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      className={
        iconOnly
          ? "h-9 w-9 shrink-0 rounded-lg"
          : "w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      }
      disabled={!ready}
      onClick={toggle}
      aria-label={label}
      title={iconOnly ? label : undefined}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {!iconOnly && (theme === "dark" ? t("lightMode") : t("darkMode"))}
    </Button>
  );
}
