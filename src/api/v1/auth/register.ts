import type { Request, Response } from 'express';

type RegisterBody = {
  name?: unknown;
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

type UserRecord = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
};

type RegisterDependencies = {
  prisma: {
    user: {
      findFirst(args: { where: { OR: Array<{ username: string } | { email: string }> } }): Promise<unknown>;
      create(args: { data: UserRecord }): Promise<UserRecord>;
    };
  };
  supabase: {
    auth: {
      signUp(args: {
        email: string;
        password: string;
        options: { data: { name: string; username: string } };
      }): Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
    };
  };
  establishSession(user: UserRecord, res: Response): Promise<{ expiresAt: string }>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateRegisterBody(body: RegisterBody) {
  const values = {
    name: stringValue(body.name),
    username: stringValue(body.username),
    email: stringValue(body.email).toLowerCase(),
    password: stringValue(body.password),
  };
  const fields: Partial<Record<keyof typeof values, string>> = {};

  if (!values.name) fields.name = 'Name is required.';
  if (!values.username) fields.username = 'Username is required.';
  if (!values.email || !emailPattern.test(values.email)) fields.email = 'Enter a valid email address.';
  if (!values.password) fields.password = 'Password is required.';

  return { values, fields };
}

export function createRegisterHandler(deps: RegisterDependencies) {
  return async function registerHandler(req: Request, res: Response) {
    const { values, fields } = validateRegisterBody((req.body ?? {}) as RegisterBody);

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: 'malformed_input',
        message: 'Registration input is invalid.',
        fields,
      });
    }

    try {
      const duplicate = await deps.prisma.user.findFirst({
        where: {
          OR: [{ username: values.username }, { email: values.email }],
        },
      });

      if (duplicate) {
        return res.status(409).json({
          error: 'duplicate_username_or_email',
          message: 'Username or email is already in use.',
        });
      }

      const authResult = await deps.supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name,
            username: values.username,
          },
        },
      });

      if (authResult.error || !authResult.data.user) {
        return res.status(500).json({
          error: 'unexpected_failure',
          message: 'Could not create the account.',
        });
      }

      const createdAt = new Date();
      const user = await deps.prisma.user.create({
        data: {
          id: authResult.data.user.id,
          username: values.username,
          email: values.email,
          createdAt,
        },
      });
      const session = await deps.establishSession(user, res);

      return res.status(200).json({
        userId: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        session,
      });
    } catch {
      return res.status(500).json({
        error: 'unexpected_failure',
        message: 'Could not create the account.',
      });
    }
  };
}

export async function registerHandler(req: Request, res: Response) {
  const [{ prisma }, { supabaseAdmin }, { establishRegistrationSession }] = await Promise.all([
    import('@/src/lib/prisma'),
    import('@/src/lib/supabase'),
    import('@/src/lib/session'),
  ]);

  return createRegisterHandler({
    prisma,
    supabase: supabaseAdmin,
    establishSession: establishRegistrationSession,
  })(req, res);
}
