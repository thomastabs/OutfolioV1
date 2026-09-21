import { createProjectHandler, createProjectListHandler, slugifyProjectTitle } from '@/src/api/v1/projects/create';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('project slug generation', () => {
  it('converts titles to lowercase URL slugs', () => {
    expect(slugifyProjectTitle('  My Great Project!  ')).toBe('my-great-project');
    expect(slugifyProjectTitle('OutSystems: CRM + Portal')).toBe('outsystems-crm-portal');
  });
});

describe('POST /api/v1/projects', () => {
  const createdProject = {
    id: 'project-1',
    ownerId: 'user-1',
    title: 'Portfolio Builder',
    slug: 'portfolio-builder',
    summary: 'A project documentation workspace.',
    projectType: '',
    role: 'Developer',
    status: 'draft',
    tags: [],
    coverImageUrl: '',
    problem: '',
    features: '',
    technicalNotes: '',
    contribution: '',
    outcome: '',
    visibility: 'DRAFT',
    publishedAt: null,
    createdAt: new Date('2026-09-15T18:00:00.000Z'),
    updatedAt: new Date('2026-09-15T18:00:00.000Z'),
  };

  const validBody = {
    title: 'Portfolio Builder',
    summary: 'A project documentation workspace.',
    role: 'Developer',
  };

  function setup(overrides: Partial<Parameters<typeof createProjectHandler>[0]> = {}) {
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(prisma)),
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdProject),
      },
      projectImage: {
        create: jest.fn(async ({ data }) => data),
      },
      projectAttachment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          omlMetadata: null,
        })),
      },
      omlMetadata: {
        upsert: jest.fn(async ({ create }) => ({
          moduleName: create.moduleName,
          version: create.version,
        })),
      },
    };
    const validateSession = jest.fn().mockReturnValue({
      valid: true,
      userId: 'user-1',
      username: 'ada',
      email: 'ada@example.com',
      expiresAt: '2026-10-15T12:00:00.000Z',
    });
    const deps = { prisma, validateSession, ...overrides };
    const handler = createProjectHandler(deps);
    const res = mockResponse();

    return { deps, handler, res };
  }

  it('creates a draft project for valid required fields', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, body: validBody } as never, res as never);

    expect(deps.prisma.project.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'user-1', slug: 'portfolio-builder' },
    });
    expect(deps.prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'user-1',
        title: 'Portfolio Builder',
        slug: 'portfolio-builder',
        summary: 'A project documentation workspace.',
        role: 'Developer',
        visibility: 'DRAFT',
        publishedAt: null,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      visibility: 'draft',
    }));
  });

  it('forces new projects to draft visibility even when another visibility is submitted', async () => {
    const { deps, handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      body: { ...validBody, visibility: 'published' },
    } as never, res as never);

    expect(deps.prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        visibility: 'DRAFT',
        publishedAt: null,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 malformed_input when required fields are missing', async () => {
    const { deps, handler, res } = setup();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, body: { title: '', summary: '', role: '' } } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'malformed_input',
      message: 'Project input is invalid.',
      fields: {
        title: 'Title is required.',
        summary: 'Summary is required.',
        role: 'Role is required.',
      },
    });
  });

  it('returns 409 duplicate_slug when the generated slug already exists for the user', async () => {
    const { deps, handler, res } = setup({
      prisma: {
        project: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-project' }),
          create: jest.fn(),
        },
      },
    } as never);

    await handler({ headers: { cookie: 'next-auth.session-token=valid' }, body: validBody } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'duplicate_slug',
      message: 'A project with this slug already exists. Choose a unique title.',
    });
  });

  it('returns 401 when the session is missing or invalid', async () => {
    const { deps, handler, res } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing' }),
    } as never);

    await handler({ headers: {}, body: validBody } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });

  it('creates a draft project with cover image, gallery images, and attachments in one media creation request', async () => {
    const { deps, handler, res } = setup();
    const coverImage = {
      fieldname: 'coverImage',
      originalname: 'cover.png',
      mimetype: 'image/png',
      size: 5,
      buffer: Buffer.from('cover'),
    };
    const galleryImage = {
      fieldname: 'galleryImages',
      originalname: 'screen.webp',
      mimetype: 'image/webp',
      size: 6,
      buffer: Buffer.from('screen'),
    };
    const attachment = {
      fieldname: 'attachments',
      originalname: 'orders.oml',
      mimetype: 'application/octet-stream',
      size: 64,
      buffer: Buffer.from('<moduleName>Orders</moduleName><version>1.0.0</version>'),
    };

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      body: validBody,
      files: [coverImage, galleryImage, attachment],
    } as never, res as never);

    expect(deps.prisma.$transaction).toHaveBeenCalled();
    expect(deps.prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coverImageUrl: 'data:image/png;base64,Y292ZXI=',
        ownerId: 'user-1',
        slug: 'portfolio-builder',
      }),
    });
    expect(deps.prisma.projectImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        url: 'data:image/webp;base64,c2NyZWVu',
        order: 0,
      }),
    });
    expect(deps.prisma.projectAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        filename: 'orders.oml',
        fileType: 'application/octet-stream',
        fileSize: 64,
        isOmlFile: true,
        order: 0,
      }),
      include: { omlMetadata: true },
    });
    expect(deps.prisma.omlMetadata.upsert).toHaveBeenCalledWith({
      where: { attachmentId: expect.any(String) },
      update: { moduleName: 'Orders', version: '1.0.0' },
      create: expect.objectContaining({ moduleName: 'Orders', version: '1.0.0' }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      coverImageUrl: 'data:image/png;base64,Y292ZXI=',
      images: [expect.objectContaining({ url: 'data:image/webp;base64,c2NyZWVu', order: 0 })],
      attachments: [expect.objectContaining({
        filename: 'orders.oml',
        isOmlFile: true,
        metadata: { moduleName: 'Orders', version: '1.0.0' },
      })],
    }));
  });

  it('rejects unsupported media during project creation before persisting anything', async () => {
    const { deps, handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      body: validBody,
      files: [{
        fieldname: 'galleryImages',
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 5,
        buffer: Buffer.from('not an image'),
      }],
    } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(deps.prisma.projectImage.create).not.toHaveBeenCalled();
    expect(deps.prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unsupported_media_type',
      message: 'Only JPEG, PNG, GIF, or WebP images can be uploaded.',
    });
  });

  it('rejects oversized attachments during project creation before persisting anything', async () => {
    const { deps, handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      body: validBody,
      files: [{
        fieldname: 'attachments',
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 50 * 1024 * 1024 + 1,
        buffer: Buffer.from('%PDF-1.4'),
      }],
    } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(deps.prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: 'payload_too_large',
      message: 'Attachments must be 50 MiB or smaller.',
    });
  });

  it('returns 400 for missing project fields before creating media records', async () => {
    const { deps, handler, res } = setup();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      body: { title: '', summary: '', role: '' },
      files: [{
        fieldname: 'coverImage',
        originalname: 'cover.png',
        mimetype: 'image/png',
        size: 5,
        buffer: Buffer.from('cover'),
      }],
    } as never, res as never);

    expect(deps.prisma.project.create).not.toHaveBeenCalled();
    expect(deps.prisma.projectImage.create).not.toHaveBeenCalled();
    expect(deps.prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('GET /api/v1/projects', () => {
  it('returns the authenticated user project list', async () => {
    const project = {
      id: 'project-1',
      title: 'Portfolio Builder',
      slug: 'portfolio-builder',
      summary: 'A project documentation workspace.',
      role: 'Developer',
      status: 'draft',
      visibility: 'DRAFT',
      publishedAt: null,
      createdAt: new Date('2026-09-15T18:00:00.000Z'),
      updatedAt: new Date('2026-09-15T18:00:00.000Z'),
    };
    const prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([project]),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const handler = createProjectListHandler({ prisma, validateSession });
    const res = mockResponse();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      projects: [expect.objectContaining({ id: 'project-1', visibility: 'draft' })],
    });
  });

  it('returns an empty project list for authenticated users with no projects', async () => {
    const prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    const handler = createProjectListHandler({ prisma, validateSession });
    const res = mockResponse();

    await handler({ headers: { cookie: 'next-auth.session-token=valid' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ projects: [] });
  });

  it('returns 401 when listing projects without a valid session', async () => {
    const prisma = {
      project: {
        findMany: jest.fn(),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: false, reason: 'missing' });
    const handler = createProjectListHandler({ prisma, validateSession });
    const res = mockResponse();

    await handler({ headers: {} } as never, res as never);

    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'missing_or_invalid_auth',
      message: 'Missing or invalid session.',
    });
  });
});
