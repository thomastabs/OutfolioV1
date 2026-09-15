import { createSessionHandler } from '@/src/api/v1/auth/session';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('GET /api/v1/auth/session', () => {
  const user = {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  function setup(overrides: Partial<Parameters<typeof createSessionHandler>[0]> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    };
    const validateSession = jest.fn().mockReturnValue({
      valid: true,
      userId: user.id,
      expiresAt: '2026-10-15T12:00:00.000Z',
    });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createSessionHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('returns user session info for a valid session cookie', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(deps.validateSession).toHaveBeenCalledWith(expect.objectContaining({ headers: { cookie: 'next-auth.session-token=valid' } }));
    expect(deps.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: user.id } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: user.id,
      username: user.username,
      email: user.email,
    });
  });

  it('returns 401 when the session cookie is missing', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {} } as never, res as never);

    expect(deps.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('returns 401 when the session is invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'invalid' }),
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=invalid' } } as never, res as never);

    expect(deps.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('returns 401 when the session is expired', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'expired' }),
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=expired' } } as never, res as never);

    expect(deps.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('returns 500 on unexpected server errors', async () => {
    const { handler, res } = setup({
      validateSession: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unexpected_failure',
      message: 'Could not retrieve the session.',
    });
  });
});
