"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-boot";

export type ColorMode = "system" | "light" | "dark";

type ThemeContextValue = {
  theme: ColorMode;
  setTheme: (mode: ColorMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

function applyMode(mode: ColorMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ColorMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const mode: ColorMode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    setThemeState(mode);
    applyMode(mode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onPref = () => {
      const current = window.localStorage.getItem(THEME_STORAGE_KEY) || "system";
      if (current === "system") applyMode("system");
    };
    media.addEventListener("change", onPref);
    return () => media.removeEventListener("change", onPref);
  }, []);

  const setTheme = useCallback((mode: ColorMode) => {
    setThemeState(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    applyMode(mode);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
