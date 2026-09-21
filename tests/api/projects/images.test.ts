const uploadProjectMedia = jest.fn(async (key: string) => key);
const deleteProjectMedia = jest.fn(async () => undefined);
const createProjectMediaSignedUrl = jest.fn(async (key: string) => `https://signed.example/${key}`);

function fakeResolveMediaUrl(value: string) {
  return value.startsWith('projects/') ? `https://signed.example/${value}` : value;
}

function fakeParseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]*)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const buffer = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  return { mimeType, buffer };
}

function fakeStorage() {
  return {
    uploadProjectMedia: (...args: [string, Buffer, string]) => uploadProjectMedia(...args),
    deleteProjectMedia: (...args: [string]) => deleteProjectMedia(...args),
    createProjectMediaSignedUrl: (...args: [string]) => createProjectMediaSignedUrl(...args),
    resolveMediaUrl: async (value: string) => fakeResolveMediaUrl(value),
    isStorageKey: (value: string) => value.startsWith('projects/'),
    parseDataUrl: (value: string) => fakeParseDataUrl(value),
  };
}

import {
  createProjectImageDeleteHandler,
  createProjectImageDownloadHandler,
  createProjectImageListHandler,
  createProjectImageOrderHandler,
  createProjectImageUploadHandler,
} from '@/src/api/v1/projects/images';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
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
  // Legacy fixtures: rows written before Story 9564046 keep their base64
  // data-URL in `url` unmigrated (SC-3) - resolveMediaUrl passes these
  // through unchanged, which the mock above replicates.
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

  beforeEach(() => {
    uploadProjectMedia.mockClear();
    deleteProjectMedia.mockClear();
    createProjectMediaSignedUrl.mockClear();
  });

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
    return { deps: { prisma, validateSession, storage: fakeStorage(), ...overrides }, prisma, validateSession };
  }

  it('uploads multiple valid images to Supabase Storage and returns the updated image list with signed URLs', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'image-1', projectId: 'project-1', url: 'projects/project-1/images/image-1.png', order: 0 },
        { id: 'image-2', projectId: 'project-1', url: 'projects/project-1/images/image-2.jpg', order: 1 },
      ]);
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

    expect(uploadProjectMedia).toHaveBeenCalledTimes(2);
    expect(uploadProjectMedia).toHaveBeenNthCalledWith(1, expect.stringMatching(/^projects\/project-1\/images\/.+\.png$/), expect.any(Buffer), 'image/png');
    expect(uploadProjectMedia).toHaveBeenNthCalledWith(2, expect.stringMatching(/^projects\/project-1\/images\/.+\.jpg$/), expect.any(Buffer), 'image/jpeg');
    expect(prisma.projectImage.create).toHaveBeenCalledTimes(2);
    expect(prisma.projectImage.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        projectId: 'project-1',
        url: expect.stringMatching(/^projects\/project-1\/images\/.+\.png$/),
        order: 0,
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      images: [
        { id: 'image-1', url: 'https://signed.example/projects/project-1/images/image-1.png', order: 0 },
        { id: 'image-2', url: 'https://signed.example/projects/project-1/images/image-2.jpg', order: 1 },
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
    expect(uploadProjectMedia).not.toHaveBeenCalled();
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

  it('deletes the Storage object when removing a Storage-backed image, but not for legacy data-URL images', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findFirst.mockResolvedValue({
      id: 'image-1',
      projectId: 'project-1',
      url: 'projects/project-1/images/image-1.png',
      order: 0,
    });
    const deleteHandler = createProjectImageDeleteHandler(deps as never);
    await deleteHandler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, mockResponse() as never);
    expect(deleteProjectMedia).toHaveBeenCalledWith('projects/project-1/images/image-1.png');

    deleteProjectMedia.mockClear();
    prisma.projectImage.findFirst.mockResolvedValue(firstImage);
    await deleteHandler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, mockResponse() as never);
    expect(deleteProjectMedia).not.toHaveBeenCalled();
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

  it('leaves the gallery unchanged after a failed delete of an already-removed image', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findFirst.mockResolvedValue(null);
    prisma.projectImage.findMany.mockResolvedValue([secondImage]);
    const deleteHandler = createProjectImageDeleteHandler(deps as never);
    const listHandler = createProjectImageListHandler(deps as never);

    const deleteRes = mockResponse();
    await deleteHandler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, deleteRes as never);
    expect(deleteRes.status).toHaveBeenCalledWith(404);

    const listRes = mockResponse();
    await listHandler({ headers: {}, params: { id: 'project-1' } } as never, listRes as never);
    expect(listRes.json).toHaveBeenCalledWith({
      images: [{ id: 'image-2', url: secondImage.url, order: 1 }],
    });
  });

  it('forbids image deletion for non-owners', async () => {
    const { deps, prisma } = setup({
      prisma: {
        project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', ownerId: 'another-user' }) },
      },
    });
    const handler = createProjectImageDeleteHandler(deps as never);
    const res = mockResponse();

    await handler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, res as never);

    expect(prisma.projectImage.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'not_owner' }));
  });

  it('rejects a reorder request that references an image id outside the project', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany.mockResolvedValue([firstImage, secondImage]);
    const handler = createProjectImageOrderHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      body: { order: ['image-1', 'image-does-not-exist'] },
    } as never, res as never);

    expect(prisma.projectImage.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'image_not_found' }));
  });

  it('reorders successfully with exactly two images', async () => {
    const { deps, prisma } = setup();
    prisma.projectImage.findMany
      .mockResolvedValueOnce([firstImage, secondImage])
      .mockResolvedValueOnce([secondImage, firstImage]);
    const handler = createProjectImageOrderHandler(deps as never);
    const res = mockResponse();

    await handler({
      headers: {},
      params: { id: 'project-1' },
      body: { order: ['image-2', 'image-1'] },
    } as never, res as never);

    expect(prisma.projectImage.update).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  describe('createProjectImageDownloadHandler', () => {
    it('streams a legacy data-URL image as a decoded buffer', async () => {
      const { deps, prisma } = setup();
      prisma.projectImage.findFirst.mockResolvedValue(firstImage);
      const handler = createProjectImageDownloadHandler(deps as never);
      const res = mockResponse();

      await handler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('fake', 'utf8'));
      expect(createProjectMediaSignedUrl).not.toHaveBeenCalled();
    });

    it('streams a Storage-backed image from a signed URL without buffering it as a data-URL', async () => {
      const { deps, prisma } = setup();
      prisma.projectImage.findFirst.mockResolvedValue({
        id: 'image-1',
        projectId: 'project-1',
        url: 'projects/project-1/images/image-1.png',
        order: 0,
      });
      const upstreamBody = {};
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        body: upstreamBody,
        headers: { get: (name: string) => (name === 'content-type' ? 'image/png' : null) },
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const handler = createProjectImageDownloadHandler(deps as never);
      const res = mockResponse();

      await handler({ headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never, res as never);

      expect(createProjectMediaSignedUrl).toHaveBeenCalledWith('projects/project-1/images/image-1.png');
      expect(fetchMock).toHaveBeenCalledWith('https://signed.example/projects/project-1/images/image-1.png');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.send).toHaveBeenCalledWith(upstreamBody);
    });

    it('returns 404 for a missing image', async () => {
      const { deps, prisma } = setup();
      prisma.projectImage.findFirst.mockResolvedValue(null);
      const handler = createProjectImageDownloadHandler(deps as never);
      const res = mockResponse();

      await handler({ headers: {}, params: { id: 'project-1', imageId: 'missing' } } as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('requires authentication and ownership', async () => {
      const { deps: unauthedDeps } = setup({
        validateSession: jest.fn().mockReturnValue({ valid: false, reason: 'missing_session' }),
      });
      const unauthedRes = mockResponse();
      await createProjectImageDownloadHandler(unauthedDeps as never)(
        { headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never,
        unauthedRes as never,
      );
      expect(unauthedRes.status).toHaveBeenCalledWith(401);

      const { deps: nonOwnerDeps } = setup({
        prisma: { project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', ownerId: 'another-user' }) } },
      });
      const nonOwnerRes = mockResponse();
      await createProjectImageDownloadHandler(nonOwnerDeps as never)(
        { headers: {}, params: { id: 'project-1', imageId: 'image-1' } } as never,
        nonOwnerRes as never,
      );
      expect(nonOwnerRes.status).toHaveBeenCalledWith(403);
    });
  });
});
