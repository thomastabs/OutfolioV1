import type { Request, Response } from 'express';

type ProjectVisibility = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';

type ProjectRecord = {
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
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ProjectDependencies = {
  prisma: {
    project: {
      findFirst?(args: { where: { ownerId: string; slug: string } }): Promise<unknown | null>;
      create?(args: { data: Record<string, unknown> }): Promise<ProjectRecord>;
      findMany?(args: { where: { ownerId: string }; orderBy: { updatedAt: 'desc' } }): Promise<ProjectRecord[]>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
};

type ProjectInput = {
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
};

export function slugifyProjectTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeVisibility(value: unknown): ProjectVisibility {
  if (typeof value !== 'string') return 'DRAFT';
  const normalized = value.toLowerCase();
  if (normalized === 'published') return 'PUBLISHED';
  if (normalized === 'unpublished') return 'UNPUBLISHED';
  return 'DRAFT';
}

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

function parseProjectInput(body: ProjectInput) {
  const title = normalizeText(body.title);
  const summary = normalizeText(body.summary);
  const role = normalizeText(body.role);
  const fields: Record<string, string> = {};

  if (!title) fields.title = 'Title is required.';
  if (!summary) fields.summary = 'Summary is required.';
  if (!role) fields.role = 'Role is required.';

  if (Object.keys(fields).length > 0) {
    return { valid: false as const, fields };
  }

  return {
    valid: true as const,
    data: {
      title,
      summary,
      role,
      projectType: normalizeText(body.projectType),
      status: normalizeText(body.status) || 'draft',
      tags: normalizeTextList(body.tags),
      coverImageUrl: normalizeText(body.coverImageUrl),
      problem: normalizeText(body.problem),
      features: normalizeText(body.features),
      technicalNotes: normalizeText(body.technicalNotes),
      contribution: normalizeText(body.contribution),
      outcome: normalizeText(body.outcome),
      visibility: normalizeVisibility(body.visibility),
    },
  };
}

export function createProjectHandler(deps: ProjectDependencies) {
  return async function projectCreateHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);
      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const parsed = parseProjectInput((req.body ?? {}) as ProjectInput);
      if (!parsed.valid) {
        return res.status(400).json({
          error: 'malformed_input',
          message: 'Project input is invalid.',
          fields: parsed.fields,
        });
      }

      const slug = slugifyProjectTitle(parsed.data.title);
      const existingProject = await deps.prisma.project.findFirst?.({
        where: { ownerId: session.userId, slug },
      });

      if (existingProject) {
        return res.status(409).json({
          error: 'duplicate_slug',
          message: 'A project with this slug already exists. Choose a unique title.',
        });
      }

      const project = await deps.prisma.project.create?.({
        data: {
          ownerId: session.userId,
          ...parsed.data,
          slug,
          visibility: 'DRAFT',
          publishedAt: null,
        },
      });

      return res.status(200).json(serializeProject(project as ProjectRecord));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not create the project.',
      });
    }
  };
}

export function createProjectListHandler(deps: ProjectDependencies) {
  return async function projectListHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);
      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const projects = await deps.prisma.project.findMany?.({
        where: { ownerId: session.userId },
        orderBy: { updatedAt: 'desc' },
      });

      return res.status(200).json({
        projects: (projects ?? []).map(serializeProject),
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve projects.',
      });
    }
  };
}

export async function projectCreateHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectHandler({ prisma, validateSession })(req, res);
}

export async function projectListHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProjectListHandler({ prisma, validateSession })(req, res);
}
