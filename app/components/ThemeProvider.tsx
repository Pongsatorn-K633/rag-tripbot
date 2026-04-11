'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('dopamichi-theme')
  if (stored === 'dark' || stored === 'light') return stored
  // Default to light — dark mode is opt-in via Settings only.
  // We intentionally do NOT auto-detect OS dark mode preference
  // because the dark theme still needs UI polish on some pages.
  return 'light'
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const mountedRef = useRef(false)

  // Apply class to <html> on mount and whenever theme changes.
  // Using a ref instead of state for `mounted` avoids the lint warning
  // about calling setState inside an effect.
  useEffect(() => {
    mountedRef.current = true
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('dopamichi-theme', theme)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
