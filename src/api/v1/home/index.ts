import { Router } from 'express';

import { homeDashboardHandler } from './dashboard';

export const homeRouter = Router();

homeRouter.get('/dashboard', homeDashboardHandler);
