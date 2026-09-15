import { Router } from 'express';
import { projectCreateHandler, projectListHandler } from './create';
import { projectDeleteHandler } from './delete';
import { projectGetHandler } from './get';
import { projectPublishHandler } from './publish';
import { projectUnpublishHandler } from './unpublish';
import { projectUpdateHandler } from './update';

export const projectsRouter = Router();

projectsRouter.get('/', projectListHandler);
projectsRouter.post('/', projectCreateHandler);
projectsRouter.get('/:id', projectGetHandler);
projectsRouter.put('/:id', projectUpdateHandler);
projectsRouter.delete('/:id', projectDeleteHandler);
projectsRouter.post('/:id/publish', projectPublishHandler);
projectsRouter.post('/:id/unpublish', projectUnpublishHandler);
