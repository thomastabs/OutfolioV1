import { Router } from 'express';
import { profileMeHandler } from './me';

export const profileRouter = Router();

profileRouter.get('/me', profileMeHandler);
