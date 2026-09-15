import { Router } from 'express';
import { profileMeHandler, updateProfileMeHandler } from './me';

export const profileRouter = Router();

profileRouter.get('/me', profileMeHandler);
profileRouter.put('/me', updateProfileMeHandler);
