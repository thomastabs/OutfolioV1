import { createProjectPublishHandler } from '@/src/api/v1/projects/publish';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const draftProject = {
  id: 'project-1',
  ownerId: 'user-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  role: 'Developer',
  status: 'draft',
  visibility: 'DRAFT',
  publishedAt: null,
};

describe('POST /api/v1/projects/:id/publish', () => {
  function setup(overrides: Partial<Parameters<typeof createProjectPublishHandler>[0]> = {}) {
    const publishedProject = {
      ...draftProject,
      visibility: 'PUBLISHED',
      publishedAt: new Date('2026-09-15T21:00:00.000Z'),
    };
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(draftProject),
        update: jest.fn().mockResolvedValue(publishedProject),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const now = jest.fn().mockReturnValue(new Date('2026-09-15T21:00:00.000Z'));
    const deps = { prisma, validateSession, now, ...overrides };
    const handler = createProjectPublishHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('publishes an owned draft project with complete required fields', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        visibility: 'PUBLISHED',
        publishedAt: new Date('2026-09-15T21:00:00.000Z'),
        updatedAt: new Date('2026-09-15T21:00:00.000Z'),
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      status: 'draft',
      visibility: 'published',
      publishedAt: new Date('2026-09-15T21:00:00.000Z'),
    }));
  });

  it('returns 422 when required publishing fields are incomplete', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            ...draftProject,
            title: '',
            summary: '',
            role: '',
            status: '',
          }),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'validation_failed',
      message: 'Project cannot be published yet.',
      fields: expect.objectContaining({
        title: 'Title is required before publishing.',
        summary: 'Summary is required before publishing.',
        role: 'Role is required before publishing.',
        status: 'Status is required before publishing.',
      }),
    });
  });

  it('returns 401 when auth is missing or invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {}, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when the project is not owned by the user', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({ ...draftProject, ownerId: 'other-user' }),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the project does not exist', async () => {
    const { handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'missing-project' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });
});
