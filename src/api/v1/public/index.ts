import { Router } from 'express';

import { publicProjectHandler, publicProjectImagesHandler } from './project';

export const publicRouter = Router();

publicRouter.get('/project/:slug/images', publicProjectImagesHandler);
publicRouter.get('/project/:slug', publicProjectHandler);
