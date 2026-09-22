'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Contrast, Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme-preference';

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'system', label: 'System', Icon: Contrast },
];

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = THEME_OPTIONS.findIndex((option) => option.mode === mode);
    itemRefs.current[selectedIndex < 0 ? 0 : selectedIndex]?.focus();
  }, [open, mode]);

  function selectMode(next: ThemeMode) {
    setMode(next);
    writeStoredTheme(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (currentIndex + 1) % THEME_OPTIONS.length;
      itemRefs.current[next]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
      itemRefs.current[previous]?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      itemRefs.current[0]?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      itemRefs.current[THEME_OPTIONS.length - 1]?.focus();
    }
  }

  const activeOption = THEME_OPTIONS.find((option) => option.mode === mode) ?? THEME_OPTIONS[2];
  const ActiveIcon = activeOption.Icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${activeOption.label}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card p-0 text-foreground shadow-card hover:bg-muted"
      >
        <ActiveIcon size={18} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-border bg-card p-1 shadow-card"
        >
          {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }, index) => {
            const checked = optionMode === mode;
            return (
              <button
                key={optionMode}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => selectMode(optionMode)}
                className="flex w-full items-center gap-2 rounded-md bg-transparent px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                <Icon size={16} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {checked && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
