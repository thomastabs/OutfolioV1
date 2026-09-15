import { createProjectGetHandler } from '@/src/api/v1/projects/get';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const project = {
  id: 'project-1',
  ownerId: 'user-1',
  title: 'Portfolio Builder',
  slug: 'portfolio-builder',
  summary: 'A project documentation workspace.',
  projectType: 'OutSystems',
  role: 'Developer',
  status: 'draft',
  tags: ['portfolio'],
  coverImageUrl: '',
  problem: 'Exports miss the visual product.',
  features: 'Case study authoring.',
  technicalNotes: 'Next.js and Prisma.',
  contribution: 'Built the workflow.',
  outcome: 'Reusable portfolio entry.',
  visibility: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-09-15T18:00:00.000Z'),
  updatedAt: new Date('2026-09-15T18:30:00.000Z'),
};

describe('GET /api/v1/projects/:id', () => {
  function setup(overrides: Partial<Parameters<typeof createProjectGetHandler>[0]> = {}) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createProjectGetHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('returns a project owned by the authenticated user', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      title: 'Portfolio Builder',
      technicalNotes: 'Next.js and Prisma.',
      visibility: 'draft',
    }));
  });

  it('returns 403 when the project belongs to another user', async () => {
    const { res, handler } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({ ...project, ownerId: 'other-user' }),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'forbidden',
      message: 'You do not have access to this project.',
    });
  });

  it('returns 404 when the project does not exist', async () => {
    const { res, handler } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue(null),
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

  it('returns 400 when the project id is malformed', async () => {
    const { deps, res, handler } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: '' } } as never, res as never);

    expect(deps.prisma.project.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'malformed_project_id',
      message: 'Project id is required.',
    });
  });

  it('returns 401 when the session is missing or invalid', async () => {
    const { deps, res, handler } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {}, params: { id: 'project-1' } } as never, res as never);

    expect(deps.prisma.project.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
