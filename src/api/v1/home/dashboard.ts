import type { Request, Response } from 'express';

export type HomeDashboardProjectHighlight = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  coverImageUrl: string;
  projectType: string;
  tags: string[];
  role: string;
  visibility: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
};

type HomeDashboardSession =
  | {
      valid: true;
      username: string;
    }
  | {
      valid: false;
      reason: string;
    };

type HomeDashboardDependencies = {
  prisma: {
    project: {
      findMany(args: {
        where: { visibility: 'PUBLISHED' };
        select: {
          id: true;
          title: true;
          slug: true;
          summary: true;
          coverImageUrl: true;
          projectType: true;
          tags: true;
          role: true;
          visibility: true;
        };
        orderBy: { title: 'asc' };
        take: number;
      }): Promise<HomeDashboardProjectHighlight[]>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): HomeDashboardSession;
  storage: {
    resolveMediaUrl(value: string): Promise<string>;
  };
};

export const HOME_DASHBOARD_PRODUCT_NAME = 'Outfolio';
export const HOME_DASHBOARD_VALUE_PROPOSITION =
  'Create a public developer portfolio with polished project case studies.';

function dashboardSessionState(session: HomeDashboardSession) {
  if (!session.valid) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    username: session.username,
  };
}

export function createHomeDashboardHandler(dependencies: HomeDashboardDependencies) {
  return async function homeDashboardHandler(req: Request, res: Response) {
    try {
      const [publishedProjects, session] = await Promise.all([
        dependencies.prisma.project.findMany({
          where: { visibility: 'PUBLISHED' },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            coverImageUrl: true,
            projectType: true,
            tags: true,
            role: true,
            visibility: true,
          },
          orderBy: { title: 'asc' },
          take: 3,
        }),
        Promise.resolve(dependencies.validateSession(req)),
      ]);

      const resolvedHighlights = await Promise.all(publishedProjects.map(async (project) => ({
        ...project,
        coverImageUrl: await dependencies.storage.resolveMediaUrl(project.coverImageUrl ?? ''),
      })));

      return res.status(200).json({
        productName: HOME_DASHBOARD_PRODUCT_NAME,
        valueProposition: HOME_DASHBOARD_VALUE_PROPOSITION,
        publishedProjects: resolvedHighlights,
        session: dashboardSessionState(session),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not load the home dashboard.',
      });
    }
  };
}

export async function homeDashboardHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }, storage] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
    import('@/src/lib/storage'),
  ]);

  return createHomeDashboardHandler({ prisma, validateSession, storage })(req, res);
}
