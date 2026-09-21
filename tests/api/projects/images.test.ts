import {
  createProjectImageDeleteHandler,
  createProjectImageListHandler,
  createProjectImageOrderHandler,
  createProjectImageUploadHandler,
} from '@/src/api/v1/projects/images';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function imageFile(overrides: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) {
  const buffer = overrides.buffer ?? Buffer.from('fake image bytes');
  return {
    originalname: overrides.originalname ?? 'screen.png',
    mimetype: overrides.mimetype ?? 'image/png',
    size: overrides.size ?? buffer.length,
    buffer,
  };
}

describe('project image gallery API', () => {
  const project = { id: 'project-1', ownerId: 'user-1' };
  const firstImage = {
    id: 'image-1',
    projectId: 'project-1',
    url: 'data:image/png;base64,ZmFrZQ==',
    order: 0,
  };
  const secondImage = {
    id: 'image-2',
    projectId: 'project-1',
    url: 'data:image/jpeg;base64,ZmFrZQ==',
    order: 1,
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
      projectImage: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(firstImage),
        create: jest.fn().mockImplementation(async ({ data }) => ({ ...data })),
        delete: jest.fn().mockResolvedValue(firstImage),
        update: jest.fn().mockResolvedValue(firstImage),
      },
    };
    const validateSession = jest.fn().mockReturnValue({ valid: true, userId: 'user-1' });
    return { deps: { prisma, validateSession, ...overrides }, prisma, validateSession };
  }

  it('uploads multiple valid images and returns the updated image list', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([firstImage, secondImage]);
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: { cookie: 'next-auth.session-token=valid' },
      params: { id: 'project-1' },
      files: [
        imageFile({ originalname: 'screen.png', mimetype: 'image/png' }),
        imageFile({ originalname: 'flow.jpg', mimetype: 'image/jpeg' }),
      ],
    } as never, res as never);

    expect(prisma.projectImage.create).toHaveBeenCalledTimes(2);
    expect(prisma.projectImage.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        projectId: 'project-1',
        url: expect.stringMatching(/^data:image\/png;base64,/),
        order: 0,
      }),
    });
    expect(prisma.projectImage.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        projectId: 'project-1',
        url: expect.stringMatching(/^data:image\/jpeg;base64,/),
        order: 1,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: [
        { id: 'image-1', url: firstImage.url, order: 0 },
        { id: 'image-2', url: secondImage.url, order: 1 },
      ],
    });
  });

  it('rejects unsupported image file types', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ originalname: 'notes.txt', mimetype: 'text/plain' })],
    } as never, res as never);

    expect(prisma.projectImage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unsupported_media_type' }));
  });

  it('rejects oversized image uploads', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ size: 10 * 1024 * 1024 + 1 })],
    } as never, res as never);

    expect(prisma.projectImage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'payload_too_large' }));
  });

  it.each(['image/gif', 'image/webp'])('accepts %s images within the size limit', async (mimetype) => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([firstImage]);
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ originalname: 'anim.gif', mimetype })],
    } as never, res as never);

    expect(prisma.projectImage.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('accepts an image exactly at the 10 MiB size limit', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([firstImage]);
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ size: 10 * 1024 * 1024 })],
    } as never, res as never);

    expect(prisma.projectImage.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects the entire batch when one file in a mixed selection is an unsupported type', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [
        imageFile({ originalname: 'screen.png', mimetype: 'image/png' }),
        imageFile({ originalname: 'notes.txt', mimetype: 'text/plain' }),
      ],
    } as never, res as never);

    expect(prisma.projectImage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unsupported_media_type' }));
  });

  it('appends uploaded images after existing gallery images, continuing the order sequence', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([firstImage, secondImage])
      .mockResolvedValueOnce([firstImage, secondImage, { id: 'image-3', projectId: 'project-1', url: 'data:image/png;base64,ZmFrZQ==', order: 2 }]);
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ originalname: 'new.png', mimetype: 'image/png' })],
    } as never, res as never);

    expect(prisma.projectImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'project-1', order: 2 }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a zero-byte file even with a valid image mime type', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      files: [imageFile({ buffer: Buffer.alloc(0), size: 0 })],
    } as never, res as never);

    expect(prisma.projectImage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_image_file' }));
  });

  it('requires at least one file to upload', async () => {
    const { deps, prisma } = setup();
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, files: [] } as never, res as never);

    expect(prisma.projectImage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'validation_error' }));
  });

  it('requires a valid authenticated session', async () => {
    const { deps } = setup({
      validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing_session' }),
    });
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, files: [imageFile()] } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'missing_or_invalid_auth' }));
  });

  it('forbids image management for non-owners', async () => {
    const { deps } = setup({
      prisma: {
        project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', ownerId: 'another-user' }) },
      },
    });
    const handler = createProjectImageUploadHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, files: [imageFile()] } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_owner' }));
  });

  it('lists, deletes, and reorders owned project images', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany.mockResolvedValue([firstImage, secondImage]);
    const listHandler = createProjectImageListHandler(deps as never);
    const orderHandler = createProjectImageOrderHandler(deps as never);
    const deleteHandler = createProjectImageDeleteHandler(deps as never);

    const listRes = mockResponse();
    await listHandler({ headers: {}, params: { id: 'project-1' } } as never, listRes as never);
    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(listRes.json).toHaveBeenCalledWith({
      images: [
        { id: 'image-1', url: firstImage.url, order: 0 },
        { id: 'image-2', url: secondImage.url, order: 1 },
      ],
    });

    const orderRes = mockResponse();
    await orderHandler({
      headers: {},
      params: { id: 'project-1' },
      body: { order: ['image-2', 'image-1'] },
    } as never, orderRes as never);
    expect(prisma.projectImage.update).toHaveBeenCalledWith({ where: { id: 'image-2' }, data: { order: 0 } });
    expect(prisma.projectImage.update).toHaveBeenCalledWith({ where: { id: 'image-1' }, data: { order: 1 } });

    const deleteRes = mockResponse();
    await deleteHandler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, deleteRes as never);
    expect(prisma.projectImage.delete).toHaveBeenCalledWith({ where: { id: 'image-1' } });
    expect(deleteRes.json).toHaveBeenCalledWith({ success: true });
  });

  it('rejects malformed image order input', async () => {
    const { deps } = setup();
    const handler = createProjectImageOrderHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1' }, body: { order: 'image-1' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'validation_error' }));
  });

  it('returns 404 when deleting an image that is missing from the project', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findFirst.mockResolvedValue(null);
    const handler = createProjectImageDeleteHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1', imageId: 'missing-image' } } as never, res as never);

    expect(prisma.projectImage.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'image_not_found',
      message: 'Image not found.',
    });
  });
});
