import type { Request, Response } from 'express';

/** Summary data for a published project shown on the discovery page. */
export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  developerName: string;
};

type DiscoverProjectRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  owner: {
    username: string;
    profile: {
      name: string | null;
    } | null;
  };
};

type DiscoverProjectWhere = {
  visibility: 'PUBLISHED';
  projectType?: string;
  OR?: Array<{
    title?: { contains: string; mode: 'insensitive' };
    summary?: { contains: string; mode: 'insensitive' };
  }>;
};

type DiscoverProjectsDependencies = {
  prisma: {
    project: {
      findMany(args: {
        where: DiscoverProjectWhere;
        select: {
          id: true;
          title: true;
          slug: true;
          summary: true;
          owner: {
            select: {
              username: true;
              profile: {
                select: { name: true };
              };
            };
          };
        };
        orderBy: { title: 'asc' };
      }): Promise<DiscoverProjectRecord[]>;
    };
  };
};

function firstQueryValue(value: Request['query'][string]) {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return typeof value === 'string' ? value.trim() : '';
}

function serializeProject(project: DiscoverProjectRecord): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    summary: project.summary ?? '',
    developerName: project.owner.profile?.name || project.owner.username,
  };
}

export function createDiscoverProjectsHandler(deps: DiscoverProjectsDependencies) {
  return async function discoverProjectsHandler(req: Request, res: Response) {
    try {
      const projectType = firstQueryValue(req.query.projectType);
      const keyword = firstQueryValue(req.query.keyword);
      const where: DiscoverProjectWhere = { visibility: 'PUBLISHED' };

      if (projectType) {
        where.projectType = projectType;
      }

      if (keyword) {
        where.OR = [
          { title: { contains: keyword, mode: 'insensitive' } },
          { summary: { contains: keyword, mode: 'insensitive' } },
        ];
      }

      const projects = await deps.prisma.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          owner: {
            select: {
              username: true,
              profile: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { title: 'asc' },
      });

      return res.status(200).json({
        projects: projects.map(serializeProject),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve discovery projects.',
      });
    }
  };
}

export async function discoverProjectsHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createDiscoverProjectsHandler({ prisma })(req, res);
}
