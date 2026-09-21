import crypto from 'node:crypto';
import path from 'node:path';
import type { Request, Response } from 'express';
import { extractOmlMetadata } from './attachments';

type ProjectVisibility = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_ATTACHMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const OML_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'text/xml',
  'application/xml',
]);
const SUPPORTED_ATTACHMENT_TYPES = {
  '.oml': OML_MIME_TYPES,
  '.pdf': new Set(['application/pdf']),
  '.txt': new Set(['', 'text/plain']),
  '.md': new Set(['', 'text/markdown', 'text/plain']),
  '.zip': new Set(['application/octet-stream', 'application/zip', 'application/x-zip-compressed']),
} as const;

type UploadedFile = {
  fieldname?: string;
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

type ProjectRecord = {
  id: string;
  ownerId?: string;
  title: string;
  slug: string;
  summary: string;
  projectType?: string | null;
  role: string;
  status: string;
  tags?: string[] | null;
  coverImageUrl?: string | null;
  problem?: string | null;
  features?: string | null;
  technicalNotes?: string | null;
  contribution?: string | null;
  outcome?: string | null;
  visibility: string;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  images?: ProjectImageRecord[];
  attachments?: AttachmentRecord[];
};

type ProjectImageRecord = {
  id: string;
  projectId: string;
  url: string;
  order?: number | null;
};

type OmlMetadataRecord = {
  moduleName: string;
  version: string;
};

type AttachmentRecord = {
  id: string;
  projectId: string;
  filename: string;
  url: string;
  fileType?: string | null;
  fileSize?: number | null;
  isOmlFile?: boolean | null;
  order?: number | null;
  omlMetadata?: OmlMetadataRecord | null;
};

type ProjectDependencies = {
  prisma: {
    project: {
      findFirst?(args: { where: { ownerId: string; slug: string } }): Promise<unknown | null>;
      create?(args: { data: Record<string, unknown>; include?: { images?: { orderBy: { order: 'asc' } }; attachments?: { include: { omlMetadata: true }; orderBy: { order: 'asc' } } } }): Promise<ProjectRecord>;
      findMany?(args: { where: { ownerId: string }; orderBy: { updatedAt: 'desc' } }): Promise<ProjectRecord[]>;
    };
    projectImage?: {
      create(args: { data: { id: string; projectId: string; url: string; order: number } }): Promise<ProjectImageRecord>;
    };
    projectAttachment?: {
      create(args: {
        data: {
          id: string;
          projectId: string;
          filename: string;
          url: string;
          fileType: string;
          fileSize: number;
          isOmlFile: boolean;
          order: number;
        };
        include?: { omlMetadata: true };
      }): Promise<AttachmentRecord>;
    };
    omlMetadata?: {
      upsert(args: {
        where: { attachmentId: string };
        update: OmlMetadataRecord;
        create: OmlMetadataRecord & { attachmentId: string };
      }): Promise<OmlMetadataRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
  storage: {
    uploadProjectMedia(key: string, buffer: Buffer, contentType: string): Promise<string>;
    resolveMediaUrl(value: string): Promise<string>;
  };
};

type ProjectPersistence = ProjectDependencies['prisma'];
type TransactionCapablePersistence = ProjectPersistence & {
  $transaction?<T>(callback: (tx: ProjectPersistence) => Promise<T>): Promise<T>;
};

type ProjectInput = {
  title?: unknown;
  summary?: unknown;
  projectType?: unknown;
  role?: unknown;
  status?: unknown;
  tags?: unknown;
  coverImageUrl?: unknown;
  problem?: unknown;
  features?: unknown;
  technicalNotes?: unknown;
  contribution?: unknown;
  outcome?: unknown;
  visibility?: unknown;
};

type ParsedProjectData = {
  title: string;
  summary: string;
  role: string;
  projectType: string;
  status: string;
  tags: string[];
  coverImageUrl: string;
  problem: string;
  features: string;
  technicalNotes: string;
  contribution: string;
  outcome: string;
  visibility: ProjectVisibility;
};

export function slugifyProjectTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeVisibility(value: unknown): ProjectVisibility {
  if (typeof value !== 'string') return 'DRAFT';
  const normalized = value.toLowerCase();
  if (normalized === 'published') return 'PUBLISHED';
  if (normalized === 'unpublished') return 'UNPUBLISHED';
  return 'DRAFT';
}

function serializeVisibility(value: string) {
  return value.toLowerCase();
}

function isLegacyAttachmentUrl(url: string) {
  return !url || url.startsWith('/api/v1/');
}

// Story 9564046: coverImageUrl/image urls may be a Storage object key
// (new uploads) that needs resolving to a signed URL, or a legacy
// base64 data-URL / plain external URL that passes through unchanged
// (storage.resolveMediaUrl handles that distinction - see src/lib/storage.ts).
// Attachment urls are a self-link download path either way (legacy
// self-link string as originally stored, or synthesized fresh for
// Storage-backed rows) - see the matching logic in projects/attachments.ts.
async function serializeProject(storage: ProjectDependencies['storage'], project: ProjectRecord) {
  const [coverImageUrl, images] = await Promise.all([
    storage.resolveMediaUrl(project.coverImageUrl ?? ''),
    Promise.all((project.images ?? []).map(async (image) => ({
      id: image.id,
      url: await storage.resolveMediaUrl(image.url),
      order: image.order ?? 0,
    }))),
  ]);

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    projectType: project.projectType ?? '',
    role: project.role,
    status: project.status,
    tags: project.tags ?? [],
    coverImageUrl,
    problem: project.problem ?? '',
    features: project.features ?? '',
    technicalNotes: project.technicalNotes ?? '',
    contribution: project.contribution ?? '',
    outcome: project.outcome ?? '',
    visibility: serializeVisibility(project.visibility),
    publishedAt: project.publishedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    images,
    attachments: (project.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      url: isLegacyAttachmentUrl(attachment.url)
        ? attachment.url
        : storedAttachmentUrl(project.id, attachment.id, attachment.filename),
      fileType: attachment.fileType ?? '',
      fileSize: attachment.fileSize ?? 0,
      isOmlFile: Boolean(attachment.isOmlFile),
      order: attachment.order ?? 0,
      metadata: attachment.omlMetadata
        ? {
            moduleName: attachment.omlMetadata.moduleName,
            version: attachment.omlMetadata.version,
          }
        : null,
    })),
  };
}

function filesFrom(req: Request) {
  const files = (req as Request & { files?: UploadedFile[] }).files;
  return Array.isArray(files) ? files : [];
}

function filesByField(req: Request, names: string[]) {
  const fields = new Set(names);
  return filesFrom(req).filter((file) => fields.has(file.fieldname ?? ''));
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

async function storeImageFile(storage: ProjectDependencies['storage'], projectId: string, imageId: string, file: UploadedFile) {
  const extension = IMAGE_EXTENSIONS[file.mimetype ?? ''] ?? '';
  const key = `projects/${projectId}/images/${imageId}${extension}`;
  return storage.uploadProjectMedia(key, file.buffer, file.mimetype || 'application/octet-stream');
}

function baseName(filename: string) {
  return path.basename(filename).replace(/[^\w.\- ]/g, '_');
}

function attachmentExtension(filename: string) {
  return path.extname(filename).toLowerCase() as keyof typeof SUPPORTED_ATTACHMENT_TYPES;
}

function storedAttachmentUrl(projectId: string, attachmentId: string, filename: string) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}/download?filename=${encodeURIComponent(filename)}`;
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

  return { status: 200, body: null };
}

function validateAttachmentFile(file: UploadedFile) {
  const filename = baseName(file.originalname);
  const extension = attachmentExtension(filename);
  const supportedMimeTypes = SUPPORTED_ATTACHMENT_TYPES[extension];

  if (!supportedMimeTypes) {
    return {
      status: 415,
      body: {
        error: 'unsupported_media_type',
        message: 'Only .oml, PDF, text, Markdown, or ZIP attachments can be uploaded.',
      },
    };
  }

  if (!supportedMimeTypes.has(file.mimetype ?? '')) {
    return {
      status: 415,
      body: {
        error: 'unsupported_media_type',
        message: `The ${extension} file type is not supported.`,
      },
    };
  }

  if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    return {
      status: 413,
      body: {
        error: 'payload_too_large',
        message: 'Attachments must be 50 MiB or smaller.',
      },
    };
  }

  if (extension !== '.oml') {
    return { status: 200, body: null };
  }

  const metadata = extractOmlMetadata(file, filename);
  if (!metadata) {
    return {
      status: 422,
      body: {
        error: 'invalid_oml_file',
        message: 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
      },
    };
  }

  return { status: 200, body: metadata };
}

function validateProjectMedia(req: Request) {
  const coverImages = filesByField(req, ['coverImage', 'coverImageFile']);
  const galleryImages = filesByField(req, ['images', 'galleryImages', 'imageFiles']);
  const attachments = filesByField(req, ['attachments', 'attachmentFiles']);

  for (const file of [...coverImages, ...galleryImages]) {
    const validation = validateImageFile(file);
    if (validation.status !== 200) return validation;
  }

  for (const file of attachments) {
    const validation = validateAttachmentFile(file);
    if (validation.status !== 200) return validation;
  }

  return {
    status: 200,
    body: {
      coverImage: coverImages[0] ?? null,
      galleryImages,
      attachments,
    },
  };
}

async function createProjectWithMedia(
  deps: ProjectDependencies,
  session: { userId: string },
  data: ParsedProjectData,
  slug: string,
  media: {
    coverImage: UploadedFile | null;
    galleryImages: UploadedFile[];
    attachments: UploadedFile[];
  },
) {
  // Uploads to Supabase Storage are network I/O, not database work - they
  // run before the transaction opens, so the DB transaction itself only
  // ever does fast, local writes. Storage keys are namespaced under a
  // fresh id generated just for this request (uploadNamespace), not the
  // eventual Prisma-assigned project id (which isn't known until
  // tx.project.create runs) - the two are otherwise unrelated.
  const uploadNamespace = crypto.randomUUID();
  const coverImageKey = media.coverImage
    ? await storeImageFile(deps.storage, uploadNamespace, crypto.randomUUID(), media.coverImage)
    : null;
  const galleryImageUploads = await Promise.all(
    media.galleryImages.map(async (file) => {
      const id = crypto.randomUUID();
      const url = await storeImageFile(deps.storage, uploadNamespace, id, file);
      return { id, url };
    }),
  );
  const attachmentUploads = await Promise.all(
    media.attachments.map(async (file) => {
      const id = crypto.randomUUID();
      const filename = baseName(file.originalname);
      const key = `projects/${uploadNamespace}/attachments/${id}-${filename}`;
      const url = await deps.storage.uploadProjectMedia(key, file.buffer, file.mimetype || 'application/octet-stream');
      return { id, filename, url, file };
    }),
  );

  const create = async (tx: ProjectPersistence) => {
    const coverImageUrl = coverImageKey ?? data.coverImageUrl;
    const project = await tx.project.create?.({
      data: {
        ownerId: session.userId,
        ...data,
        coverImageUrl,
        slug,
        visibility: 'DRAFT',
        publishedAt: null,
      },
    });

    const projectId = (project as ProjectRecord).id;
    const images: ProjectImageRecord[] = [];
    for (const [order, { id, url }] of galleryImageUploads.entries()) {
      const image = await tx.projectImage?.create({
        data: {
          id,
          projectId,
          url,
          order,
        },
      });
      if (image) images.push(image);
    }

    const attachments: AttachmentRecord[] = [];
    for (const [order, { id, filename, url, file }] of attachmentUploads.entries()) {
      const extension = attachmentExtension(filename);
      const isOmlFile = extension === '.oml';
      const metadata = validateAttachmentFile(file).body as OmlMetadataRecord | null;
      const attachment = await tx.projectAttachment?.create({
        data: {
          id,
          projectId,
          filename,
          url,
          fileType: file.mimetype ?? 'application/octet-stream',
          fileSize: file.size,
          isOmlFile,
          order,
        },
        include: { omlMetadata: true },
      });

      if (attachment && isOmlFile && metadata) {
        await tx.omlMetadata?.upsert({
          where: { attachmentId: attachment.id },
          update: metadata,
          create: { attachmentId: attachment.id, ...metadata },
        });
      }

      if (attachment) attachments.push({ ...attachment, omlMetadata: metadata });
    }

    return {
      ...(project as ProjectRecord),
      coverImageUrl,
      images,
      attachments,
    };
  };

  if (media.coverImage || media.galleryImages.length > 0 || media.attachments.length > 0) {
    const transaction = (deps.prisma as TransactionCapablePersistence).$transaction;
    if (typeof transaction === 'function') {
      return transaction.call(deps.prisma, create);
    }
  }

  return create(deps.prisma);
}

function parseProjectInput(body: ProjectInput) {
  const title = normalizeText(body.title);
  const summary = normalizeText(body.summary);
  const role = normalizeText(body.role);
  const fields: Record<string, string> = {};

  if (!title) fields.title = 'Title is required.';
  if (!summary) fields.summary = 'Summary is required.';
  if (!role) fields.role = 'Role is required.';

  if (Object.keys(fields).length > 0) {
    return { valid: false as const, fields };
  }

  return {
    valid: true as const,
    data: {
      title,
      summary,
      role,
      projectType: normalizeText(body.projectType),
      status: normalizeText(body.status) || 'draft',
      tags: normalizeTextList(body.tags),
      coverImageUrl: normalizeText(body.coverImageUrl),
      problem: normalizeText(body.problem),
      features: normalizeText(body.features),
      technicalNotes: normalizeText(body.technicalNotes),
      contribution: normalizeText(body.contribution),
      outcome: normalizeText(body.outcome),
      visibility: normalizeVisibility(body.visibility),
    },
  };
}

export function createProjectHandler(deps: ProjectDependencies) {
  return async function projectCreateHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);
      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const parsed = parseProjectInput((req.body ?? {}) as ProjectInput);
      if (!parsed.valid) {
        return res.status(400).json({
          error: 'malformed_input',
          message: 'Project input is invalid.',
          fields: parsed.fields,
        });
      }

      const slug = slugifyProjectTitle(parsed.data.title);
      const existingProject = await deps.prisma.project.findFirst?.({
        where: { ownerId: session.userId, slug },
      });

      if (existingProject) {
        return res.status(409).json({
          error: 'duplicate_slug',
          message: 'A project with this slug already exists. Choose a unique title.',
        });
      }

      const mediaValidation = validateProjectMedia(req);
      if (mediaValidation.status !== 200) {
        return res.status(mediaValidation.status).json(mediaValidation.body);
      }

      const project = await createProjectWithMedia(
        deps,
        session,
        parsed.data,
        slug,
        mediaValidation.body as {
          coverImage: UploadedFile | null;
          galleryImages: UploadedFile[];
          attachments: UploadedFile[];
        },
      );

      return res.status(200).json(await serializeProject(deps.storage, project as ProjectRecord));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not create the project.',
      });
    }
  };
}

export function createProjectListHandler(deps: ProjectDependencies) {
  return async function projectListHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);
      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const projects = await deps.prisma.project.findMany?.({
        where: { ownerId: session.userId },
        orderBy: { updatedAt: 'desc' },
      });

      return res.status(200).json({
        projects: await Promise.all((projects ?? []).map((project) => serializeProject(deps.storage, project))),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve projects.',
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
  return { prisma: prisma as unknown as ProjectDependencies['prisma'], validateSession, storage };
}

export async function projectCreateHandler(req: Request, res: Response) {
  return createProjectHandler(await dependencies())(req, res);
}

export async function projectListHandler(req: Request, res: Response) {
  return createProjectListHandler(await dependencies())(req, res);
}
