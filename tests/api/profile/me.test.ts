import { createProfileMeHandler } from '@/src/api/v1/profile/me';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('GET /api/v1/profile/me', () => {
  const profile = {
    userId: 'user-1',
    name: 'Ada Lovelace',
    bio: 'Builds rigorous developer tools.',
    experienceYears: 7,
    certifications: ['OutSystems Associate Reactive Developer'],
    links: ['https://example.com/ada'],
    visibility: 'PUBLIC',
  };

  function setup(overrides: Partial<Parameters<typeof createProfileMeHandler>[0]> = {}) {
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
    };
    const validateSession = jest.fn().mockReturnValue({
      valid: true,
      userId: profile.userId,
      username: 'ada',
      email: 'ada@example.com',
      expiresAt: '2026-10-15T12:00:00.000Z',
    });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createProfileMeHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('returns profile data for a valid session and existing profile', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(deps.validateSession).toHaveBeenCalledWith(expect.objectContaining({ headers: { cookie: 'next-auth.session-token=valid' } }));
    expect(deps.prisma.profile.findUnique).toHaveBeenCalledWith({ where: { userId: profile.userId } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: profile.userId,
      name: profile.name,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      certifications: profile.certifications,
      links: profile.links,
      visibility: 'public',
    });
  });

  it('returns empty-safe profile fields when nullable values are missing', async () => {
    const { handler, res } = setup({
      prisma: {
        profile: {
          findUnique: jest.fn().mockResolvedValue({
            userId: profile.userId,
            name: null,
            bio: null,
            experienceYears: null,
            certifications: null,
            links: null,
            visibility: null,
          }),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      userId: profile.userId,
      name: '',
      bio: '',
      experienceYears: 0,
      certifications: [],
      links: [],
      visibility: 'private',
    });
  });

  it('returns 404 when the authenticated user has no profile', async () => {
    const { handler, res } = setup({
      prisma: {
        profile: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'not_found',
      message: 'Profile not found.',
    });
  });

  it('returns 401 when the session is missing or invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {} } as never, res as never);

    expect(deps.prisma.profile.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('returns 500 on unexpected server errors', async () => {
    const { handler, res } = setup({
      prisma: {
        profile: {
          findUnique: jest.fn().mockRejectedValue(new Error('database unavailable')),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unexpected_failure',
      message: 'Could not retrieve the profile.',
    });
  });
});
