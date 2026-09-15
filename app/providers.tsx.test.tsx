import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from './providers';

const replace = jest.fn();
let pathname = '/profile';
let sessionState: { status: 'loading' | 'authenticated' | 'unauthenticated'; data?: unknown } = {
  status: 'authenticated',
  data: { user: { email: 'ada@example.com' } },
};

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => sessionState,
}));

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

describe('Providers session persistence', () => {
  beforeEach(() => {
    replace.mockClear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    pathname = '/profile';
    sessionState = {
      status: 'authenticated',
      data: { user: { email: 'ada@example.com' } },
    };
  });

  it('keeps authenticated users on protected pages when backend session is valid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', username: 'ada', email: 'ada@example.com' }),
    } as Response);

    render(
      <Providers>
        <p>Protected content</p>
      </Providers>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps authenticated users on project pages when backend session is valid', async () => {
    pathname = '/projects';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', username: 'ada', email: 'ada@example.com' }),
    } as Response);

    render(
      <Providers>
        <p>Project content</p>
      </Providers>,
    );

    expect(screen.getByText('Project content')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects authenticated users to login when the backend session is expired', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'missing_or_invalid_auth' }),
    } as Response);

    render(
      <Providers>
        <p>Protected content</p>
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('redirects authenticated users away from login pages', async () => {
    pathname = '/login';

    render(
      <Providers>
        <p>Login page</p>
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redirects authenticated users away from registration pages', async () => {
    pathname = '/register';

    render(
      <Providers>
        <p>Registration page</p>
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/profile'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users away from protected pages', async () => {
    sessionState = { status: 'unauthenticated', data: null };

    render(
      <Providers>
        <p>Protected content</p>
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users away from project pages', async () => {
    sessionState = { status: 'unauthenticated', data: null };
    pathname = '/projects';

    render(
      <Providers>
        <p>Project content</p>
      </Providers>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not redirect unauthenticated users on public auth pages', () => {
    sessionState = { status: 'unauthenticated', data: null };
    pathname = '/login';

    render(
      <Providers>
        <p>Login page</p>
      </Providers>,
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
