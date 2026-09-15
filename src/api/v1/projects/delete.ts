import type { Request, Response } from 'express';

type ProjectRecord = {
  id: string;
  ownerId: string;
  visibility: string;
};

type ProjectDeleteDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
      delete(args: { where: { id: string } }): Promise<ProjectRecord>;
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

function isDraftProject(project: ProjectRecord) {
  return project.visibility.toUpperCase() === 'DRAFT';
}

export function createProjectDeleteHandler(deps: ProjectDeleteDependencies) {
  return async function projectDeleteHandler(req: Request, res: Response) {
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

      if (!isDraftProject(project)) {
        return res.status(403).json({
          error: 'project_not_draft',
          message: 'Only draft projects can be deleted. Unpublish the project first.',
        });
      }

      await deps.prisma.project.delete({
        where: { id: projectId },
      });

      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not delete the project.',
      });
    }
  };
}

export async function projectDeleteHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectDeleteHandler({ prisma, validateSession })(req, res);
}
