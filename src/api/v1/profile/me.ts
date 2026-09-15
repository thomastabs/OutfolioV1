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

type ProfileMeDependencies = {
  prisma: {
    profile: {
      findUnique(args: { where: { userId: string } }): Promise<ProfileRecord | null>;
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

function profileNotFound(res: Response) {
  return res.status(404).json({
    error: 'not_found',
    message: 'Profile not found.',
  });
}

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

export function createProfileMeHandler(deps: ProfileMeDependencies) {
  return async function profileMeHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);

      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const profile = await deps.prisma.profile.findUnique({
        where: { userId: session.userId },
      });

      if (!profile) {
        return profileNotFound(res);
      }

      return res.status(200).json(serializeProfile(profile));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the profile.',
      });
    }
  };
}

export async function profileMeHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createProfileMeHandler({
    prisma,
    validateSession,
  })(req, res);
}
