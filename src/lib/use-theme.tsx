import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemePref = Theme | "system";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePref;
  setPreference: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "theme-preference";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Inicializa sempre com "light" para que o HTML gerado no servidor
  // seja idêntico ao primeiro render do cliente (evita erros de hidratação
  // React #418/#419/#422). A preferência real é lida no useEffect abaixo.
  const [preference, setPreferenceState] = useState<ThemePref>("light");
  const [theme, setTheme] = useState<Theme>("light");

  // Hidrata a preferência salva depois da montagem no cliente.
  useEffect(() => {
    try {
      if (typeof localStorage === "undefined") return;
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePref | null;
      const pref = stored ?? "light";
      const resolved = pref === "system" ? getSystemTheme() : pref;
      setPreferenceState(pref);
      setTheme(resolved);
      applyTheme(resolved);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (preference === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        const t = mq.matches ? "dark" : "light";
        setTheme(t);
        applyTheme(t);
      };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [preference, theme]);

  const setPreference = (p: ThemePref) => {
    setPreferenceState(p);
    if (typeof localStorage !== "undefined") {
      if (p === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, p);
    }
    const resolved = p === "system" ? getSystemTheme() : p;
    setTheme(resolved);
    applyTheme(resolved);
  };

  const toggle = () => setPreference(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
