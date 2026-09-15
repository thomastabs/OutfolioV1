import { createLogoutHandler } from '@/src/api/v1/auth/logout';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/src/lib/session';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('POST /api/v1/auth/logout', () => {
  function setup(overrides: Partial<Parameters<typeof createLogoutHandler>[0]> = {}) {
    const validateSession = jest.fn().mockReturnValue({
      valid: true,
      userId: 'user-1',
      expiresAt: '2026-10-15T12:00:00.000Z',
    });
    const clearSession = jest.fn();
    const deps = { validateSession, clearSession, ...overrides };
    const handler = createLogoutHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('clears the session cookie and returns success for a valid session', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: `${SESSION_COOKIE_NAME}=valid` } } as never, res as never);

    expect(deps.validateSession).toHaveBeenCalled();
    expect(deps.clearSession).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 401 when session is missing or invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    });

    await handler({ headers: {} } as never, res as never);

    expect(deps.clearSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('clears the session cookie and returns success for an expired session', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'expired' }),
    });

    await handler({ headers: { cookie: `${SESSION_COOKIE_NAME}=expired` } } as never, res as never);

    expect(deps.clearSession).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on unexpected failures', async () => {
    const { handler, res } = setup({
      validateSession: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    });

    await handler({ headers: { cookie: `${SESSION_COOKIE_NAME}=valid` } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unexpected_failure',
      message: 'Could not log out.',
    });
  });

  it('uses the session cookie clearing options from session management', () => {
    expect(sessionCookieOptions(new Date('2026-09-15T12:00:00.000Z'))).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
