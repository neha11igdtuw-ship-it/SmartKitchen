import { Router } from 'express';
import * as auth from '../controllers/authController.js';

export const authRouter = Router();

authRouter.post('/register', auth.register);
authRouter.post('/login', auth.login);
authRouter.get('/me', auth.me);
