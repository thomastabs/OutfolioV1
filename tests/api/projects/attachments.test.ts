import {
  createProjectAttachmentDeleteHandler,
  createProjectAttachmentListHandler,
  createProjectAttachmentOrderHandler,
  createProjectAttachmentUploadHandler,
  createProjectOmlMetadataHandler,
} from '@/src/api/v1/projects/attachments';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function omlFile(overrides: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) {
  const buffer = overrides.buffer ?? Buffer.from('<moduleName>OrdersPortal</moduleName><version>1.2.3</version>');
  return {
    originalname: overrides.originalname ?? 'orders-portal.oml',
    mimetype: overrides.mimetype ?? 'application/octet-stream',
    size: overrides.size ?? buffer.length,
    buffer,
  };
}

describe('project .oml attachments API', () => {
  const project = { id: 'project-1', ownerId: 'user-1' };
  const metadata = { moduleName: 'OrdersPortal', version: '1.2.3' };
  const attachment = {
    id: 'attachment-1',
    projectId: 'project-1',
    filename: 'orders-portal.oml',
    url: '/api/v1/projects/project-1/attachments/attachment-1/download?filename=orders-portal.oml',
    fileType: 'application/octet-stream',
    fileSize: 68,
    isOmlFile: true,
    order: 0,
    omlMetadata: metadata,
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
      projectAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(attachment),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          ...attachment,
          ...data,
          omlMetadata: null,
        })),
        delete: jest.fn().mockResolvedValue(attachment),
        update: jest.fn().mockResolvedValue(attachment),
      },
      omlMetadata: {
        upsert: jest.fn().mockResolvedValue(metadata),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    return { deps: { prisma, validateSession, ...overrides }, prisma, validateSession };
  }

  it('uploads a valid .oml attachment and stores extracted metadata', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [omlFile()],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        filename: 'orders-portal.oml',
        isOmlFile: true,
        order: 0,
      }),
      include: { omlMetadata: true },
    });
    expect(prisma.omlMetadata.upsert).toHaveBeenCalledWith({
      where: { attachmentId: expect.any(String) },
      update: metadata,
      create: expect.objectContaining(metadata),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      attachments: [
        expect.objectContaining({
          filename: 'orders-portal.oml',
          metadata,
        }),
      ],
    });
  });

  it('uploads multiple supported attachments and extracts metadata only for .oml files', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [
        omlFile(),
        {
          originalname: 'architecture.pdf',
          mimetype: 'application/pdf',
          size: 42,
          buffer: Buffer.from('%PDF-1.4'),
        },
      ],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledTimes(2);
    expect(prisma.projectAttachment.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        filename: 'orders-portal.oml',
        isOmlFile: true,
        order: 0,
      }),
      include: { omlMetadata: true },
    });
    expect(prisma.projectAttachment.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        filename: 'architecture.pdf',
        fileType: 'application/pdf',
        isOmlFile: false,
        order: 1,
      }),
      include: { omlMetadata: true },
    });
    expect(prisma.omlMetadata.upsert).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      attachments: [
        expect.objectContaining({
          filename: 'orders-portal.oml',
          metadata,
        }),
        expect.objectContaining({
          filename: 'architecture.pdf',
          metadata: null,
        }),
      ],
    });
  });

  it('uploads supported text attachments without .oml metadata', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [omlFile({ originalname: 'notes.txt', mimetype: 'text/plain' })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: 'notes.txt',
        isOmlFile: false,
      }),
      include: { omlMetadata: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects unsupported file types', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [omlFile({ originalname: 'malware.exe', mimetype: 'application/x-msdownload' })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'unsupported_media_type',
      message: 'Only .oml, PDF, text, Markdown, or ZIP attachments can be uploaded.',
    }));
  });

  it('rejects supported attachment extensions with unsupported MIME types', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [{
        originalname: 'architecture.pdf',
        mimetype: 'text/plain',
        size: 42,
        buffer: Buffer.from('not a pdf'),
      }],
    } as never, res as never);

    expect(prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'unsupported_media_type',
      message: 'The .pdf file type is not supported.',
    }));
  });

  it('rejects oversized .oml uploads', async () => {
    const { deps } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [omlFile({ size: 50 * 1024 * 1024 + 1 })],
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'payload_too_large' }));
  });

  it('rejects corrupted .oml uploads with invalid_oml_file', async () => {
    const { deps } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [omlFile({ buffer: Buffer.from('corrupted invalid_oml content') })],
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_oml_file' }));
  });

  it('requires an authenticated owner', async () => {
    const { deps } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing_session' }),
    });
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, files: [omlFile()] } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'missing_or_invalid_auth' }));
  });

  it('forbids attachment management for non-owners', async () => {
    const { deps } = setup({
      prisma: {
        project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', ownerId: 'another-user' }) },
      },
    });
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, files: [omlFile()] } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_owner' }));
  });

  it('lists, deletes, and reorders owned .oml attachments', async () => {
    const { deps, prisma } = setup();
    prisma.projectAttachment.findMany.mockResolvedValue([attachment]);
    const listHandler = createProjectAttachmentListHandler(deps as never);
    const deleteHandler = createProjectAttachmentDeleteHandler(deps as never);
    const orderHandler = createProjectAttachmentOrderHandler(deps as never);

    const listRes = mockResponse();
    await listHandler({ headers: {}, params: { id: 'project-1' } } as never, listRes as never);
    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(listRes.json).toHaveBeenCalledWith({ attachments: [expect.objectContaining({ id: 'attachment-1' })] });

    const orderRes = mockResponse();
    await orderHandler({
      headers: {},
      params: { id: 'project-1' },
      body: { order: ['attachment-1'] },
    } as never, orderRes as never);
    expect(prisma.projectAttachment.update).toHaveBeenCalledWith({
      where: { id: 'attachment-1' },
      data: { order: 0 },
    });

    const deleteRes = mockResponse();
    await deleteHandler({
      headers: {},
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, deleteRes as never);
    expect(prisma.projectAttachment.delete).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
    expect(deleteRes.json).toHaveBeenCalledWith({ success: true });
  });

  it('extracts .oml metadata without storing the file', async () => {
    const { deps } = setup();
    const handler = createProjectOmlMetadataHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile()],
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ metadata });
  });

  it('rejects corrupted .oml metadata extraction without storing the file', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectOmlMetadataHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile({ buffer: Buffer.from('not an oml export') })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).not.toHaveBeenCalled();
    expect(prisma.omlMetadata.upsert).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_oml_file',
      message: 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
    });
  });

  it('extracts fallback metadata from an .oml file with no explicit moduleName or version tags', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile({ originalname: 'checkout-flow.oml', buffer: Buffer.from('plain export content') })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ filename: 'checkout-flow.oml', isOmlFile: true }),
    }));
    expect(prisma.omlMetadata.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { moduleName: 'checkout-flow', version: 'unknown' },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('accepts an attachment exactly at the 50 MiB size limit', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile({ originalname: 'architecture.pdf', mimetype: 'application/pdf', size: 50 * 1024 * 1024 })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('accepts filenames with spaces and sanitizes unsafe special characters rather than rejecting the upload', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile({
        originalname: 'Design Notes (v2) — 100% draft.txt',
        mimetype: 'text/plain',
      })],
    } as never, res as never);

    // baseName() strips characters outside [\w.\- ] for safe storage/URL use — spaces are
    // preserved, but "(", ")", "—", and "%" are replaced with "_". This is existing,
    // deliberate sanitization, not a defect: the upload still succeeds.
    expect(prisma.projectAttachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ filename: 'Design Notes _v2_ _ 100_ draft.txt' }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('creates separate attachments for files sharing the same name but different content', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [
        omlFile({ originalname: 'notes.txt', mimetype: 'text/plain', buffer: Buffer.from('version one') }),
        omlFile({ originalname: 'notes.txt', mimetype: 'text/plain', buffer: Buffer.from('version two') }),
      ],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledTimes(2);
    expect(prisma.projectAttachment.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ filename: 'notes.txt', order: 0 }),
    }));
    expect(prisma.projectAttachment.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ filename: 'notes.txt', order: 1 }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('appends uploaded attachments after existing ones, continuing the order sequence', async () => {
    const { deps, prisma } = setup();
    prisma.projectAttachment.findMany.mockResolvedValue([attachment]);
    const handler = createProjectAttachmentUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [omlFile({ originalname: 'notes.txt', mimetype: 'text/plain' })],
    } as never, res as never);

    expect(prisma.projectAttachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ order: 1 }),
    }));
  });
});
