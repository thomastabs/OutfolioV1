import { Router } from 'express';
import { registerHandler } from './register';

export const authRouter = Router();

authRouter.post('/register', registerHandler);
