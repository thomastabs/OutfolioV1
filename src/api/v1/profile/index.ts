import { Router } from 'express';
import { profileMeHandler, updateProfileMeHandler } from './me';
import { publicProfileHandler } from './public';

export const profileRouter = Router();

profileRouter.get('/me', profileMeHandler);
profileRouter.put('/me', updateProfileMeHandler);
profileRouter.get('/public/:username', publicProfileHandler);
