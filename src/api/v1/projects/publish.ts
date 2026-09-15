import type { Request, Response } from 'express';

type ProjectRecord = {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  summary: string | null;
  role: string | null;
  status: string | null;
  visibility: string;
  publishedAt: Date | string | null;
};

type ProjectPublishDependencies = {
  prisma: {
    project: {
      findUnique(args: { where: { id: string } }): Promise<ProjectRecord | null>;
      update(args: {
        where: { id: string };
        data: { visibility: 'PUBLISHED'; publishedAt: Date; updatedAt: Date };
      }): Promise<ProjectRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
  now?(): Date;
};

type PublishFields = Partial<Record<'title' | 'summary' | 'role' | 'status' | 'visibility', string>>;

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function projectIdFrom(req: Request) {
  return typeof req.params?.id === 'string' ? req.params.id.trim() : '';
}

function visibilityToResponse(value: string) {
  return value.toLowerCase();
}

function validatePublishableProject(project: ProjectRecord) {
  const fields: PublishFields = {};

  if (!project.title?.trim()) fields.title = 'Title is required before publishing.';
  if (!project.summary?.trim()) fields.summary = 'Summary is required before publishing.';
  if (!project.role?.trim()) fields.role = 'Role is required before publishing.';
  if (!project.status?.trim()) fields.status = 'Status is required before publishing.';
  if (!['DRAFT', 'UNPUBLISHED'].includes(project.visibility.toUpperCase())) {
    fields.visibility = 'Project must be draft or unpublished before publishing.';
  }

  return fields;
}

function serializeProject(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    status: project.status,
    visibility: visibilityToResponse(project.visibility),
    publishedAt: project.publishedAt,
  };
}

export function createProjectPublishHandler(deps: ProjectPublishDependencies) {
  return async function projectPublishHandler(req: Request, res: Response) {
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

      const fields = validatePublishableProject(project);
      if (Object.keys(fields).length > 0) {
        return res.status(422).json({
          error: 'validation_failed',
          message: 'Project cannot be published yet.',
          fields,
        });
      }

      const timestamp = deps.now?.() ?? new Date();
      const updatedProject = await deps.prisma.project.update({
        where: { id: projectId },
        data: {
          visibility: 'PUBLISHED',
          publishedAt: timestamp,
          updatedAt: timestamp,
        },
      });

      return res.status(200).json(serializeProject(updatedProject));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not publish the project.',
      });
    }
  };
}

export async function projectPublishHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectPublishHandler({ prisma, validateSession })(req, res);
}
