import { createProjectDeleteHandler } from '@/src/api/v1/projects/delete';

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
  createdAt: new Date('2026-09-15T18:00:00.000Z'),
  updatedAt: new Date('2026-09-15T18:30:00.000Z'),
};

describe('DELETE /api/v1/projects/:id', () => {
  function setup(overrides: Partial<Parameters<typeof createProjectDeleteHandler>[0]> = {}) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(draftProject),
        delete: jest.fn().mockResolvedValue(draftProject),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createProjectDeleteHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('deletes a draft project owned by the authenticated user', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
    expect(deps.prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('rejects deletion of a published project', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({ ...draftProject, visibility: 'PUBLISHED' }),
          delete: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'not_owner_or_not_draft',
      message: 'Only draft projects owned by the authenticated user can be deleted.',
    });
  });

  it('rejects deletion by a non-owner', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({ ...draftProject, ownerId: 'other-user' }),
          delete: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'not_owner_or_not_draft',
      message: 'Only draft projects owned by the authenticated user can be deleted.',
    });
  });

  it('returns 404 when the project does not exist', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'missing-project' } } as never, res as never);

    expect(deps.prisma.project.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });

  it('returns 401 when the session is missing or invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {}, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('returns 400 when the project id is malformed', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: '' } } as never, res as never);

    expect(deps.prisma.project.findUnique).not.toHaveBeenCalled();
    expect(deps.prisma.project.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'malformed_project_id',
      message: 'Project id is required.',
    });
  });
});
