import { createPublicProfileHandler } from '@/src/api/v1/profile/public';

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('GET /api/v1/profile/public/:username', () => {
  const user = {
    id: 'user-1',
    username: 'ada',
    profile: {
      userId: 'user-1',
      name: 'Ada Lovelace',
      bio: 'Builds rigorous developer tools.',
      experienceYears: 7,
      certifications: ['OutSystems Associate Reactive Developer'],
      links: ['https://example.com/ada'],
      visibility: 'PUBLIC',
    },
  };

  const projects = [
    {
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      summary: 'A project documentation workspace.',
    },
  ];

  function setup(overrides: Partial<Parameters<typeof createPublicProfileHandler>[0]> = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
      project: {
        findMany: jest.fn().mockResolvedValue(projects),
      },
    };
    const deps = { prisma, ...overrides };
    const handler = createPublicProfileHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('returns public profile data and published projects for public profiles', async () => {
    const { deps, handler, res } = setup();

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(deps.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'ada' },
      include: { profile: true },
    });
    expect(deps.prisma.project.findMany).toHaveBeenCalledWith({
      where: { ownerId: user.id, visibility: 'PUBLISHED' },
      select: { id: true, title: true, slug: true, summary: true },
      orderBy: { title: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      username: 'ada',
      profile: {
        userId: 'user-1',
        name: 'Ada Lovelace',
        bio: 'Builds rigorous developer tools.',
        experienceYears: 7,
        certifications: ['OutSystems Associate Reactive Developer'],
        links: ['https://example.com/ada'],
        visibility: 'public',
      },
      publishedProjects: projects,
    });
  });

  it('returns public profile data with an empty published project list', async () => {
    const { res, handler } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(user),
        },
        project: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as never);

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      publishedProjects: [],
    }));
  });

  it('requests only published projects for the public profile response', async () => {
    const { deps, handler, res } = setup();

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(deps.prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: user.id, visibility: 'PUBLISHED' },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      publishedProjects: projects,
    }));
  });

  it('returns 403 for unlisted profiles', async () => {
    const { handler, res } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            ...user,
            profile: { ...user.profile, visibility: 'UNLISTED' },
          }),
        },
        project: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as never);

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'profile_not_public',
      message: 'Profile is not public.',
    });
  });

  it('returns 403 for private profiles', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            ...user,
            profile: { ...user.profile, visibility: 'PRIVATE' },
          }),
        },
        project: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as never);

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(deps.prisma.project.findMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'profile_not_public',
      message: 'Profile is not public.',
    });
  });

  it('returns 404 when the username does not exist', async () => {
    const { handler, res } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        project: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as never);

    await handler({ params: { username: 'missing' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'not_found',
      message: 'Profile not found.',
    });
  });

  it('returns 404 when the user has no profile', async () => {
    const { handler, res } = setup({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ ...user, profile: null }),
        },
        project: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as never);

    await handler({ params: { username: 'ada' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'not_found',
      message: 'Profile not found.',
    });
  });
});
