import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { slugifyProjectTitle } from './create';

type ProjectVisibility = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';

type ProjectRecord = {
  id: string;
  ownerId: string;
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
};

type ProjectUpdateDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
      findFirst(args: { where: { ownerId: string; slug: string; NOT: { id: string } } }): Promise<unknown | null>;
      update(args: { where: { id: string }; data: ProjectUpdateData }): Promise<ProjectRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
  storage: {
    resolveMediaUrl(value: string): Promise<string>;
    uploadProjectMedia(key: string, buffer: Buffer, contentType: string): Promise<string>;
  };
};

type UploadedFile = {
  fieldname?: string;
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function coverImageFileFrom(req: Request) {
  const files = (req as Request & { files?: UploadedFile[] }).files;
  if (!Array.isArray(files)) return null;
  return files.find((file) => file.fieldname === 'coverImage' || file.fieldname === 'coverImageFile') ?? null;
}

function validateCoverImageFile(file: UploadedFile) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype ?? '')) {
    return 'Only JPEG, PNG, GIF, or WebP images can be uploaded.';
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return 'Images must be 10 MiB or smaller.';
  }
  if (!file.buffer || file.buffer.length === 0) {
    return 'The uploaded image file is empty or invalid.';
  }
  return null;
}

type ProjectUpdateInput = {
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
  publishedAt?: unknown;
};

type ProjectUpdateData = {
  title: string;
  slug: string;
  summary: string;
  projectType: string;
  role: string;
  status: string;
  tags: string[];
  coverImageUrl: string;
  problem: string;
  features: string;
  technicalNotes: string;
  contribution: string;
  outcome: string;
  visibility: ProjectVisibility;
  publishedAt: Date | null;
  updatedAt: Date;
};

type FieldErrors = Partial<Record<keyof ProjectUpdateInput, string>>;

const optionalTextFields = [
  'projectType',
  'coverImageUrl',
  'problem',
  'features',
  'technicalNotes',
  'contribution',
  'outcome',
] as const;

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

function requiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown, field: string, fields: FieldErrors) {
  if (value == null) return '';
  if (typeof value !== 'string') {
    fields[field as keyof ProjectUpdateInput] = `${field} must be text.`;
    return '';
  }
  return value.trim();
}

function normalizeVisibility(value: unknown, fields: FieldErrors): ProjectVisibility | null {
  if (typeof value !== 'string' || !value.trim()) {
    fields.visibility = 'Visibility is required.';
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'DRAFT' || normalized === 'PUBLISHED' || normalized === 'UNPUBLISHED') {
    return normalized;
  }

  fields.visibility = 'Visibility must be draft, published, or unpublished.';
  return null;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizePublishedAt(value: unknown, fields: FieldErrors) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    fields.publishedAt = 'Published date must be a valid ISO date.';
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    fields.publishedAt = 'Published date must be a valid ISO date.';
    return null;
  }

  return new Date(timestamp);
}

function parseProjectUpdateInput(body: ProjectUpdateInput) {
  const fields: FieldErrors = {};
  const title = requiredText(body.title);
  const summary = requiredText(body.summary);
  const role = requiredText(body.role);
  const status = requiredText(body.status);
  const visibility = normalizeVisibility(body.visibility, fields);
  const publishedAt = normalizePublishedAt(body.publishedAt, fields);

  if (!title) fields.title = 'Title is required.';
  if (!summary) fields.summary = 'Summary is required.';
  if (!role) fields.role = 'Role is required.';
  if (!status) fields.status = 'Status is required.';

  const normalizedOptionalFields = optionalTextFields.reduce<Record<string, string>>((acc, field) => {
    acc[field] = optionalText(body[field], field, fields);
    return acc;
  }, {});

  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    if (body.tags.some((tag) => typeof tag !== 'string')) {
      fields.tags = 'Tags must be an array of text values.';
    } else {
      tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
    }
  } else if (body.tags == null || body.tags === '') {
    tags = [];
  } else {
    fields.tags = 'Tags must be an array of text values.';
  }

  if (normalizedOptionalFields.coverImageUrl && !validHttpUrl(normalizedOptionalFields.coverImageUrl)) {
    fields.coverImageUrl = 'Cover image URL must be an HTTP or HTTPS URL.';
  }

  if (Object.keys(fields).length > 0 || !visibility) {
    return { valid: false as const, fields };
  }

  return {
    valid: true as const,
    data: {
      title,
      slug: slugifyProjectTitle(title),
      summary,
      projectType: normalizedOptionalFields.projectType,
      role,
      status,
      tags,
      coverImageUrl: normalizedOptionalFields.coverImageUrl,
      problem: normalizedOptionalFields.problem,
      features: normalizedOptionalFields.features,
      technicalNotes: normalizedOptionalFields.technicalNotes,
      contribution: normalizedOptionalFields.contribution,
      outcome: normalizedOptionalFields.outcome,
      visibility,
      publishedAt,
      updatedAt: new Date(),
    },
  };
}

function serializeVisibility(value: string) {
  return value.toLowerCase();
}

async function serializeProject(storage: ProjectUpdateDependencies['storage'], project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    projectType: project.projectType ?? '',
    role: project.role,
    status: project.status,
    tags: project.tags ?? [],
    coverImageUrl: await storage.resolveMediaUrl(project.coverImageUrl ?? ''),
    problem: project.problem ?? '',
    features: project.features ?? '',
    technicalNotes: project.technicalNotes ?? '',
    contribution: project.contribution ?? '',
    outcome: project.outcome ?? '',
    visibility: serializeVisibility(project.visibility),
    publishedAt: project.publishedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function createProjectUpdateHandler(deps: ProjectUpdateDependencies) {
  return async function projectUpdateHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);
      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const projectId = projectIdFrom(req);
      if (!projectId) {
        return res.status(400).json({
          error: 'malformed_project_id',
          message: 'Project id is required.',
        });
      }

      const parsed = parseProjectUpdateInput((req.body ?? {}) as ProjectUpdateInput);
      if (!parsed.valid) {
        return res.status(422).json({
          error: 'validation_failed',
          message: 'Project input is invalid.',
          fields: parsed.fields,
        });
      }

      const project = await deps.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return res.status(404).json({
          error: 'project_not_found',
          message: 'Project not found.',
        });
      }

      if (project.ownerId !== session.userId) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'You do not have access to this project.',
        });
      }

      const duplicateSlugProject = await deps.prisma.project.findFirst({
        where: {
          ownerId: session.userId,
          slug: parsed.data.slug,
          NOT: { id: projectId },
        },
      });

      if (duplicateSlugProject) {
        return res.status(409).json({
          error: 'duplicate_slug',
          message: 'A project with this slug already exists. Choose a unique title.',
        });
      }

      // Story 9564046: replacing the cover image with a new file (edit
      // mode) uploads the real file to Supabase Storage here, exactly
      // like project creation already does - the old behavior
      // (base64-encoding the file client-side into the coverImageUrl
      // text field) never actually put it in Storage. This is the one
      // case that legitimately writes a new Storage key, so it bypasses
      // both the http(s) URL validation and the round-trip guard below,
      // neither of which apply to a genuinely new upload.
      const coverImageFile = coverImageFileFrom(req);
      let coverImageUrl: string;

      if (coverImageFile) {
        const validationError = validateCoverImageFile(coverImageFile);
        if (validationError) {
          return res.status(415).json({
            error: 'unsupported_media_type',
            message: validationError,
          });
        }

        const extension = IMAGE_EXTENSIONS[coverImageFile.mimetype ?? ''] ?? '';
        const key = `projects/${projectId}/cover/${crypto.randomUUID()}${extension}`;
        coverImageUrl = await deps.storage.uploadProjectMedia(key, coverImageFile.buffer, coverImageFile.mimetype || 'application/octet-stream');
      } else {
        // coverImageUrl in a GET/list response may be a signed Storage
        // URL resolved from a stored key (see src/lib/storage.ts). The
        // edit form round-trips whatever it was shown back through this
        // endpoint's free-text URL field when the owner saves without
        // picking a new cover file. Since a signed URL is itself a valid
        // https:// URL, persisting it verbatim would silently replace
        // the stable Storage key with a URL that expires - detect that
        // exact round-trip and keep the original stored value (the key)
        // instead of overwriting it with its own resolved form.
        const resolvedExistingCoverImageUrl = await deps.storage.resolveMediaUrl(project.coverImageUrl ?? '');
        coverImageUrl =
          parsed.data.coverImageUrl === resolvedExistingCoverImageUrl
            ? (project.coverImageUrl ?? '')
            : parsed.data.coverImageUrl;
      }

      const updatedProject = await deps.prisma.project.update({
        where: { id: projectId },
        data: { ...parsed.data, coverImageUrl },
      });

      return res.status(200).json(await serializeProject(deps.storage, updatedProject));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not update the project.',
      });
    }
  };
}

export async function projectUpdateHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }, storage] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
    import('@/src/lib/storage'),
  ]);

  return createProjectUpdateHandler({ prisma, validateSession, storage })(req, res);
}
