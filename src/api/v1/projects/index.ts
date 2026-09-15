import { Router } from 'express';
import { projectCreateHandler, projectListHandler } from './create';

export const projectsRouter = Router();

projectsRouter.get('/', projectListHandler);
projectsRouter.post('/', projectCreateHandler);
