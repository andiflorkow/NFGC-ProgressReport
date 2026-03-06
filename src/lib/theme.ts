export const THEME_MODE_KEY = 'nfgcThemeMode'

export type ThemeMode = 'auto' | 'light'

export function readThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  return localStorage.getItem(THEME_MODE_KEY) === 'light' ? 'light' : 'auto'
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') {
    return
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const useDark = mode === 'auto' && prefersDark
  document.documentElement.classList.toggle('dark', useDark)
}
