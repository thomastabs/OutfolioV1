import { type NextRequest, NextResponse } from 'next/server';

import { loginHandler } from '@/src/api/v1/auth/login';
import { logoutHandler } from '@/src/api/v1/auth/logout';
import { registerHandler } from '@/src/api/v1/auth/register';
import { sessionHandler } from '@/src/api/v1/auth/session';
import { discoverProjectsHandler } from '@/src/api/v1/discover/projects';
import { missingDeploymentEnv } from '@/src/api/v1';
import { profileMeHandler, updateProfileMeHandler } from '@/src/api/v1/profile/me';
import { publicProfileHandler } from '@/src/api/v1/profile/public';
import { projectCreateHandler, projectListHandler } from '@/src/api/v1/projects/create';
import { projectDeleteHandler } from '@/src/api/v1/projects/delete';
import { projectGetHandler } from '@/src/api/v1/projects/get';
import { projectPublishHandler } from '@/src/api/v1/projects/publish';
import { projectUnpublishHandler } from '@/src/api/v1/projects/unpublish';
import { projectUpdateHandler } from '@/src/api/v1/projects/update';
import { publicProjectHandler } from '@/src/api/v1/public/project';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path?: string[];
  };
};

type ApiHandler = (req: never, res: never) => Promise<unknown> | unknown;

type RouteMatch = {
  handler: ApiHandler;
  params?: Record<string, string>;
};

type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  path?: string;
  expires?: Date;
};

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

  if (method === 'POST' && first === 'auth' && second === 'login') return { handler: loginHandler };
  if (method === 'POST' && first === 'auth' && second === 'logout') return { handler: logoutHandler };
  if (method === 'POST' && first === 'auth' && second === 'register') return { handler: registerHandler };
  if (method === 'GET' && first === 'auth' && second === 'session') return { handler: sessionHandler };

  if (method === 'GET' && first === 'discover' && second === 'projects') {
    return { handler: discoverProjectsHandler };
  }

  if (first === 'profile' && second === 'me') {
    if (method === 'GET') return { handler: profileMeHandler };
    if (method === 'PUT') return { handler: updateProfileMeHandler };
  }

  if (method === 'GET' && first === 'profile' && second === 'public' && third) {
    return { handler: publicProfileHandler, params: { username: third } };
  }

  if (first === 'projects' && !second) {
    if (method === 'GET') return { handler: projectListHandler };
    if (method === 'POST') return { handler: projectCreateHandler };
  }

  if (first === 'projects' && second && !third) {
    if (method === 'GET') return { handler: projectGetHandler, params: { id: second } };
    if (method === 'PUT') return { handler: projectUpdateHandler, params: { id: second } };
    if (method === 'DELETE') return { handler: projectDeleteHandler, params: { id: second } };
  }

  if (method === 'POST' && first === 'projects' && second && third === 'publish' && !fourth) {
    return { handler: projectPublishHandler, params: { id: second } };
  }

  if (method === 'POST' && first === 'projects' && second && third === 'unpublish' && !fourth) {
    return { handler: projectUnpublishHandler, params: { id: second } };
  }

  if (method === 'GET' && first === 'public' && second === 'project' && third) {
    return { handler: publicProjectHandler, params: { slug: third } };
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

  await match.handler(req as never, res as never);

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
