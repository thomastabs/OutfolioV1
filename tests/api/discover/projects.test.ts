import { createDiscoverProjectsHandler } from '@/src/api/v1/discover/projects';

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
    slug: 'portfolio-builder',
    summary: 'A project documentation workspace.',
    projectType: 'OutSystems',
    visibility: 'PUBLISHED',
    owner: {
      username: 'ada',
      profile: {
        name: 'Ada Lovelace',
      },
    },
  },
  {
    id: 'project-2',
    title: 'API Case Study',
    slug: 'api-case-study',
    summary: 'Reusable API documentation.',
    projectType: 'Next.js',
    visibility: 'PUBLISHED',
    owner: {
      username: 'grace',
      profile: null,
    },
  },
];

describe('GET /api/v1/discover/projects', () => {
  function setup(projects = publishedProjects) {
    const prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue(projects),
      },
    };
    const handler = createDiscoverProjectsHandler({ prisma });
    const res = mockResponse();

    return { prisma, handler, res };
  }

  it('returns published project summaries with developer names', async () => {
    const { prisma, handler, res } = setup();

    await handler({ query: {} } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { visibility: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        owner: {
          select: {
            username: true,
            profile: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { title: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      projects: [
        {
          id: 'project-1',
          title: 'Portfolio Builder',
          slug: 'portfolio-builder',
          summary: 'A project documentation workspace.',
          developerName: 'Ada Lovelace',
        },
        {
          id: 'project-2',
          title: 'API Case Study',
          slug: 'api-case-study',
          summary: 'Reusable API documentation.',
          developerName: 'grace',
        },
      ],
    });
  });

  it('returns an empty list when no published projects exist', async () => {
    const { handler, res } = setup([]);

    await handler({ query: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ projects: [] });
  });

  it('filters by project type while keeping only published projects', async () => {
    const { prisma, handler, res } = setup([publishedProjects[0]]);

    await handler({ query: { projectType: 'OutSystems' } } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        visibility: 'PUBLISHED',
        projectType: 'OutSystems',
      },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      projects: [
        {
          id: 'project-1',
          title: 'Portfolio Builder',
          slug: 'portfolio-builder',
          summary: 'A project documentation workspace.',
          developerName: 'Ada Lovelace',
        },
      ],
    });
  });

  it('returns an empty list when the project type filter has no matches', async () => {
    const { prisma, handler, res } = setup([]);

    await handler({ query: { projectType: 'Mobile' } } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        visibility: 'PUBLISHED',
        projectType: 'Mobile',
      },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ projects: [] });
  });

  it('searches by keyword in title or summary case-insensitively', async () => {
    const { prisma, handler } = setup([publishedProjects[1]]);

    await handler({ query: { keyword: 'api' } } as never, mockResponse() as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        visibility: 'PUBLISHED',
        OR: [
          { title: { contains: 'api', mode: 'insensitive' } },
          { summary: { contains: 'api', mode: 'insensitive' } },
        ],
      },
    }));
  });

  it('returns an empty list when keyword search has no matches', async () => {
    const { prisma, handler, res } = setup([]);

    await handler({ query: { keyword: 'missing' } } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        visibility: 'PUBLISHED',
        OR: [
          { title: { contains: 'missing', mode: 'insensitive' } },
          { summary: { contains: 'missing', mode: 'insensitive' } },
        ],
      },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ projects: [] });
  });

  it('combines project type and keyword filters', async () => {
    const { prisma, handler } = setup([publishedProjects[0]]);

    await handler({ query: { projectType: 'OutSystems', keyword: 'portfolio' } } as never, mockResponse() as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        visibility: 'PUBLISHED',
        projectType: 'OutSystems',
        OR: [
          { title: { contains: 'portfolio', mode: 'insensitive' } },
          { summary: { contains: 'portfolio', mode: 'insensitive' } },
        ],
      },
    }));
  });
});
