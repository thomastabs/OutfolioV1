import type { Request, Response } from 'express';

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

type ProjectGetDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
};

function serializeVisibility(value: string) {
  return value.toLowerCase();
}

function serializeProject(project: ProjectRecord) {
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
    visibility: serializeVisibility(project.visibility),
    publishedAt: project.publishedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

export function createProjectGetHandler(deps: ProjectGetDependencies) {
  return async function projectGetHandler(req: Request, res: Response) {
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

      return res.status(200).json(serializeProject(project));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the project.',
      });
    }
  };
}

export async function projectGetHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectGetHandler({ prisma, validateSession })(req, res);
}
