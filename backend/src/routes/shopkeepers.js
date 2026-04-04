import { Router } from 'express';
import * as shopkeepers from '../controllers/shopkeepersController.js';

export const shopkeepersRouter = Router();

shopkeepersRouter.post('/register', shopkeepers.register);
shopkeepersRouter.post('/login', shopkeepers.login);
