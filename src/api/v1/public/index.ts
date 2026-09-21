import { Router } from 'express';

import { publicProjectAttachmentDownloadHandler } from '../projects/attachments';
import { publicProjectAttachmentsHandler, publicProjectHandler, publicProjectImagesHandler } from './project';

export const publicRouter = Router();

publicRouter.get('/projects/:id/attachments/:attachmentId', publicProjectAttachmentDownloadHandler);
publicRouter.get('/project/:slug/images', publicProjectImagesHandler);
publicRouter.get('/project/:slug/attachments', publicProjectAttachmentsHandler);
publicRouter.get('/project/:slug', publicProjectHandler);
