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

function openMenu() {
  return screen.getByRole('button', { name: /Theme:/ });
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  it('renders a trigger button that opens a menu with the three theme options', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    expect(screen.queryByRole('menu', { name: 'Theme' })).not.toBeInTheDocument();

    await user.click(openMenu());

    const menu = screen.getByRole('menu', { name: 'Theme' });
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('Light'),
      expect.stringContaining('Dark'),
      expect.stringContaining('System'),
    ]);
    expect(menu).toBeInTheDocument();
  });

  it('defaults to system preference when no stored preference exists', async () => {
    mockMatchMedia(true);
    render(<ThemeSwitcher />);

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument();
  });

  it('restores a previously stored explicit preference on mount', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeSwitcher />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies the dark class immediately when the user selects Dark, and saves the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Dark/ }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('removes the dark class when the user selects Light, and saves the choice', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));

    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Light/ }));

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('marks the currently selected option as checked in the menu', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument());

    await user.click(openMenu());

    expect(screen.getByRole('menuitemradio', { name: /Dark/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /Light/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: /System/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('closes the menu and returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

    await user.click(openMenu());
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(openMenu()).toHaveFocus();
  });

  it('closes the menu when clicking outside it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ThemeSwitcher />
        <button type="button">outside</button>
      </div>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

    await user.click(openMenu());
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('updates the theme dynamically when the system preference changes while "system" is selected', async () => {
    const { fireChange } = mockMatchMedia(false);
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireChange(true);

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('does not react to system preference changes once an explicit theme is selected', async () => {
    const { fireChange } = mockMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Light/ }));
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

      await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

      await user.click(openMenu());
      await user.click(screen.getByRole('menuitemradio', { name: /Dark/ }));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it('settles on a single consistent theme when toggled rapidly (Phase 4 edge case)', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument());

    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Dark/ }));
    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Light/ }));
    await user.click(openMenu());
    await user.click(screen.getByRole('menuitemradio', { name: /Dark/ }));

    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
