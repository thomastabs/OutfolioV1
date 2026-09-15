import { createLoginHandler } from './login';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('POST /api/v1/auth/login', () => {
  const existingUser = {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    createdAt: new Date('2026-09-15T12:00:00.000Z'),
  };

  function setup(overrides: Partial<Parameters<typeof createLoginHandler>[0]> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(existingUser),
      },
    };
    const supabase = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: existingUser.id, email: existingUser.email } },
          error: null,
        }),
      },
    };
    const establishSession = jest.fn().mockResolvedValue({
      expiresAt: '2026-10-15T12:00:00.000Z',
    });

    const deps = { prisma, supabase, establishSession, ...overrides };
    const handler = createLoginHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('returns user info and session expiration for valid credentials', async () => {
    const { deps, handler, res } = setup();

    await handler({ body: { username: 'ada', password: 'correct-password' } } as never, res as never);

    expect(deps.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'ada' },
    });
    expect(deps.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: existingUser.email,
      password: 'correct-password',
    });
    expect(deps.establishSession).toHaveBeenCalledWith(existingUser, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: existingUser.id,
      username: existingUser.username,
      email: existingUser.email,
      session: { expiresAt: '2026-10-15T12:00:00.000Z' },
    });
  });

  it('returns invalid credentials for an incorrect password', async () => {
    const { deps, handler, res } = setup({
      supabase: {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid login credentials' },
          }),
        },
      },
    } as never);

    await handler({ body: { username: 'ada', password: 'wrong-password' } } as never, res as never);

    expect(deps.establishSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_credentials',
      message: 'Invalid username or password.',
    });
  });

  it('returns invalid credentials for a non-existent username without creating a session', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    } as never);

    await handler({ body: { username: 'missing', password: 'correct-password' } } as never, res as never);

    expect(deps.supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(deps.establishSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_credentials',
      message: 'Invalid username or password.',
    });
  });

  it('returns malformed input for missing or empty username or password', async () => {
    const { deps, handler, res } = setup();

    await handler({ body: { username: '', password: '' } } as never, res as never);

    expect(deps.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'malformed_input',
      message: 'Login input is invalid.',
      fields: {
        username: 'Username is required.',
        password: 'Password is required.',
      },
    });
  });
});
