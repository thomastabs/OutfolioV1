import type { Request, Response } from 'express';

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

type UserRecord = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
};

type LoginDependencies = {
  prisma: {
    user: {
      findUnique(args: { where: { username: string } }): Promise<UserRecord | null>;
    };
  };
  supabase: {
    auth: {
      signInWithPassword(args: {
        email: string;
        password: string;
      }): Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
    };
  };
  establishSession(user: UserRecord, res: Response): Promise<{ expiresAt: string }>;
};

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function invalidCredentials(res: Response) {
  return res.status(401).json({
    error: 'invalid_credentials',
    message: 'Invalid username or password.',
  });
}

function validateLoginBody(body: LoginBody) {
  const values = {
    username: stringValue(body.username),
    password: stringValue(body.password),
  };
  const fields: Partial<Record<keyof typeof values, string>> = {};

  if (!values.username) fields.username = 'Username is required.';
  if (!values.password) fields.password = 'Password is required.';

  return { values, fields };
}

export function createLoginHandler(deps: LoginDependencies) {
  return async function loginHandler(req: Request, res: Response) {
    const { values, fields } = validateLoginBody((req.body ?? {}) as LoginBody);

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: 'malformed_input',
        message: 'Login input is invalid.',
        fields,
      });
    }

    try {
      const user = await deps.prisma.user.findUnique({
        where: { username: values.username },
      });

      if (!user) {
        return invalidCredentials(res);
      }

      const authResult = await deps.supabase.auth.signInWithPassword({
        email: user.email,
        password: values.password,
      });

      if (authResult.error || !authResult.data.user) {
        return invalidCredentials(res);
      }

      const session = await deps.establishSession(user, res);

      return res.status(200).json({
        userId: user.id,
        username: user.username,
        email: user.email,
        session,
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not log in.',
      });
    }
  };
}

export async function loginHandler(req: Request, res: Response) {
  const [{ prisma }, { supabaseAdmin }, { establishRegistrationSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/supabase'),
    import('@/src/lib/session'),
  ]);

  return createLoginHandler({
    prisma,
    supabase: supabaseAdmin,
    establishSession: establishRegistrationSession,
  })(req, res);
}
