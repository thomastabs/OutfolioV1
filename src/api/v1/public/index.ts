import { Router } from 'express';

import { publicProjectHandler } from './project';

export const publicRouter = Router();

publicRouter.get('/project/:slug', publicProjectHandler);
