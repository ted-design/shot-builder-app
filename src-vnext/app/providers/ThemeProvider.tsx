import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
  readonly toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem("theme")
    if (stored === "dark" || stored === "light") return stored
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark"
  } catch {
    // localStorage unavailable
  }
  return "light"
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem("theme", next)
    } catch {
      // localStorage unavailable
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
