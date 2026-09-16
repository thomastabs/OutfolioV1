import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationForm } from './RegistrationForm';

describe('RegistrationForm', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('renders name, username, email, and password fields', () => {
    render(<RegistrationForm />);

    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('prevents submission and displays client-side validation errors', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const user = userEvent.setup();

    render(<RegistrationForm />);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('posts valid form data and notifies success', async () => {
    const onRegistered = jest.fn();
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);

    render(<RegistrationForm onRegistered={onRegistered} />);
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ada Lovelace',
        username: 'ada',
        email: 'ada@example.com',
        password: 'correct-horse-battery-staple',
      }),
    });
    await waitFor(() => expect(onRegistered).toHaveBeenCalled());
  });

  it('displays duplicate username or email API errors', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'duplicate_username_or_email',
        message: 'Username or email is already in use.',
      }),
    } as Response);

    render(<RegistrationForm />);
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Username or email is already in use.')).toBeInTheDocument();
  });

  it('displays server-side validation field errors', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'validation_error',
        message: 'Registration input is invalid.',
        fields: {
          email: 'Email is already reserved for review.',
        },
      }),
    } as Response);

    render(<RegistrationForm />);
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Registration input is invalid.')).toBeInTheDocument();
    expect(screen.getByText('Email is already reserved for review.')).toBeInTheDocument();
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

    render(<RegistrationForm />);
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/^username$/i), 'ada');
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery-staple');

    const button = screen.getByRole('button', { name: /create account/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /creating account/i }));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      json: async () => ({ userId: 'user-1', session: { expiresAt: '2026-10-15T12:00:00.000Z' } }),
    } as Response);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
