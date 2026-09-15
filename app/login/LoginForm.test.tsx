import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('renders username and password fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('shows validation errors when username or password fields are empty', async () => {
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(await screen.findByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('posts valid credentials and notifies success', async () => {
    const onLoggedIn = jest.fn();
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);

    render(<LoginForm onLoggedIn={onLoggedIn} />);
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ada',
        password: 'correct-password',
      }),
    });
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
  });

  it('displays invalid credentials errors from the API', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'invalid_credentials',
        message: 'Invalid username or password.',
      }),
    } as Response);

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument();
  });

  it('displays generic error messages for unexpected API errors', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'unexpected_failure',
        message: 'Could not log in.',
      }),
    } as Response);

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Could not log in.')).toBeInTheDocument();
  });

  it('shows loading state and prevents duplicate submits', async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => undefined;
    jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-password');

    const button = screen.getByRole('button', { name: /log in/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /logging in/i }));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
