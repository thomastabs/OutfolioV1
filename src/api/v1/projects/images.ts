import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

type UploadedFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

type ProjectRecord = {
  id: string;
  ownerId: string;
};

type ProjectImageRecord = {
  id: string;
  projectId: string;
  url: string;
  order?: number | null;
};

type ProjectImageCreateInput = {
  id: string;
  projectId: string;
  url: string;
  order: number;
};

type StorageDependencies = {
  uploadProjectMedia(key: string, buffer: Buffer, contentType: string): Promise<string>;
  createProjectMediaSignedUrl(key: string): Promise<string>;
  deleteProjectMedia(key: string): Promise<void>;
  isStorageKey(value: string): boolean;
  resolveMediaUrl(value: string): Promise<string>;
  parseDataUrl(value: string): { mimeType: string; buffer: Buffer } | null;
};

type ImagesDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
    };
    projectImage: {
      findMany(args: { where: { projectId: string }; orderBy?: { order: 'asc' } }): Promise<ProjectImageRecord[]>;
      findFirst(args: { where: { id: string; projectId: string } }): Promise<ProjectImageRecord | null>;
      create(args: { data: ProjectImageCreateInput }): Promise<ProjectImageRecord>;
      delete(args: { where: { id: string } }): Promise<ProjectImageRecord>;
      update(args: { where: { id: string }; data: { order: number } }): Promise<ProjectImageRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
  storage: StorageDependencies;
};

type AuthorizedProjectResult =
  | { ok: true; project: ProjectRecord }
  | { ok: false; response: Response };

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

function imageIdFrom(req: Request) {
  return typeof req.params?.imageId === 'string' ? req.params.imageId.trim() : '';
}

function filesFrom(req: Request) {
  const files = (req as Request & { files?: UploadedFile[] }).files;
  return Array.isArray(files) ? files : [];
}

async function imageResponse(storage: StorageDependencies, image: ProjectImageRecord) {
  return {
    id: image.id,
    url: await storage.resolveMediaUrl(image.url),
    order: image.order ?? 0,
  };
}

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function contentDispositionFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, '_');
}

async function authorizeProject(
  deps: ImagesDependencies,
  req: Request,
  res: Response,
): Promise<AuthorizedProjectResult> {
  const session = deps.validateSession(req);
  if (!session.valid) {
    return { ok: false, response: missingOrInvalidAuth(res) };
  }

  const projectId = projectIdFrom(req);
  if (!projectId) {
    return {
      ok: false,
      response: res.status(400).json({
        error: 'malformed_project_id',
        message: 'Project id is required.',
      }),
    };
  }

  const project = await deps.prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return {
      ok: false,
      response: res.status(404).json({
        error: 'project_not_found',
        message: 'Project not found.',
      }),
    };
  }

  if (project.ownerId !== session.userId) {
    return {
      ok: false,
      response: res.status(403).json({
        error: 'not_owner',
        message: 'Only the project owner can manage images.',
      }),
    };
  }

  return { ok: true, project };
}

function validateImageFile(file: UploadedFile) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype ?? '')) {
    return {
      status: 415,
      body: {
        error: 'unsupported_media_type',
        message: 'Only JPEG, PNG, GIF, or WebP images can be uploaded.',
      },
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      status: 413,
      body: {
        error: 'payload_too_large',
        message: 'Images must be 10 MiB or smaller.',
      },
    };
  }

  if (!file.buffer || file.buffer.length === 0) {
    return {
      status: 422,
      body: {
        error: 'invalid_image_file',
        message: 'The uploaded image file is empty or invalid.',
      },
    };
  }

  return { status: 200, body: { ok: true } };
}

// Story 9564046: new uploads are written to Supabase Storage (a
// `projects/{projectId}/images/{imageId}{ext}` object key is stored in
// `url`, resolved to a signed URL at read time by resolveMediaUrl). Pre-
// existing rows written before this story keep their base64 data-URL in
// `url` unmigrated (SC-3) - resolveMediaUrl passes those through as-is.
function storageKeyForImage(projectId: string, imageId: string, file: UploadedFile) {
  const extension = IMAGE_EXTENSIONS[file.mimetype ?? ''] ?? '';
  return `projects/${projectId}/images/${imageId}${extension}`;
}

async function storeImageFile(storage: StorageDependencies, projectId: string, imageId: string, file: UploadedFile) {
  const contentType = file.mimetype || 'application/octet-stream';
  const key = storageKeyForImage(projectId, imageId, file);
  return storage.uploadProjectMedia(key, file.buffer, contentType);
}

async function orderedImages(deps: ImagesDependencies, projectId: string) {
  const images = await deps.prisma.projectImage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  return Promise.all(images.map((image) => imageResponse(deps.storage, image)));
}

async function nextOrder(deps: ImagesDependencies, projectId: string) {
  const existing = await deps.prisma.projectImage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  return existing.length;
}

export function createProjectImageListHandler(deps: ImagesDependencies) {
  return async function projectImageListHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      return res.status(200).json({ images: await orderedImages(deps, authorized.project.id) });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not load project images.',
      });
    }
  };
}

export function createProjectImageUploadHandler(deps: ImagesDependencies) {
  return async function projectImageUploadHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const files = filesFrom(req);
      if (files.length === 0) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'At least one image file is required.',
        });
      }

      for (const file of files) {
        const validation = validateImageFile(file);
        if (validation.status !== 200) {
          return res.status(validation.status).json(validation.body);
        }
      }

      let order = await nextOrder(deps, authorized.project.id);
      for (const file of files) {
        const id = crypto.randomUUID();
        const url = await storeImageFile(deps.storage, authorized.project.id, id, file);
        await deps.prisma.projectImage.create({
          data: {
            id,
            projectId: authorized.project.id,
            url,
            order,
          },
        });
        order += 1;
      }

      return res.status(200).json({ images: await orderedImages(deps, authorized.project.id) });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not upload project images.',
      });
    }
  };
}

export function createProjectImageDeleteHandler(deps: ImagesDependencies) {
  return async function projectImageDeleteHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const imageId = imageIdFrom(req);
      const image = await deps.prisma.projectImage.findFirst({
        where: { id: imageId, projectId: authorized.project.id },
      });
      if (!image) {
        return res.status(404).json({
          error: 'image_not_found',
          message: 'Image not found.',
        });
      }

      await deps.prisma.projectImage.delete({ where: { id: image.id } });
      if (deps.storage.isStorageKey(image.url)) {
        await deps.storage.deleteProjectMedia(image.url);
      }
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not delete the project image.',
      });
    }
  };
}

export function createProjectImageOrderHandler(deps: ImagesDependencies) {
  return async function projectImageOrderHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const order = (req.body as { order?: unknown } | undefined)?.order;
      if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Image order must be an array of image ids.',
        });
      }

      const existingImages = await deps.prisma.projectImage.findMany({
        where: { projectId: authorized.project.id },
        orderBy: { order: 'asc' },
      });
      const existingIds = new Set(existingImages.map((image) => image.id));
      if (order.some((id) => !existingIds.has(id))) {
        return res.status(404).json({
          error: 'image_not_found',
          message: 'One or more images do not belong to this project.',
        });
      }

      await Promise.all(order.map((id, index) => deps.prisma.projectImage.update({
        where: { id },
        data: { order: index },
      })));

      return res.status(200).json({ images: await orderedImages(deps, authorized.project.id) });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not reorder project images.',
      });
    }
  };
}

// Story 9564046 (pack-3): streams the image file for the owner rather
// than returning a URL, so a signed Storage URL is never handed to the
// client directly for this authenticated path.
export function createProjectImageDownloadHandler(deps: ImagesDependencies) {
  return async function projectImageDownloadHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const imageId = imageIdFrom(req);
      const image = await deps.prisma.projectImage.findFirst({
        where: { id: imageId, projectId: authorized.project.id },
      });
      if (!image) {
        return res.status(404).json({
          error: 'image_not_found',
          message: 'Image not found.',
        });
      }

      const parsedDataUrl = deps.storage.parseDataUrl(image.url);
      if (parsedDataUrl) {
        const extension = IMAGE_EXTENSIONS[parsedDataUrl.mimeType] ?? '';
        res.status(200);
        res.setHeader('Content-Type', parsedDataUrl.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${contentDispositionFilename(`${image.id}${extension}`)}"`);
        return res.send(parsedDataUrl.buffer);
      }

      const signedUrl = await deps.storage.createProjectMediaSignedUrl(image.url);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        return res.status(500).json({
          error: 'unexpected_failure',
          message: 'Could not download the image.',
        });
      }

      const extension = image.url.slice(image.url.lastIndexOf('.'));
      res.status(200);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${contentDispositionFilename(`${image.id}${extension.length <= 5 ? extension : ''}`)}"`);
      return res.send(upstream.body as never);
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not download the image.',
      });
    }
  };
}

async function dependencies() {
  const [{ prisma }, { validateSession }, storage] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
    import('@/src/lib/storage'),
  ]);
  return { prisma, validateSession, storage };
}

export async function projectImageListHandler(req: Request, res: Response) {
  return createProjectImageListHandler(await dependencies())(req, res);
}

export async function projectImageUploadHandler(req: Request, res: Response) {
  return createProjectImageUploadHandler(await dependencies())(req, res);
}

export async function projectImageDeleteHandler(req: Request, res: Response) {
  return createProjectImageDeleteHandler(await dependencies())(req, res);
}

export async function projectImageOrderHandler(req: Request, res: Response) {
  return createProjectImageOrderHandler(await dependencies())(req, res);
}

export async function projectImageDownloadHandler(req: Request, res: Response) {
  return createProjectImageDownloadHandler(await dependencies())(req, res);
}
