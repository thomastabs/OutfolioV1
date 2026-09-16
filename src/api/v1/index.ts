import express, { type NextFunction, type Request, type Response } from 'express';

import { authRouter } from './auth';
import { discoverRouter } from './discover';
import { profileRouter } from './profile';
import { projectsRouter } from './projects';
import { publicRouter } from './public';

export const requiredDeploymentEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
] as const;

export const apiV1MountPath = '/api/v1';

export const apiV1RouteMounts = {
  auth: '/auth',
  discover: '/discover',
  profile: '/profile',
  projects: '/projects',
  public: '/public',
} as const;

export function missingDeploymentEnv(env: NodeJS.ProcessEnv = process.env) {
  return requiredDeploymentEnv.filter((name) => !env[name]);
}

function deploymentEnvironmentGuard(env: NodeJS.ProcessEnv) {
  return function guardDeploymentEnvironment(_req: Request, res: Response, next: NextFunction) {
    if (env.NODE_ENV !== 'production') {
      return next();
    }

    const missing = missingDeploymentEnv(env);
    if (missing.length === 0) {
      return next();
    }

    return res.status(500).json({
      error: 'missing_server_configuration',
      message: 'The deployment environment is missing required server configuration.',
      missing,
    });
  };
}

export function createApiV1Router() {
  const router = express.Router();

  router.use(apiV1RouteMounts.auth, authRouter);
  router.use(apiV1RouteMounts.discover, discoverRouter);
  router.use(apiV1RouteMounts.profile, profileRouter);
  router.use(apiV1RouteMounts.projects, projectsRouter);
  router.use(apiV1RouteMounts.public, publicRouter);

  return router;
}

export function createApiV1App(env: NodeJS.ProcessEnv = process.env) {
  const app = express();

  app.use(express.json());
  app.use(deploymentEnvironmentGuard(env));
  app.use(apiV1MountPath, createApiV1Router());

  app.use((_req, res) =>
    res.status(404).json({
      error: 'not_found',
      message: 'API route not found.',
    }),
  );

  app.use((_error: unknown, _req: Request, res: Response, _next: NextFunction) =>
    res.status(500).json({
      error: 'unexpected_failure',
      message: 'Unexpected API failure.',
    }),
  );

  return app;
}

export const apiV1App = createApiV1App();

export default apiV1App;
