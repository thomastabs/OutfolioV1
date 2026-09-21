import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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

function imageResponse(image: ProjectImageRecord) {
  return {
    id: image.id,
    url: image.url,
    order: image.order ?? 0,
  };
}

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
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

function storedImageUrl(file: UploadedFile) {
  const mimeType = file.mimetype || 'application/octet-stream';
  return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
}

async function orderedImages(deps: ImagesDependencies, projectId: string) {
  const images = await deps.prisma.projectImage.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  return images.map(imageResponse);
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
        await deps.prisma.projectImage.create({
          data: {
            id: crypto.randomUUID(),
            projectId: authorized.project.id,
            url: storedImageUrl(file),
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

async function dependencies() {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);
  return { prisma, validateSession };
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
