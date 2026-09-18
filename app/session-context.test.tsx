import { render, screen, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from './session-context';

function StatusProbe() {
  const { status, data, update } = useSession();

  return (
    <div>
      <p>status: {status}</p>
      <p>username: {data?.user.username ?? 'none'}</p>
      <button onClick={() => update()}>refresh</button>
    </div>
  );
}

describe('SessionProvider / useSession', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('resolves to authenticated using the real /api/v1/auth/session endpoint', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'user-1', username: 'ada', email: 'ada@example.com' }),
    } as Response);

    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );

    expect(screen.getByText('status: loading')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/session');
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
    expect(screen.getByText('username: ada')).toBeInTheDocument();
  });

  it('resolves to unauthenticated when the session endpoint returns 401', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'missing_or_invalid_auth' }),
    } as Response);

    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
  });

  it('resolves to unauthenticated when the session request fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
  });

  it('re-fetches the session and updates status when update() is called', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'missing_or_invalid_auth' }),
    } as Response);
    global.fetch = fetchMock;

    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userId: 'user-1', username: 'ada', email: 'ada@example.com' }),
    } as Response);

    screen.getByText('refresh').click();

    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when useSession is used outside a SessionProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<StatusProbe />)).toThrow('useSession must be used within a SessionProvider');

    consoleError.mockRestore();
  });
});
