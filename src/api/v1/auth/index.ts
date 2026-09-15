import { Router } from 'express';
import { loginHandler } from './login';
import { logoutHandler } from './logout';
import { registerHandler } from './register';
import { sessionHandler } from './session';

export const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.post('/logout', logoutHandler);
authRouter.post('/register', registerHandler);
authRouter.get('/session', sessionHandler);
