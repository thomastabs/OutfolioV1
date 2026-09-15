import type { Request, Response } from 'express';

type ProjectRecord = {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  publishedAt: Date | string | null;
};

type ProjectUnpublishDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
      update(args: {
        where: { id: string };
        data: { visibility: 'UNPUBLISHED'; publishedAt: null };
      }): Promise<ProjectRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
};

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

function serializeProject(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    status: project.status,
    visibility: project.visibility.toLowerCase(),
    publishedAt: project.publishedAt,
  };
}

export function createProjectUnpublishHandler(deps: ProjectUnpublishDependencies) {
  return async function projectUnpublishHandler(req: Request, res: Response) {
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

      const updatedProject = await deps.prisma.project.update({
        where: { id: projectId },
        data: {
          visibility: 'UNPUBLISHED',
          publishedAt: null,
        },
      });

      return res.status(200).json(serializeProject(updatedProject));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not unpublish the project.',
      });
    }
  };
}

export async function projectUnpublishHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectUnpublishHandler({ prisma, validateSession })(req, res);
}
