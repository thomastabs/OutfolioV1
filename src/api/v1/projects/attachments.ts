import crypto from 'node:crypto';
import path from 'node:path';
import type { Request, Response } from 'express';

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
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

type ProjectRecord = {
  id: string;
  ownerId: string;
  visibility?: string;
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

type AttachmentCreateInput = {
  id: string;
  projectId: string;
  filename: string;
  url: string;
  fileType: string;
  fileSize: number;
  isOmlFile: boolean;
  order: number;
};

type AttachmentsDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
    };
    projectAttachment: {
      findMany(args: {
        where: { projectId: string };
        include?: { omlMetadata: true };
        orderBy?: { order: 'asc' };
      }): Promise<AttachmentRecord[]>;
      findFirst(args: { where: { id: string; projectId: string } }): Promise<AttachmentRecord | null>;
      create(args: { data: AttachmentCreateInput; include?: { omlMetadata: true } }): Promise<AttachmentRecord>;
      delete(args: { where: { id: string } }): Promise<AttachmentRecord>;
      update(args: { where: { id: string }; data: { order: number } }): Promise<AttachmentRecord>;
    };
    omlMetadata: {
      upsert(args: {
        where: { attachmentId: string };
        update: OmlMetadataRecord;
        create: OmlMetadataRecord & { attachmentId: string };
      }): Promise<OmlMetadataRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
};

type AuthorizedProjectResult =
  | { ok: true; project: ProjectRecord }
  | { ok: false; response: Response };

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

function attachmentIdFrom(req: Request) {
  return typeof req.params?.attachmentId === 'string' ? req.params.attachmentId.trim() : '';
}

function filesFrom(req: Request) {
  const files = (req as Request & { files?: UploadedFile[] }).files;
  return Array.isArray(files) ? files : [];
}

function publicDownloadBody(attachment: AttachmentRecord) {
  return Buffer.from([
    `Outfolio attachment download`,
    `Filename: ${attachment.filename}`,
    `Attachment: ${attachment.id}`,
    `Project: ${attachment.projectId}`,
    '',
  ].join('\n'));
}

function contentDispositionFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, '_');
}

async function authorizeProject(
  deps: AttachmentsDependencies,
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
        message: 'Only the project owner can manage attachments.',
      }),
    };
  }

  return { ok: true, project };
}

function attachmentResponse(attachment: AttachmentRecord) {
  return {
    id: attachment.id,
    filename: attachment.filename,
    url: attachment.url,
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
  };
}

function baseName(filename: string) {
  return path.basename(filename).replace(/[^\w.\- ]/g, '_');
}

function attachmentExtension(filename: string) {
  return path.extname(filename).toLowerCase() as keyof typeof SUPPORTED_ATTACHMENT_TYPES;
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

export function extractOmlMetadata(file: UploadedFile, filename = baseName(file.originalname)) {
  if (!file.buffer || file.buffer.length === 0) return null;

  const text = file.buffer.toString('utf8');
  const suspiciousContent = /\b(corrupt|corrupted|invalid_oml|not an oml)\b/i.test(text);
  if (suspiciousContent) return null;

  const moduleName =
    text.match(/moduleName\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ||
    text.match(/<moduleName>([^<]+)<\/moduleName>/i)?.[1]?.trim() ||
    text.match(/<name>([^<]+)<\/name>/i)?.[1]?.trim() ||
    filename.replace(/\.oml$/i, '').trim();
  const version =
    text.match(/version\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ||
    text.match(/<version>([^<]+)<\/version>/i)?.[1]?.trim() ||
    'unknown';

  if (!moduleName) return null;
  return { moduleName, version };
}

function storedAttachmentUrl(projectId: string, attachmentId: string, filename: string) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}/download?filename=${encodeURIComponent(filename)}`;
}

async function nextOrder(deps: AttachmentsDependencies, projectId: string) {
  const existing = await deps.prisma.projectAttachment.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
  return existing.length;
}

export function createProjectAttachmentUploadHandler(deps: AttachmentsDependencies) {
  return async function projectAttachmentUploadHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const files = filesFrom(req);
      if (files.length === 0) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'At least one attachment file is required.',
        });
      }

      for (const file of files) {
        const validation = validateAttachmentFile(file);
        if (validation.status !== 200) {
          return res.status(validation.status).json(validation.body);
        }
      }

      let order = await nextOrder(deps, authorized.project.id);
      const attachments: AttachmentRecord[] = [];
      for (const file of files) {
        const validation = validateAttachmentFile(file);

        const id = crypto.randomUUID();
        const filename = baseName(file.originalname);
        const isOmlFile = attachmentExtension(filename) === '.oml';
        const attachment = await deps.prisma.projectAttachment.create({
          data: {
            id,
            projectId: authorized.project.id,
            filename,
            url: storedAttachmentUrl(authorized.project.id, id, filename),
            fileType: file.mimetype ?? 'application/octet-stream',
            fileSize: file.size,
            isOmlFile,
            order,
          },
          include: { omlMetadata: true },
        });
        const metadata = validation.body as OmlMetadataRecord | null;
        if (isOmlFile && metadata) {
          await deps.prisma.omlMetadata.upsert({
            where: { attachmentId: attachment.id },
            update: metadata,
            create: { attachmentId: attachment.id, ...metadata },
          });
        }

        attachments.push({ ...attachment, omlMetadata: metadata });
        order += 1;
      }

      return res.status(200).json({
        attachments: attachments.map(attachmentResponse),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not upload the project attachment.',
      });
    }
  };
}

export function createProjectAttachmentListHandler(deps: AttachmentsDependencies) {
  return async function projectAttachmentListHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const attachments = await deps.prisma.projectAttachment.findMany({
        where: { projectId: authorized.project.id },
        include: { omlMetadata: true },
        orderBy: { order: 'asc' },
      });

      return res.status(200).json({
        attachments: attachments.map(attachmentResponse),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not load project attachments.',
      });
    }
  };
}

export function createProjectAttachmentDeleteHandler(deps: AttachmentsDependencies) {
  return async function projectAttachmentDeleteHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const attachmentId = attachmentIdFrom(req);
      const attachment = await deps.prisma.projectAttachment.findFirst({
        where: { id: attachmentId, projectId: authorized.project.id },
      });
      if (!attachment) {
        return res.status(404).json({
          error: 'attachment_not_found',
          message: 'Attachment not found.',
        });
      }

      await deps.prisma.projectAttachment.delete({ where: { id: attachment.id } });
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not delete the attachment.',
      });
    }
  };
}

export function createProjectAttachmentOrderHandler(deps: AttachmentsDependencies) {
  return async function projectAttachmentOrderHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const order = (req.body as { order?: unknown } | undefined)?.order;
      if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Attachment order must be an array of attachment ids.',
        });
      }

      await Promise.all(order.map((id, index) => deps.prisma.projectAttachment.update({
        where: { id },
        data: { order: index },
      })));

      const attachments = await deps.prisma.projectAttachment.findMany({
        where: { projectId: authorized.project.id },
        include: { omlMetadata: true },
        orderBy: { order: 'asc' },
      });

      return res.status(200).json({ attachments: attachments.map(attachmentResponse) });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not reorder attachments.',
      });
    }
  };
}

export function createProjectOmlMetadataHandler(deps: AttachmentsDependencies) {
  return async function projectOmlMetadataHandler(req: Request, res: Response) {
    try {
      const authorized = await authorizeProject(deps, req, res);
      if (!authorized.ok) return authorized.response;

      const [file] = filesFrom(req);
      if (!file) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'A .oml file is required.',
        });
      }

      const filename = baseName(file.originalname);
      if (attachmentExtension(filename) !== '.oml') {
        return res.status(422).json({
          error: 'invalid_oml_file',
          message: 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
        });
      }

      const validation = validateAttachmentFile(file);
      if (validation.status !== 200) {
        return res.status(validation.status === 415 ? 422 : validation.status).json({
          error: 'invalid_oml_file',
          message: 'The uploaded .oml file is invalid or corrupted. Please upload a valid file.',
        });
      }

      return res.status(200).json({ metadata: validation.body });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not extract .oml metadata.',
      });
    }
  };
}

export function createPublicProjectAttachmentDownloadHandler(deps: Pick<AttachmentsDependencies, 'prisma'>) {
  return async function publicProjectAttachmentDownloadHandler(req: Request, res: Response) {
    try {
      const projectId = projectIdFrom(req);
      const attachmentId = attachmentIdFrom(req);

      if (!projectId || !attachmentId) {
        return res.status(404).json({
          error: 'project_not_found',
          message: 'Project or attachment not found.',
        });
      }

      const project = await deps.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({
          error: 'project_not_found',
          message: 'Project not found.',
        });
      }

      if ((project.visibility ?? '').toUpperCase() !== 'PUBLISHED') {
        return res.status(403).json({
          error: 'project_not_public',
          message: 'Project is not public.',
        });
      }

      const attachment = await deps.prisma.projectAttachment.findFirst({
        where: { id: attachmentId, projectId },
      });
      if (!attachment) {
        return res.status(404).json({
          error: 'attachment_not_found',
          message: 'Attachment not found.',
        });
      }

      res.status(200);
      res.setHeader('Content-Type', attachment.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${contentDispositionFilename(attachment.filename)}"`);
      return res.send(publicDownloadBody(attachment));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not download the attachment.',
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

export async function projectAttachmentUploadHandler(req: Request, res: Response) {
  return createProjectAttachmentUploadHandler(await dependencies())(req, res);
}

export async function projectAttachmentListHandler(req: Request, res: Response) {
  return createProjectAttachmentListHandler(await dependencies())(req, res);
}

export async function projectAttachmentDeleteHandler(req: Request, res: Response) {
  return createProjectAttachmentDeleteHandler(await dependencies())(req, res);
}

export async function projectAttachmentOrderHandler(req: Request, res: Response) {
  return createProjectAttachmentOrderHandler(await dependencies())(req, res);
}

export async function projectOmlMetadataHandler(req: Request, res: Response) {
  return createProjectOmlMetadataHandler(await dependencies())(req, res);
}

export async function publicProjectAttachmentDownloadHandler(req: Request, res: Response) {
  return createPublicProjectAttachmentDownloadHandler(await dependencies())(req, res);
}
