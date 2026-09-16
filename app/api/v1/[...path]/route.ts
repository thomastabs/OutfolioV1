import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: {
    path?: string[];
  };
};

type ApiHandler = (req: never, res: never) => Promise<unknown> | unknown;

type HandlerLoader = () => Promise<ApiHandler>;

type RouteMatch = {
  loadHandler: HandlerLoader;
  params?: Record<string, string>;
};

type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  path?: string;
  expires?: Date;
};

const requiredDeploymentEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
] as const;

function missingDeploymentEnv(env: NodeJS.ProcessEnv = process.env) {
  return requiredDeploymentEnv.filter((name) => !env[name]);
}

function loadHandler<TModule extends Record<string, ApiHandler>>(loader: () => Promise<TModule>, name: keyof TModule) {
  return async () => {
    const module = await loader();
    return module[name];
  };
}

function queryObject(url: URL) {
  const query: Record<string, string | string[]> = {};

  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (typeof existing === 'string') {
      query[key] = [existing, value];
    } else {
      query[key] = value;
    }
  });

  return query;
}

async function bodyObject(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function serializeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

function findRoute(method: string, segments: string[]): RouteMatch | null {
  const [first, second, third, fourth] = segments;

  if (method === 'POST' && first === 'auth' && second === 'login') {
    return { loadHandler: loadHandler(() => import('@/src/api/v1/auth/login'), 'loginHandler') };
  }
  if (method === 'POST' && first === 'auth' && second === 'logout') {
    return { loadHandler: loadHandler(() => import('@/src/api/v1/auth/logout'), 'logoutHandler') };
  }
  if (method === 'POST' && first === 'auth' && second === 'register') {
    return { loadHandler: loadHandler(() => import('@/src/api/v1/auth/register'), 'registerHandler') };
  }
  if (method === 'GET' && first === 'auth' && second === 'session') {
    return { loadHandler: loadHandler(() => import('@/src/api/v1/auth/session'), 'sessionHandler') };
  }

  if (method === 'GET' && first === 'discover' && second === 'projects') {
    return {
      loadHandler: loadHandler(() => import('@/src/api/v1/discover/projects'), 'discoverProjectsHandler'),
    };
  }

  if (first === 'profile' && second === 'me') {
    if (method === 'GET') {
      return { loadHandler: loadHandler(() => import('@/src/api/v1/profile/me'), 'profileMeHandler') };
    }
    if (method === 'PUT') {
      return { loadHandler: loadHandler(() => import('@/src/api/v1/profile/me'), 'updateProfileMeHandler') };
    }
  }

  if (method === 'GET' && first === 'profile' && second === 'public' && third) {
    return {
      loadHandler: loadHandler(() => import('@/src/api/v1/profile/public'), 'publicProfileHandler'),
      params: { username: third },
    };
  }

  if (first === 'projects' && !second) {
    if (method === 'GET') {
      return { loadHandler: loadHandler(() => import('@/src/api/v1/projects/create'), 'projectListHandler') };
    }
    if (method === 'POST') {
      return { loadHandler: loadHandler(() => import('@/src/api/v1/projects/create'), 'projectCreateHandler') };
    }
  }

  if (first === 'projects' && second && !third) {
    if (method === 'GET') {
      return {
        loadHandler: loadHandler(() => import('@/src/api/v1/projects/get'), 'projectGetHandler'),
        params: { id: second },
      };
    }
    if (method === 'PUT') {
      return {
        loadHandler: loadHandler(() => import('@/src/api/v1/projects/update'), 'projectUpdateHandler'),
        params: { id: second },
      };
    }
    if (method === 'DELETE') {
      return {
        loadHandler: loadHandler(() => import('@/src/api/v1/projects/delete'), 'projectDeleteHandler'),
        params: { id: second },
      };
    }
  }

  if (method === 'POST' && first === 'projects' && second && third === 'publish' && !fourth) {
    return {
      loadHandler: loadHandler(() => import('@/src/api/v1/projects/publish'), 'projectPublishHandler'),
      params: { id: second },
    };
  }

  if (method === 'POST' && first === 'projects' && second && third === 'unpublish' && !fourth) {
    return {
      loadHandler: loadHandler(() => import('@/src/api/v1/projects/unpublish'), 'projectUnpublishHandler'),
      params: { id: second },
    };
  }

  if (method === 'GET' && first === 'public' && second === 'project' && third) {
    return {
      loadHandler: loadHandler(() => import('@/src/api/v1/public/project'), 'publicProjectHandler'),
      params: { slug: third },
    };
  }

  return null;
}

async function invokeApiHandler(request: NextRequest, context: RouteContext) {
  const missing = process.env.NODE_ENV === 'production' ? missingDeploymentEnv() : [];
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: 'missing_server_configuration',
        message: 'The deployment environment is missing required server configuration.',
        missing,
      },
      { status: 500 },
    );
  }

  const segments = context.params.path ?? [];
  const match = findRoute(request.method, segments);
  if (!match) {
    return NextResponse.json({ error: 'not_found', message: 'API route not found.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const responseHeaders = new Headers({ 'content-type': 'application/json' });
  let statusCode = 200;
  let responseBody: unknown = null;

  const req = {
    body: await bodyObject(request),
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
    params: match.params ?? {},
    query: queryObject(url),
  };

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
    cookie(name: string, value: string, options: CookieOptions = {}) {
      responseHeaders.append('set-cookie', serializeCookie(name, value, options));
      return this;
    },
  };

  const handler = await match.loadHandler();
  await handler(req as never, res as never);

  return new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return invokeApiHandler(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return invokeApiHandler(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return invokeApiHandler(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return invokeApiHandler(request, context);
}
