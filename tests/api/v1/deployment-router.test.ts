import fs from 'fs';
import path from 'path';

import {
  apiV1MountPath,
  apiV1RouteMounts,
  createApiV1App,
  createApiV1Router,
  missingDeploymentEnv,
  requiredDeploymentEnv,
} from '@/src/api/v1';
import { publicRouter } from '@/src/api/v1/public';

describe('API v1 deployment router', () => {
  it('documents the required deployment environment variables', () => {
    expect(requiredDeploymentEnv).toEqual([
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
    ]);
  });

  it('reports missing deployment environment variables without exposing values', () => {
    expect(
      missingDeploymentEnv({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
      } as NodeJS.ProcessEnv),
    ).toEqual([
      'SUPABASE_SERVICE_ROLE_KEY',
      'DATABASE_URL',
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
    ]);
  });

  it('mounts the expected v1 route groups under the API prefix', () => {
    expect(apiV1MountPath).toBe('/api/v1');
    expect(apiV1RouteMounts).toEqual({
      auth: '/auth',
      discover: '/discover',
      profile: '/profile',
      projects: '/projects',
      public: '/public',
    });

    const router = createApiV1Router();
    expect((router as unknown as { stack: unknown[] }).stack).toHaveLength(
      Object.keys(apiV1RouteMounts).length,
    );

    const app = createApiV1App();
    expect(
      (app as unknown as { _router: { stack: unknown[] } })._router.stack.length,
    ).toBeGreaterThan(0);
  });

  it('mounts public project lookup in the public route group', () => {
    const publicRoutes = (
      publicRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
      }
    ).stack;

    expect(
      publicRoutes.some((layer) => layer.route?.path === '/project/:slug' && layer.route.methods.get),
    ).toBe(true);
  });

  it('exposes a Vercel catch-all serverless function for /api/v1 routes', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'api/v1/[...path].ts'))).toBe(true);
  });
});
