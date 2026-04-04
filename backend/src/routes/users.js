import { Router } from 'express';
import * as users from '../controllers/usersController.js';

export const usersRouter = Router();

usersRouter.get('/', users.listUsers);
usersRouter.get('/:id', users.getUser);
usersRouter.post('/', users.createUser);
usersRouter.put('/:id', users.updateUser);
usersRouter.delete('/:id', users.deleteUser);
