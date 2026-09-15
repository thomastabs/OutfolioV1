import { Router } from 'express';
import { loginHandler } from './login';
import { registerHandler } from './register';

export const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.post('/register', registerHandler);
