import type { Request, Response } from 'express';

type LogoutDependencies = {
  validateSession(req: Pick<Request, 'headers'>): { valid: true; userId: string } | { valid: false; reason: string };
  clearSession(res: Response): void;
};

function missingOrInvalidAuth(res: Response) {
  return res.status(401).json({
    error: 'missing_or_invalid_auth',
    message: 'Missing or invalid session.',
  });
}

export function createLogoutHandler(deps: LogoutDependencies) {
  return async function logoutHandler(req: Request, res: Response) {
    try {
      const session = deps.validateSession(req);

      if (!session.valid && session.reason !== 'expired') {
        return missingOrInvalidAuth(res);
      }

      deps.clearSession(res);

      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not log out.',
      });
    }
  };
}

export async function logoutHandler(req: Request, res: Response) {
  const { validateSession, clearSessionCookie } = await import('@/src/lib/session');

  return createLogoutHandler({
    validateSession,
    clearSession: clearSessionCookie,
  })(req, res);
}
