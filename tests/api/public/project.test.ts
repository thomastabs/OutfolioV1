import { createPublicProjectHandler, createPublicProjectImagesHandler } from '@/src/api/v1/public/project';

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

describe('GET /api/v1/public/project/:slug/images', () => {
  const images = [
    { id: 'image-2', projectId: 'project-1', url: 'data:image/jpeg;base64,two', order: 0 },
    { id: 'image-1', projectId: 'project-1', url: 'data:image/png;base64,one', order: 1 },
  ];

  function setup(projectResult: { id: string; visibility: string } | null = { id: 'project-1', visibility: 'PUBLISHED' }) {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(projectResult),
      },
      projectImage: {
        findMany: jest.fn().mockResolvedValue(images),
      },
    };
    const handler = createPublicProjectImagesHandler({ prisma });
    const res = mockResponse();

    return { prisma, handler, res };
  }

  it('returns ordered images for published projects', async () => {
    const { prisma, handler, res } = setup();

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { slug: 'portfolio-builder' },
    });
    expect(prisma.projectImage.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      orderBy: { order: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: [
        { id: 'image-2', url: 'data:image/jpeg;base64,two', order: 0 },
        { id: 'image-1', url: 'data:image/png;base64,one', order: 1 },
      ],
    });
  });

  it('returns 403 for unpublished projects', async () => {
    const { prisma, handler, res } = setup({ id: 'project-1', visibility: 'DRAFT' });

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(prisma.projectImage.findMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_public',
      message: 'Project is not public.',
    });
  });

  it('returns 404 when the project is missing', async () => {
    const { prisma, handler, res } = setup(null);

    await handler({ params: { slug: 'missing-project' } } as never, res as never);

    expect(prisma.projectImage.findMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });

  it('returns images with duplicate order values without erroring', async () => {
    const { prisma, handler, res } = setup();
    prisma.projectImage.findMany.mockResolvedValue([
      { id: 'image-1', projectId: 'project-1', url: 'data:image/png;base64,one', order: 0 },
      { id: 'image-2', projectId: 'project-1', url: 'data:image/png;base64,two', order: 0 },
    ]);

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: [
        { id: 'image-1', url: 'data:image/png;base64,one', order: 0 },
        { id: 'image-2', url: 'data:image/png;base64,two', order: 0 },
      ],
    });
  });

  it('returns an image with an empty url field as-is rather than filtering it out', async () => {
    const { prisma, handler, res } = setup();
    prisma.projectImage.findMany.mockResolvedValue([
      { id: 'image-1', projectId: 'project-1', url: '', order: 0 },
    ]);

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: [{ id: 'image-1', url: '', order: 0 }],
    });
  });

  it('returns all images for a project with a large gallery', async () => {
    const { prisma, handler, res } = setup();
    const manyImages = Array.from({ length: 20 }, (_, index) => ({
      id: `image-${index}`,
      projectId: 'project-1',
      url: `data:image/png;base64,img${index}`,
      order: index,
    }));
    prisma.projectImage.findMany.mockResolvedValue(manyImages);

    await handler({ params: { slug: 'portfolio-builder' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: manyImages.map(({ id, url, order }) => ({ id, url, order })),
    });
  });
});
