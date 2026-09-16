import { Router } from 'express';
import { discoverProjectsHandler } from './projects';

export const discoverRouter = Router();

discoverRouter.get('/projects', discoverProjectsHandler);
