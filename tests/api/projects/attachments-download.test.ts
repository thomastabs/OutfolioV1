import { createPublicProjectAttachmentDownloadHandler } from '@/src/api/v1/projects/attachments';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

describe('GET /api/v1/public/projects/:id/attachments/:attachmentId', () => {
  const project = {
    id: 'project-1',
    ownerId: 'user-1',
    visibility: 'PUBLISHED',
  };
  const attachment = {
    id: 'attachment-1',
    projectId: 'project-1',
    filename: 'architecture.pdf',
    url: '/api/v1/projects/project-1/attachments/attachment-1/download?filename=architecture.pdf',
    fileType: 'application/pdf',
    fileSize: 42,
    isOmlFile: false,
    order: 0,
  };

  function setup(projectResult: typeof project | null = project, attachmentResult: typeof attachment | null = attachment) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(projectResult),
      },
      projectAttachment: {
        findFirst: jest.fn().mockResolvedValue(attachmentResult),
      },
    };
    const handler = createPublicProjectAttachmentDownloadHandler({ prisma } as never);
    const res = mockResponse();

    return { prisma, handler, res };
  }

  it('serves a downloadable attachment for a published project', async () => {
    const { prisma, handler, res } = setup();

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: 'project-1' } });
    expect(prisma.projectAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'attachment-1', projectId: 'project-1' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="architecture.pdf"');
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect((res.send as jest.Mock).mock.calls[0][0].toString()).toContain('architecture.pdf');
  });

  it.each(['DRAFT', 'PRIVATE', 'UNPUBLISHED'])('returns 403 for %s projects', async (visibility) => {
    const { prisma, handler, res } = setup({ ...project, visibility }, attachment);

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(prisma.projectAttachment.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_public',
      message: 'Project is not public.',
    });
  });

  it('returns 404 when the project does not exist', async () => {
    const { prisma, handler, res } = setup(null, attachment);

    await handler({
      params: { id: 'missing-project', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(prisma.projectAttachment.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project not found.',
    });
  });

  it('returns 404 when the attachment does not exist for the project', async () => {
    const { handler, res } = setup(project, null);

    await handler({
      params: { id: 'project-1', attachmentId: 'missing-attachment' },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'attachment_not_found',
      message: 'Attachment not found.',
    });
  });

  it('returns 404 when route params are missing', async () => {
    const { prisma, handler, res } = setup();

    await handler({ params: { id: 'project-1' } } as never, res as never);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(prisma.projectAttachment.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project or attachment not found.',
    });
  });

  it('sanitizes quotes, backslashes, and newlines out of the Content-Disposition filename', async () => {
    const { handler, res } = setup(project, {
      ...attachment,
      filename: 'weird "name"\\with\r\nbreaks.pdf',
    });

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    const [, headerValue] = (res.setHeader as jest.Mock).mock.calls.find(
      ([header]) => header === 'Content-Disposition',
    );
    const match = headerValue.match(/^attachment; filename="(.*)"$/);
    expect(match).not.toBeNull();
    expect(match[1]).not.toMatch(/["\\\r\n]/);
  });

  it('downloads attachments with uncommon but supported MIME types correctly', async () => {
    const { handler, res } = setup(project, {
      ...attachment,
      filename: 'notes.md',
      fileType: 'text/markdown',
    });

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown');
  });

  it('downloads correctly even when the stored attachment url is empty', async () => {
    const { handler, res } = setup(project, { ...attachment, url: '' });

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('serves multiple attachment downloads in sequence without interference', async () => {
    const secondAttachment = { ...attachment, id: 'attachment-2', filename: 'diagram.pdf' };
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(project) },
      projectAttachment: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(attachment)
          .mockResolvedValueOnce(secondAttachment),
      },
    };
    const handler = createPublicProjectAttachmentDownloadHandler({ prisma } as never);
    const firstRes = mockResponse();
    const secondRes = mockResponse();

    await handler({ params: { id: 'project-1', attachmentId: 'attachment-1' } } as never, firstRes as never);
    await handler({ params: { id: 'project-1', attachmentId: 'attachment-2' } } as never, secondRes as never);

    expect(firstRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="architecture.pdf"');
    expect(secondRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="diagram.pdf"');
  });

  it('returns 404 when the attachment belongs to a different project', async () => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(project) },
      projectAttachment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = createPublicProjectAttachmentDownloadHandler({ prisma } as never);
    const res = mockResponse();

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-owned-by-another-project' },
    } as never, res as never);

    expect(prisma.projectAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'attachment-owned-by-another-project', projectId: 'project-1' },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'attachment_not_found' }));
  });

  it('returns 404 without leaking the project id or attachment id in the error response for a malformed request', async () => {
    const { prisma, handler, res } = setup();

    await handler({ params: { id: '   ', attachmentId: '   ' } } as never, res as never);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      error: 'project_not_found',
      message: 'Project or attachment not found.',
    });
  });

  it('returns 500 for unexpected failures', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockRejectedValue(new Error('database offline')),
      },
      projectAttachment: {
        findFirst: jest.fn(),
      },
    };
    const handler = createPublicProjectAttachmentDownloadHandler({ prisma } as never);
    const res = mockResponse();

    await handler({
      params: { id: 'project-1', attachmentId: 'attachment-1' },
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'unexpected_failure',
      message: 'Could not download the attachment.',
    });
  });
});
