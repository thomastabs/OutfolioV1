import { createPublicProjectHandler } from '@/src/api/v1/public/project';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const project = {
  id: 'project-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  projectType: 'OutSystems',
  role: 'Developer',
  status: 'published',
  tags: ['portfolio'],
  coverImageUrl: '',
  problem: 'Exports miss the visual product.',
  features: 'Case study authoring.',
  technicalNotes: 'Next.js and Prisma.',
  contribution: 'Built the workflow.',
  outcome: 'Reusable portfolio entry.',
  visibility: 'PUBLISHED',
  publishedAt: new Date('2026-09-15T21:00:00.000Z'),
  owner: {
    username: 'ada',
    profile: {
      name: 'Ada Lovelace',
    },
  },
};

describe('GET /api/v1/public/project/:slug', () => {
  function setup(projectResult: typeof project | null = project) {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(projectResult),
      },
    };
    const handler = createPublicProjectHandler({ prisma });
    const res = mockResponse();

    return { prisma, handler, res };
  }

  it('returns published project data', async () => {
    const { prisma, handler, res } = setup();

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { slug: 'portfolio-builder' },
      include: {
        owner: {
          select: {
            username: true,
            profile: {
              select: { name: true },
            },
          },
        },
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      summary: 'A project documentation workspace.',
      projectType: 'OutSystems',
      role: 'Developer',
      status: 'published',
      tags: ['portfolio'],
      coverImageUrl: '',
      problem: 'Exports miss the visual product.',
      features: 'Case study authoring.',
      technicalNotes: 'Next.js and Prisma.',
      contribution: 'Built the workflow.',
      outcome: 'Reusable portfolio entry.',
      visibility: 'published',
      publishedAt: new Date('2026-09-15T21:00:00.000Z'),
      owner: {
        username: 'ada',
        name: 'Ada Lovelace',
      },
    });
  });

  it.each(['DRAFT', 'UNPUBLISHED'])('returns 403 for %s projects', async (visibility) => {
    const { handler, res } = setup({ ...project, visibility });

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_public',
      message: 'Project is not public.',
    });
  });

  it('normalizes optional empty project fields', async () => {
    const { handler, res } = setup({
      ...project,
      projectType: null,
      tags: null,
      coverImageUrl: null,
      problem: null,
      features: null,
      technicalNotes: null,
      contribution: null,
      outcome: null,
      owner: {
        username: 'ada',
        profile: null,
      },
    });

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      projectType: '',
      tags: [],
      coverImageUrl: '',
      problem: '',
      features: '',
      technicalNotes: '',
      contribution: '',
      outcome: '',
      owner: {
        username: 'ada',
        name: '',
      },
    }));
  });

  it('returns 404 when the project slug does not exist', async () => {
    const { handler, res } = setup(null);

    await handler({ params: { slug: 'missing-project' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });

  it('returns 404 when the slug param is missing', async () => {
    const { prisma, handler, res } = setup();

    await handler({ params: {} } as never, res as never);

    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });
});
