import { createRegisterHandler } from '@/src/api/v1/auth/register';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('POST /api/v1/auth/register', () => {
  const validBody = {
    name: 'Ada Lovelace',
    username: 'ada',
    email: 'ada@example.com',
    password: 'correct-horse-battery-staple',
  };

  function setup(overrides: Partial<Parameters<typeof createRegisterHandler>[0]> = {}) {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: data.id,
            username: data.username,
            email: data.email,
            createdAt: data.createdAt,
          }),
        ),
      },
    };
    const supabase = {
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: { id: 'supabase-user-1', email: validBody.email } },
          error: null,
        }),
      },
    };
    const establishSession = jest.fn().mockResolvedValue({
      expiresAt: '2026-10-15T12:00:00.000Z',
    });

    const deps = { prisma, supabase, establishSession, ...overrides };
    const handler = createRegisterHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('creates a new user account and returns user and session info', async () => {
    const { deps, handler, res } = setup();

    await handler({ body: validBody } as never, res as never);

    expect(deps.prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ username: validBody.username }, { email: validBody.email }],
      },
    });
    expect(deps.supabase.auth.signUp).toHaveBeenCalledWith({
      email: validBody.email,
      password: validBody.password,
      options: {
        data: {
          name: validBody.name,
          username: validBody.username,
        },
      },
    });
    expect(deps.prisma.user.create).toHaveBeenCalledWith({
      data: {
        id: 'supabase-user-1',
        username: validBody.username,
        email: validBody.email,
        createdAt: expect.any(Date),
      },
    });
    expect(deps.establishSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'supabase-user-1', username: validBody.username }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: 'supabase-user-1',
      username: validBody.username,
      email: validBody.email,
      createdAt: expect.any(String),
      session: { expiresAt: '2026-10-15T12:00:00.000Z' },
    });
  });

  it('rejects duplicate username or email without creating an account', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-user' }),
          create: jest.fn(),
        },
      },
    } as never);

    await handler({ body: validBody } as never, res as never);

    expect(deps.supabase.auth.signUp).not.toHaveBeenCalled();
    expect(deps.prisma.user.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'duplicate_username_or_email',
      message: 'Username or email is already in use.',
    });
  });

  it('rejects missing required fields and invalid email format', async () => {
    const { deps, handler, res } = setup();

    await handler(
      {
        body: {
          name: '',
          username: '',
          email: 'not-an-email',
          password: '',
        },
      } as never,
      res as never,
    );

    expect(deps.supabase.auth.signUp).not.toHaveBeenCalled();
    expect(deps.prisma.user.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'malformed_input',
      message: 'Registration input is invalid.',
      fields: {
        name: 'Name is required.',
        username: 'Username is required.',
        email: 'Enter a valid email address.',
        password: 'Password is required.',
      },
    });
  });
});
