import type { Request, Response } from 'express';

type ProfileRecord = {
  userId: string;
  name: string | null;
  bio: string | null;
  experienceYears: number | null;
  certifications: string[] | null;
  links: string[] | null;
  visibility: string | null;
};

type PublicProjectRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
};

type PublicProfileDependencies = {
  prisma: {
    user: {
      findUnique(args: { where: { username: string }; include: { profile: true } }): Promise<{
        id: string;
        username: string;
        profile: ProfileRecord | null;
      } | null>;
    };
    project?: {
      findMany(args: {
        where: { ownerId: string; visibility: 'PUBLISHED' };
        select: { id: true; title: true; slug: true; summary: true };
        orderBy: { title: 'asc' };
      }): Promise<PublicProjectRecord[]>;
    };
  };
};

function normalizeVisibility(value: string | null) {
  if (!value) return 'private';
  return value.toLowerCase();
}

function serializeProfile(profile: ProfileRecord) {
  return {
    userId: profile.userId,
    name: profile.name ?? '',
    bio: profile.bio ?? '',
    experienceYears: profile.experienceYears ?? 0,
    certifications: profile.certifications ?? [],
    links: profile.links ?? [],
    visibility: normalizeVisibility(profile.visibility),
  };
}

function notFound(res: Response) {
  return res.status(404).json({
    error: 'not_found',
    message: 'Profile not found.',
  });
}

export function createPublicProfileHandler(deps: PublicProfileDependencies) {
  return async function publicProfileHandler(req: Request, res: Response) {
    try {
      const username = typeof req.params.username === 'string' ? req.params.username.trim() : '';
      if (!username) {
        return notFound(res);
      }

      const user = await deps.prisma.user.findUnique({
        where: { username },
        include: { profile: true },
      });

      if (!user?.profile) {
        return notFound(res);
      }

      const visibility = normalizeVisibility(user.profile.visibility);
      if (visibility === 'private') {
        return res.status(403).json({
          error: 'profile_not_public',
          message: 'Profile is not public.',
        });
      }

      const projects = deps.prisma.project
        ? await deps.prisma.project.findMany({
            where: { ownerId: user.id, visibility: 'PUBLISHED' },
            select: { id: true, title: true, slug: true, summary: true },
            orderBy: { title: 'asc' },
          })
        : [];

      return res.status(200).json({
        username: user.username,
        profile: serializeProfile(user.profile),
        projects,
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the public profile.',
      });
    }
  };
}

export async function publicProfileHandler(req: Request, res: Response) {
  const { prisma } = await import('@/src/lib/prisma');

  return createPublicProfileHandler({
    prisma,
  })(req, res);
}
