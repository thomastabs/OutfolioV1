import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_STORAGE_KEY, ThemeSwitcher } from './ThemeSwitcher';

function mockMatchMedia(matches: boolean) {
  let listeners: Array<(event: { matches: boolean }) => void> = [];
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener);
    },
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
      listeners = listeners.filter((registered) => registered !== listener);
    },
  };
  window.matchMedia = jest.fn().mockReturnValue(mql);
  return {
    fireChange: (nextMatches: boolean) => {
      mql.matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches }));
    },
  };
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  it('renders the three accessible theme options', () => {
    render(<ThemeSwitcher />);

    const select = screen.getByLabelText('Theme') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual(['light', 'dark', 'system']);
  });

  it('defaults to system preference when no stored preference exists', async () => {
    mockMatchMedia(true);
    render(<ThemeSwitcher />);

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(screen.getByLabelText('Theme')).toHaveValue('system');
  });

  it('restores a previously stored explicit preference on mount', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeSwitcher />);

    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies the dark class immediately when the user selects Dark, and saves the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'));

    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes the dark class when the user selects Light, and saves the choice', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));

    await user.selectOptions(screen.getByLabelText('Theme'), 'light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('updates the theme dynamically when the system preference changes while "system" is selected', async () => {
    const { fireChange } = mockMatchMedia(false);
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireChange(true);

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('does not react to system preference changes once an explicit theme is selected', async () => {
    const { fireChange } = mockMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'));

    await user.selectOptions(screen.getByLabelText('Theme'), 'light');
    fireChange(true);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('still renders and applies a theme when localStorage is disabled/unavailable (Phase 4 edge case)', async () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError');
    });
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError');
    });

    try {
      const user = userEvent.setup();
      render(<ThemeSwitcher />);

      await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'));

      await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it('settles on a single consistent theme when toggled rapidly (Phase 4 edge case)', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByLabelText('Theme')).toHaveValue('system'));

    const select = screen.getByLabelText('Theme');
    await user.selectOptions(select, 'dark');
    await user.selectOptions(select, 'light');
    await user.selectOptions(select, 'dark');

    expect(select).toHaveValue('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
