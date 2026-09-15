import type { Request, Response } from 'express';

type SessionDependencies = {
  prisma: {
    user: {
      findUnique(args: { where: { id: string } }): Promise<{ id: string; username: string; email: string } | null>;
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

export function createSessionHandler(deps: SessionDependencies) {
  return async function sessionHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);

      if (!session.valid) {
        return missingOrInvalidAuth(res);
      }

      const user = await deps.prisma.user.findUnique({
        where: { id: session.userId },
      });

      if (!user) {
        return missingOrInvalidAuth(res);
      }

      return res.status(200).json({
        userId: user.id,
        username: user.username,
        email: user.email,
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not retrieve the session.',
      });
    }
  };
}

export async function sessionHandler(req: Request, res: Response) {
  const [{ prisma }, { validateSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/session'),
  ]);

  return createSessionHandler({
    prisma,
    validateSession,
  })(req, res);
}
