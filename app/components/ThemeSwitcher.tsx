'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme-preference';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage disabled/unavailable (e.g. private browsing) - the
    // theme still applies for this page view, it just won't persist.
  }
}

function prefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeSwitcher() {
  // Starts as 'system' on both server and the client's first render, so
  // hydration never mismatches - the real stored preference (already
  // applied to <html> before paint by the inline script in layout.tsx)
  // is only read after mount, in the effect below.
  const [mode, setMode] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setMode(isThemeMode(stored) ? stored : 'system');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(mode);
  }, [mode, mounted]);

  useEffect(() => {
    if (mode !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mode]);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isThemeMode(next)) return;

    setMode(next);
    writeStoredTheme(next);
  }

  return (
    <div className="grid gap-1">
      <label className="visually-hidden" htmlFor="theme-switcher">Theme</label>
      <select
        id="theme-switcher"
        className="pr-6"
        value={mode}
        onChange={handleChange}
      >
        <option value="light">Light 𖤓</option>
        <option value="dark">Dark ☾</option>
        <option value="system">System ◐</option>
      </select>
    </div>
  );
}
