import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  readonly theme: Theme
  readonly effective: "light" | "dark"
  readonly setTheme: (theme: Theme) => void
  readonly toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "sb:theme"

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemPreference()
  return theme
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored
    }
    // Migrate from old "theme" key if present
    const legacy = localStorage.getItem("theme")
    if (legacy === "dark" || legacy === "light") {
      localStorage.setItem(STORAGE_KEY, legacy)
      localStorage.removeItem("theme")
      return legacy
    }
  } catch {
    // localStorage unavailable
  }
  return "light"
}

function applyClass(effective: "light" | "dark") {
  document.documentElement.classList.toggle("dark", effective === "dark")
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [effective, setEffective] = useState<"light" | "dark">(() =>
    resolveEffective(theme),
  )

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(effective === "dark" ? "light" : "dark")
  }, [effective, setTheme])

  // Apply .dark class whenever theme changes
  useEffect(() => {
    const next = resolveEffective(theme)
    setEffective(next)
    applyClass(next)
  }, [theme])

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    function onChange() {
      const next = mql.matches ? "dark" : "light"
      setEffective(next)
      applyClass(next)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, effective, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return ctx
}
