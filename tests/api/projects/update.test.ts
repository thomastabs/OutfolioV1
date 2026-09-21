import { createProjectUpdateHandler } from '@/src/api/v1/projects/update';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const existingProject = {
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

const validBody = {
  title: 'Portfolio Builder Updated',
  summary: 'An updated project documentation workspace.',
  projectType: 'OutSystems',
  role: 'Lead Developer',
  status: 'draft',
  tags: ['portfolio', 'case-study'],
  coverImageUrl: 'https://example.com/cover.png',
  problem: 'Exports miss the visual product.',
  features: 'Case study authoring.',
  technicalNotes: 'Updated architecture notes.',
  contribution: 'Built and refined the workflow.',
  outcome: 'Reusable portfolio entry.',
  visibility: 'draft',
  publishedAt: null,
};

describe('PUT /api/v1/projects/:id', () => {
  function setup(overrides: Partial<Parameters<typeof createProjectUpdateHandler>[0]> = {}) {
    const updatedProject = {
      ...existingProject,
      ...validBody,
      slug: 'portfolio-builder-updated',
      visibility: 'DRAFT',
      updatedAt: new Date('2026-09-15T19:00:00.000Z'),
    };
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(existingProject),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updatedProject),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const storage = {
      resolveMediaUrl: jest.fn(async (value: string) => (value.startsWith('projects/') ? `https://signed.example/${value}` : value)),
    };
    const deps = { prisma, validateSession, storage, ...overrides };
    const handler = createProjectUpdateHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('does not overwrite a Storage-key coverImageUrl with its own resolved signed URL when the owner saves without changing it', async () => {
    const storageBackedProject = { ...existingProject, coverImageUrl: 'projects/project-1/images/cover-1.png' };
    const { deps, handler, res } = setup();
    deps.prisma.project.findUnique.mockResolvedValue(storageBackedProject);
    deps.prisma.project.update.mockResolvedValue(storageBackedProject);

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      // The owner's form was pre-filled with the resolved signed URL and
      // saved unchanged - this must not clobber the stored key.
      body: { ...validBody, coverImageUrl: 'https://signed.example/projects/project-1/images/cover-1.png' },
    } as never, res as never);

    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({ coverImageUrl: 'projects/project-1/images/cover-1.png' }),
    });
  });

  it('updates an owned project with valid input', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' }, body: validBody } as never, res as never);

    expect(deps.prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        ownerId: 'user-1',
        slug: 'portfolio-builder-updated',
        NOT: { id: 'project-1' },
      },
    });
    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        title: 'Portfolio Builder Updated',
        slug: 'portfolio-builder-updated',
        technicalNotes: 'Updated architecture notes.',
        visibility: 'DRAFT',
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      title: 'Portfolio Builder Updated',
      visibility: 'draft',
    }));
  });

  it('returns 403 when the authenticated user does not own the project', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({ ...existingProject, ownerId: 'other-user' }),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' }, body: validBody } as never, res as never);

    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'forbidden',
      message: 'You do not have access to this project.',
    });
  });

  it('returns 409 when another owned project already has the generated slug', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue(existingProject),
          findFirst: jest.fn().mockResolvedValue({ id: 'project-2' }),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'project-1' }, body: validBody } as never, res as never);

    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'duplicate_slug',
      message: 'A project with this slug already exists. Choose a unique title.',
    });
  });

  it('returns 422 validation errors before database writes', async () => {
    const { deps, handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      body: { ...validBody, title: '', summary: '', role: '', status: '', visibility: '' },
    } as never, res as never);

    expect(deps.prisma.project.findUnique).not.toHaveBeenCalled();
    expect(deps.prisma.project.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'validation_failed',
      message: 'Project input is invalid.',
      fields: expect.objectContaining({
        title: 'Title is required.',
        summary: 'Summary is required.',
        role: 'Role is required.',
        status: 'Status is required.',
        visibility: 'Visibility is required.',
      }),
    });
  });

  it('returns 422 for invalid field types, URLs, visibility, and publishedAt', async () => {
    const { handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      body: {
        ...validBody,
        tags: ['valid', 10],
        coverImageUrl: 'ftp://example.com/cover.png',
        visibility: 'hidden',
        publishedAt: 'not-a-date',
      },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'validation_failed',
      message: 'Project input is invalid.',
      fields: expect.objectContaining({
        tags: 'Tags must be an array of text values.',
        coverImageUrl: 'Cover image URL must be an HTTP or HTTPS URL.',
        visibility: 'Visibility must be draft, published, or unpublished.',
        publishedAt: 'Published date must be a valid ISO date.',
      }),
    });
  });

  it('returns 404 when the project does not exist', async () => {
    const { handler, res } = setup({
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, params: { id: 'missing-project' }, body: validBody } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });
});
