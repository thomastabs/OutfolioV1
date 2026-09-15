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
      update(args: {
        where: { userId: string };
        data: {
          name: string;
          bio: string;
          experienceYears: number;
          certifications: string[];
          links: string[];
          visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
        };
      }): Promise<ProfileRecord>;
    };
  };
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
};

type ProfileUpdateInput = {
  name?: unknown;
  bio?: unknown;
  experienceYears?: unknown;
  certifications?: unknown;
  links?: unknown;
  visibility?: unknown;
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

function validationError(res: Response, fields: Record<string, string>) {
  return res.status(422).json({
    error: 'validation_error',
    message: 'Profile input is invalid.',
    fields,
  });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeTextList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : [];
}

function normalizeVisibilityInput(value: unknown): 'PUBLIC' | 'PRIVATE' | 'UNLISTED' | null {
  if (typeof value !== 'string') return 'PRIVATE';

  const normalized = value.toLowerCase();
  if (normalized === 'public') return 'PUBLIC';
  if (normalized === 'private') return 'PRIVATE';
  if (normalized === 'unlisted') return 'UNLISTED';
  return null;
}

function parseUpdateInput(input: ProfileUpdateInput) {
  const fields: Record<string, string> = {};

  const experienceYears =
    typeof input.experienceYears === 'number' && Number.isInteger(input.experienceYears) ? input.experienceYears : Number.NaN;

  if (!Number.isInteger(experienceYears) || experienceYears < 0) {
    fields.experienceYears = 'Years of experience must be a non-negative integer.';
  }

  if (!Array.isArray(input.certifications) || input.certifications.some((item) => typeof item !== 'string')) {
    fields.certifications = 'Certifications must be a list of text values.';
  }

  if (!Array.isArray(input.links) || input.links.some((item) => typeof item !== 'string')) {
    fields.links = 'Links must be a list of URL strings.';
  }

  const links = normalizeTextList(input.links);
  if (!fields.links && links.some((link) => !isHttpUrl(link))) {
    fields.links = 'Links must be valid HTTP or HTTPS URLs.';
  }

  const visibility = normalizeVisibilityInput(input.visibility);
  if (!visibility) {
    fields.visibility = 'Visibility must be public, private, or unlisted.';
  }

  if (Object.keys(fields).length > 0 || !visibility) {
    return { valid: false as const, fields };
  }

  return {
    valid: true as const,
    data: {
      name: normalizeText(input.name),
      bio: normalizeText(input.bio),
      experienceYears,
      certifications: normalizeTextList(input.certifications),
      links,
      visibility,
    },
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

export function createUpdateProfileMeHandler(deps: ProfileMeDependencies) {
  return async function updateProfileMeHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);

      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const parsed = parseUpdateInput((req.body ?? {}) as ProfileUpdateInput);
      if (!parsed.valid) {
        return validationError(res, parsed.fields);
      }

      const profile = await deps.prisma.profile.update({
        where: { userId: session.userId },
        data: parsed.data,
      });

      return res.status(200).json(serializeProfile(profile));
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not update the profile.',
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

export async function updateProfileMeHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createUpdateProfileMeHandler({
    prisma,
    validateSession,
  })(req, res);
}
