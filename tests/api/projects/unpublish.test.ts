import { createProjectUnpublishHandler } from '@/src/api/v1/projects/unpublish';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const publishedProject = {
  id: 'project-1',
  ownerId: 'user-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  role: 'Developer',
  status: 'published',
  visibility: 'PUBLISHED',
  publishedAt: new Date('2026-09-15T21:00:00.000Z'),
};

describe('POST /api/v1/projects/:id/unpublish', () => {
  function setup(overrides: Partial<Parameters<typeof createProjectUnpublishHandler>[0]> = {}) {
    const unpublishedProject = {
      ...publishedProject,
      visibility: 'UNPUBLISHED',
      publishedAt: null,
    };
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(publishedProject),
        update: jest.fn().mockResolvedValue(unpublishedProject),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createProjectUnpublishHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('unpublishes an owned project and clears publishedAt', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        visibility: 'UNPUBLISHED',
        publishedAt: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      visibility: 'unpublished',
      publishedAt: null,
    }));
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
          findUnique: jest.fn().mockResolvedValue({ ...publishedProject, ownerId: 'other-user' }),
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
