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

type PublicProjectDependencies = {
  prisma: {
    project: {
      findFirst(args: {
        where: { slug: string };
        include: {
          owner: {
            select: {
              username: true;
              profile: {
                select: { name: true };
              };
            };
          };
        };
      }): Promise<PublicProjectRecord | null>;
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

export async function publicProjectHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createPublicProjectHandler({ prisma })(req, res);
}
