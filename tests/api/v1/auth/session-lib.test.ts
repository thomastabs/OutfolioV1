import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  establishRegistrationSession,
  sessionCookieOptions,
  validateSession,
} from '@/src/lib/session';

function mockResponse() {
  const res = {
    cookie: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('session management utilities', () => {
  const now = new Date('2026-09-16T12:00:00.000Z');
  const realDateNow = Date.now;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-session-secret';
    Date.now = jest.fn(() => now.getTime());
  });

  afterEach(() => {
    Date.now = realDateNow;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_URL;
    jest.restoreAllMocks();
  });

  it('sets a signed NextAuth session cookie and validates it', async () => {
    const res = mockResponse();

    const session = await establishRegistrationSession(
      {
        id: 'user-1',
        username: 'ada',
        email: 'ada@example.com',
      },
      res as never,
    );

    const expectedExpiresAt = '2026-10-16T12:00:00.000Z';
    expect(session).toEqual({ expiresAt: expectedExpiresAt });
    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: new Date(expectedExpiresAt),
      }),
    );

    const token = res.cookie.mock.calls[0][1] as string;
    const result = validateSession(
      {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        },
      },
      now,
    );

    expect(result).toEqual({
      valid: true,
      userId: 'user-1',
      username: 'ada',
      email: 'ada@example.com',
      expiresAt: expectedExpiresAt,
    });
  });

  it('rejects missing, malformed, tampered, and expired session cookies', async () => {
    const res = mockResponse();
    await establishRegistrationSession(
      {
        id: 'user-1',
        username: 'ada',
        email: 'ada@example.com',
      },
      res as never,
    );
    const token = res.cookie.mock.calls[0][1] as string;
    const [payload] = token.split('.');

    expect(validateSession({ headers: {} }, now)).toEqual({ valid: false, reason: 'missing' });
    expect(validateSession({ headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-token` } }, now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
    expect(validateSession({ headers: { cookie: `${SESSION_COOKIE_NAME}=${payload}.tampered` } }, now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
    expect(
      validateSession(
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
          },
        },
        new Date('2026-10-16T12:00:00.001Z'),
      ),
    ).toEqual({ valid: false, reason: 'expired' });
  });

  it('clears the session cookie using the session cookie options', () => {
    const res = mockResponse();

    clearSessionCookie(res as never);

    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, '', sessionCookieOptions(new Date(0)));
  });

  it('marks the session cookie Secure only when NEXTAUTH_URL is HTTPS, not by NODE_ENV', () => {
    // `next start` always sets NODE_ENV to 'production', including in the
    // E2E CI environment, which serves the app over plain HTTP. A Secure
    // flag keyed off NODE_ENV would mark the cookie Secure there too, and
    // WebKit (unlike Chromium) refuses to send a Secure cookie back over
    // HTTP even on localhost, breaking every "authenticated" request.
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    expect(sessionCookieOptions(new Date(0)).secure).toBe(false);

    process.env.NEXTAUTH_URL = 'https://outfolio-v1.vercel.app';
    expect(sessionCookieOptions(new Date(0)).secure).toBe(true);

    delete process.env.NEXTAUTH_URL;
    expect(sessionCookieOptions(new Date(0)).secure).toBe(false);
  });
});
