import { createHomeDashboardHandler } from '@/src/api/v1/home/dashboard';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const publishedProjects = [
  {
    id: 'project-1',
    title: 'Portfolio Builder',
    summary: 'A documentation workspace for portfolio projects.',
    coverImageUrl: 'https://example.com/portfolio-cover.png',
  },
  {
    id: 'project-2',
    title: 'Case Study API',
    summary: 'A public project API case study.',
    coverImageUrl: '',
  },
];

describe('GET /api/v1/home/dashboard', () => {
  function setup(options: {
    projects?: typeof publishedProjects;
    session?: { valid: true; username: string } | { valid: false; reason: string };
    rejectProjects?: boolean;
  } = {}) {
    const prisma = {
      project: {
        findMany: jest.fn().mockImplementation(() => {
          if (options.rejectProjects) {
            return Promise.reject(new Error('database unavailable'));
          }

          return Promise.resolve(options.projects ?? publishedProjects);
        }),
      },
    };
    const validateSession = jest.fn().mockReturnValue(options.session ?? { valid: false, reason: 'missing' });
    const handler = createHomeDashboardHandler({ prisma, validateSession });
    const res = mockResponse();

    return { prisma, validateSession, handler, res };
  }

  it('returns product identity, project highlights, and unauthenticated session state', async () => {
    const { prisma, handler, res } = setup();

    await handler({ headers: {} } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { visibility: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        summary: true,
        coverImageUrl: true,
      },
      orderBy: { title: 'asc' },
      take: 3,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      productName: 'Outfolio',
      valueProposition: 'Create a public developer portfolio with polished project case studies.',
      publishedProjects,
      session: {
        authenticated: false,
      },
    });
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({
      username: expect.any(String),
      userId: expect.any(String),
      email: expect.any(String),
    }));
  });

  it('returns authenticated session state with username when a valid session exists', async () => {
    const { handler, res } = setup({
      session: {
        valid: true,
        username: 'ada',
      },
    });

    await handler({ headers: { cookie: 'next-auth.session-token=value' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      session: {
        authenticated: true,
        username: 'ada',
      },
    }));
  });

  it('returns an empty publishedProjects list when no published projects exist', async () => {
    const { handler, res } = setup({ projects: [] });

    await handler({ headers: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      publishedProjects: [],
    }));
  });

  it('returns 500 on unexpected failures', async () => {
    const { handler, res } = setup({ rejectProjects: true });

    await handler({ headers: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unexpected_failure',
      message: 'Could not load the home dashboard.',
    });
  });
});
