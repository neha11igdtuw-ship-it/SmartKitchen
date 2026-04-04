import { Router } from 'express';
import * as kitchen from '../controllers/kitchenController.js';

export const kitchenRouter = Router();

kitchenRouter.get('/data', kitchen.getKitchenData);
kitchenRouter.post('/data', kitchen.saveKitchenData);
kitchenRouter.post('/data/migrate', kitchen.migrateKitchenData);
