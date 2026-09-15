import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './page';

const replace = jest.fn();
const update = jest.fn();
let sessionState: { status: 'loading' | 'authenticated' | 'unauthenticated'; data?: unknown } = {
  status: 'unauthenticated',
  data: null,
};

jest.mock('next-auth/react', () => ({
  useSession: () => ({ ...sessionState, update }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('RegisterPage redirect behavior', () => {
  beforeEach(() => {
    replace.mockClear();
    update.mockReset();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    sessionState = { status: 'unauthenticated', data: null };
  });

  it('redirects authenticated users to /profile', async () => {
    sessionState = { status: 'authenticated', data: { user: { email: 'ada@example.com' } } };

    render(<RegisterPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
  });

  it('shows a loading state while the session is being determined', () => {
    sessionState = { status: 'loading', data: null };

    render(<RegisterPage />);

    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the registration form when no session exists', () => {
    render(<RegisterPage />);

    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /profile after successful registration', async () => {
    const user = userEvent.setup();
    update.mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);

    render(<RegisterPage />);
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/profile');
  });
});
