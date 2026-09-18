import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';

const replace = jest.fn();
const update = jest.fn();
let sessionState: { status: 'loading' | 'authenticated' | 'unauthenticated'; data?: unknown } = {
  status: 'unauthenticated',
  data: null,
};

jest.mock('../session-context', () => ({
  useSession: () => ({ ...sessionState, update }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, back: jest.fn() }),
}));

describe('LoginPage redirect behavior', () => {
  beforeEach(() => {
    replace.mockClear();
    update.mockReset();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    sessionState = { status: 'unauthenticated', data: null };
  });

  it('redirects authenticated users to /profile', async () => {
    sessionState = { status: 'authenticated', data: { user: { email: 'ada@example.com' } } };

    render(<LoginPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  });

  it('shows a loading state while authentication status is being determined', () => {
    sessionState = { status: 'loading', data: null };

    render(<LoginPage />);

    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log in/i })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the login form only when the user is unauthenticated', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /profile after successful login', async () => {
    const user = userEvent.setup();
    update.mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);

    render(<LoginPage />);
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/profile');
  });
});
