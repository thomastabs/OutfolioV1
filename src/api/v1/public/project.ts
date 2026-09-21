import type { Request, Response } from 'express';

type PublicProjectRecord = {
  id: string;
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
  owner: {
    username: string;
    profile: {
      name: string | null;
    } | null;
  };
};

type PublicProjectImageRecord = {
  id: string;
  url: string;
  order?: number | null;
};

type PublicProjectAttachmentRecord = {
  id: string;
  filename: string;
  fileType?: string | null;
  fileSize?: number | null;
  isOmlFile?: boolean | null;
  order?: number | null;
  omlMetadata?: { moduleName: string; version: string } | null;
};

type PublicProjectDependencies = {
  prisma: {
    project: {
      findFirst(args: unknown): Promise<any>;
    };
  };
};

type PublicProjectImagesDependencies = {
  prisma: {
    project: {
      findFirst(args: unknown): Promise<any>;
    };
    projectImage: {
      findMany(args: { where: { projectId: string }; orderBy: { order: 'asc' } }): Promise<PublicProjectImageRecord[]>;
    };
  };
};

type PublicProjectAttachmentsDependencies = {
  prisma: {
    project: {
      findFirst(args: unknown): Promise<any>;
    };
    projectAttachment: {
      findMany(args: {
        where: { projectId: string };
        include?: { omlMetadata: true };
        orderBy: { order: 'asc' };
      }): Promise<PublicProjectAttachmentRecord[]>;
    };
  };
};

function notFound(res: Response) {
  return res.status(404).json({
    error: 'project_not_found',
    message: 'Project not found.',
  });
}

function serializeProject(project: PublicProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    projectType: project.projectType ?? '',
    role: project.role,
    status: project.status,
    tags: project.tags ?? [],
    coverImageUrl: project.coverImageUrl ?? '',
    problem: project.problem ?? '',
    features: project.features ?? '',
    technicalNotes: project.technicalNotes ?? '',
    contribution: project.contribution ?? '',
    outcome: project.outcome ?? '',
    visibility: project.visibility.toLowerCase(),
    publishedAt: project.publishedAt,
    owner: {
      username: project.owner.username,
      name: project.owner.profile?.name ?? '',
    },
  };
}

function serializeImage(image: PublicProjectImageRecord) {
  return {
    id: image.id,
    url: image.url,
    order: image.order ?? 0,
  };
}

function serializeAttachment(projectId: string, attachment: PublicProjectAttachmentRecord) {
  return {
    id: attachment.id,
    filename: attachment.filename,
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
    downloadUrl: `/api/v1/public/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachment.id)}`,
  };
}

export function createPublicProjectHandler(deps: PublicProjectDependencies) {
  return async function publicProjectHandler(req: Request, res: Response) {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
      if (!slug) {
        return notFound(res);
      }

      const project = await deps.prisma.project.findFirst({
        where: { slug },
        include: {
          owner: {
            select: {
              username: true,
              profile: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!project) {
        return notFound(res);
      }

      if (project.visibility.toUpperCase() !== 'PUBLISHED') {
        return res.status(403).json({
          error: 'project_not_public',
          message: 'Project is not public.',
        });
      }

      return res.status(200).json(serializeProject(project));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the public project.',
      });
    }
  };
}

export function createPublicProjectImagesHandler(deps: PublicProjectImagesDependencies) {
  return async function publicProjectImagesHandler(req: Request, res: Response) {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
      if (!slug) {
        return notFound(res);
      }

      const project = await deps.prisma.project.findFirst({
        where: { slug },
      });

      if (!project) {
        return notFound(res);
      }

      if (project.visibility.toUpperCase() !== 'PUBLISHED') {
        return res.status(403).json({
          error: 'project_not_public',
          message: 'Project is not public.',
        });
      }

      const images = await deps.prisma.projectImage.findMany({
        where: { projectId: project.id },
        orderBy: { order: 'asc' },
      });

      return res.status(200).json({ images: images.map(serializeImage) });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the public project images.',
      });
    }
  };
}

export function createPublicProjectAttachmentsHandler(deps: PublicProjectAttachmentsDependencies) {
  return async function publicProjectAttachmentsHandler(req: Request, res: Response) {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
      if (!slug) {
        return notFound(res);
      }

      const project = await deps.prisma.project.findFirst({
        where: { slug },
      });

      if (!project) {
        return notFound(res);
      }

      if (project.visibility.toUpperCase() !== 'PUBLISHED') {
        return res.status(403).json({
          error: 'project_not_public',
          message: 'Project is not public.',
        });
      }

      const attachments = await deps.prisma.projectAttachment.findMany({
        where: { projectId: project.id },
        include: { omlMetadata: true },
        orderBy: { order: 'asc' },
      });

      return res.status(200).json({
        attachments: attachments.map((attachment) => serializeAttachment(project.id, attachment)),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the public project attachments.',
      });
    }
  };
}

export async function publicProjectHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createPublicProjectHandler({ prisma })(req, res);
}

export async function publicProjectImagesHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createPublicProjectImagesHandler({ prisma })(req, res);
}

export async function publicProjectAttachmentsHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createPublicProjectAttachmentsHandler({ prisma })(req, res);
}
