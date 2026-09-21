import { createLoginHandler } from '@/src/api/v1/auth/login';
import { createRegisterHandler } from '@/src/api/v1/auth/register';
import { createUpdateProfileMeHandler } from '@/src/api/v1/profile/me';
import { createPublicProfileHandler } from '@/src/api/v1/profile/public';
import { createProjectHandler } from '@/src/api/v1/projects/create';
import { createProjectPublishHandler } from '@/src/api/v1/projects/publish';
import { createProjectUnpublishHandler } from '@/src/api/v1/projects/unpublish';
import { createPublicProjectHandler } from '@/src/api/v1/public/project';

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  };
}

function makeRequest({ body, params }: { body?: unknown; params?: Record<string, string> } = {}) {
  return {
    body,
    params: params ?? {},
    headers: { cookie: 'next-auth.session-token=valid' },
  } as never;
}

function createFlowHarness() {
  const users = new Map<string, { id: string; username: string; email: string; createdAt: Date }>();
  const profiles = new Map<
    string,
    {
      userId: string;
      name: string;
      bio: string;
      experienceYears: number;
      certifications: string[];
      links: string[];
      visibility: string;
    }
  >();
  const projects = new Map<
    string,
    {
      id: string;
      ownerId: string;
      title: string;
      slug: string;
      summary: string;
      projectType: string;
      role: string;
      status: string;
      tags: string[];
      coverImageUrl: string;
      problem: string;
      features: string;
      technicalNotes: string;
      contribution: string;
      outcome: string;
      visibility: string;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }) =>
        [...users.values()].find((user) =>
          where.OR.some((condition: { username?: string; email?: string }) => {
            return condition.username === user.username || condition.email === user.email;
          }),
        ) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        users.set(data.id, data);
        return data;
      }),
      findUnique: jest.fn(async ({ where, include }) => {
        const user = [...users.values()].find((candidate) => candidate.username === where.username) ?? null;
        if (!user || !include?.profile) return user;
        return {
          ...user,
          profile: profiles.get(user.id) ?? null,
        };
      }),
    },
    profile: {
      create: jest.fn(async ({ data }) => {
        const profile = {
          userId: data.userId,
          name: data.name,
          bio: data.bio ?? '',
          experienceYears: data.experienceYears ?? 0,
          certifications: data.certifications ?? [],
          links: data.links ?? [],
          visibility: data.visibility ?? 'PRIVATE',
        };
        profiles.set(profile.userId, profile);
        return profile;
      }),
      update: jest.fn(async ({ where, data }) => {
        const existing = profiles.get(where.userId);
        if (!existing) throw new Error('Profile missing');

        const profile = { ...existing, ...data };
        profiles.set(where.userId, profile);
        return profile;
      }),
    },
    project: {
      findFirst: jest.fn(async ({ where, include }) => {
        const project =
          [...projects.values()].find((candidate) => {
            if ('ownerId' in where && candidate.ownerId !== where.ownerId) return false;
            if ('slug' in where && candidate.slug !== where.slug) return false;
            return true;
          }) ?? null;

        if (!project || !include?.owner) return project;
        const owner = users.get(project.ownerId);

        return {
          ...project,
          owner: {
            username: owner?.username ?? '',
            profile: {
              name: profiles.get(project.ownerId)?.name ?? '',
            },
          },
        };
      }),
      findUnique: jest.fn(async ({ where }) => projects.get(where.id) ?? null),
      findMany: jest.fn(async ({ where }) =>
        [...projects.values()]
          .filter((project) => project.ownerId === where.ownerId && project.visibility === where.visibility)
          .map(({ id, title, slug, summary }) => ({ id, title, slug, summary })),
      ),
      create: jest.fn(async ({ data }) => {
        const project = {
          id: `project-${projects.size + 1}`,
          ownerId: data.ownerId,
          title: data.title,
          slug: data.slug,
          summary: data.summary,
          projectType: data.projectType,
          role: data.role,
          status: data.status,
          tags: data.tags,
          coverImageUrl: data.coverImageUrl,
          problem: data.problem,
          features: data.features,
          technicalNotes: data.technicalNotes,
          contribution: data.contribution,
          outcome: data.outcome,
          visibility: data.visibility,
          publishedAt: data.publishedAt,
          createdAt: new Date('2026-09-18T10:00:00.000Z'),
          updatedAt: new Date('2026-09-18T10:00:00.000Z'),
        };
        projects.set(project.id, project);
        return project;
      }),
      update: jest.fn(async ({ where, data }) => {
        const existing = projects.get(where.id);
        if (!existing) throw new Error('Project missing');

        const project = { ...existing, ...data };
        projects.set(project.id, project);
        return project;
      }),
    },
  };

  return {
    prisma,
    supabase: {
      auth: {
        admin: {
          createUser: jest.fn(async ({ email }) => ({
            data: { user: { id: 'user-1', email } },
            error: null,
          })),
        },
        signInWithPassword: jest.fn(async () => ({
          data: { user: { id: 'user-1', email: 'ada@example.com' } },
          error: null,
        })),
      },
    },
    validateSession: jest.fn(() => ({ valid: true as const, userId: 'user-1' })),
    establishSession: jest.fn(async () => ({ expiresAt: '2026-10-18T10:00:00.000Z' })),
    now: jest.fn(() => new Date('2026-09-18T12:00:00.000Z')),
    storage: {
      uploadProjectMedia: jest.fn(async (key: string) => key),
      resolveMediaUrl: jest.fn(async (value: string) => value),
    },
    profiles,
    projects,
  };
}

describe('Story 9543691 end-to-end product flow validation', () => {
  it('SC-1 registers, logs in, edits profile, publishes a project, and exposes public pages', async () => {
    const deps = createFlowHarness();

    const registerRes = mockResponse();
    await createRegisterHandler(deps as never)(
      makeRequest({
        body: {
          name: 'Ada Lovelace',
          username: 'ada',
          email: 'ada@example.com',
          password: 'correct-horse-battery-staple',
        },
      }),
      registerRes as never,
    );

    expect(registerRes.status).toHaveBeenCalledWith(200);
    expect(deps.profiles.get('user-1')).toEqual(
      expect.objectContaining({
        name: 'Ada Lovelace',
        visibility: 'PRIVATE',
      }),
    );

    const loginRes = mockResponse();
    await createLoginHandler(deps as never)(
      makeRequest({ body: { username: 'ada', password: 'correct-horse-battery-staple' } }),
      loginRes as never,
    );

    expect(loginRes.status).toHaveBeenCalledWith(200);
    expect(deps.establishSession).toHaveBeenCalledTimes(2);

    const profileRes = mockResponse();
    await createUpdateProfileMeHandler(deps as never)(
      makeRequest({
        body: {
          name: 'Ada Lovelace',
          bio: 'Compiler pioneer and portfolio builder.',
          experienceYears: 5,
          certifications: ['OutSystems Associate Developer'],
          links: ['https://example.com/ada'],
          visibility: 'public',
        },
      }),
      profileRes as never,
    );

    expect(profileRes.status).toHaveBeenCalledWith(200);
    expect(profileRes.json).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }));

    const createProjectRes = mockResponse();
    await createProjectHandler(deps as never)(
      makeRequest({
        body: {
          title: 'Portfolio Builder',
          summary: 'A platform-independent developer case study.',
          role: 'Lead Developer',
          status: 'ready',
          projectType: 'web-app',
        },
      }),
      createProjectRes as never,
    );

    expect(createProjectRes.status).toHaveBeenCalledWith(200);
    expect(createProjectRes.json).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'draft' }));

    const publishRes = mockResponse();
    await createProjectPublishHandler(deps as never)(
      makeRequest({ params: { id: 'project-1' } }),
      publishRes as never,
    );

    expect(publishRes.status).toHaveBeenCalledWith(200);
    expect(publishRes.json).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'published' }));

    const publicProfileRes = mockResponse();
    await createPublicProfileHandler(deps as never)(
      makeRequest({ params: { username: 'ada' } }),
      publicProfileRes as never,
    );

    expect(publicProfileRes.status).toHaveBeenCalledWith(200);
    expect(publicProfileRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'ada',
        publishedProjects: [expect.objectContaining({ slug: 'portfolio-builder' })],
      }),
    );

    const publicProjectRes = mockResponse();
    await createPublicProjectHandler(deps as never)(
      makeRequest({ params: { slug: 'portfolio-builder' } }),
      publicProjectRes as never,
    );

    expect(publicProjectRes.status).toHaveBeenCalledWith(200);
    expect(publicProjectRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Portfolio Builder',
        visibility: 'published',
        owner: expect.objectContaining({ username: 'ada', name: 'Ada Lovelace' }),
      }),
    );
  });

  it('SC-2 hides private profiles and unpublished projects from public visitors', async () => {
    const deps = createFlowHarness();

    await createRegisterHandler(deps as never)(
      makeRequest({
        body: {
          name: 'Ada Lovelace',
          username: 'ada',
          email: 'ada@example.com',
          password: 'correct-horse-battery-staple',
        },
      }),
      mockResponse() as never,
    );
    await createUpdateProfileMeHandler(deps as never)(
      makeRequest({
        body: {
          name: 'Ada Lovelace',
          bio: 'Private profile.',
          experienceYears: 5,
          certifications: [],
          links: [],
          visibility: 'private',
        },
      }),
      mockResponse() as never,
    );
    await createProjectHandler(deps as never)(
      makeRequest({
        body: {
          title: 'Hidden Portfolio Builder',
          summary: 'A private draft.',
          role: 'Lead Developer',
          status: 'ready',
        },
      }),
      mockResponse() as never,
    );
    await createProjectPublishHandler(deps as never)(
      makeRequest({ params: { id: 'project-1' } }),
      mockResponse() as never,
    );
    await createProjectUnpublishHandler(deps as never)(
      makeRequest({ params: { id: 'project-1' } }),
      mockResponse() as never,
    );

    const publicProfileRes = mockResponse();
    await createPublicProfileHandler(deps as never)(
      makeRequest({ params: { username: 'ada' } }),
      publicProfileRes as never,
    );

    expect(publicProfileRes.status).toHaveBeenCalledWith(403);
    expect(publicProfileRes.json).toHaveBeenCalledWith({
      error: 'profile_not_public',
      message: 'Profile is not public.',
    });

    const publicProjectRes = mockResponse();
    await createPublicProjectHandler(deps as never)(
      makeRequest({ params: { slug: 'hidden-portfolio-builder' } }),
      publicProjectRes as never,
    );

    expect(publicProjectRes.status).toHaveBeenCalledWith(403);
    expect(publicProjectRes.json).toHaveBeenCalledWith({
      error: 'project_not_public',
      message: 'Project is not public.',
    });
  });
});
