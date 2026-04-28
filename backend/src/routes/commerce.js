import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as commerce from '../controllers/commerceController.js';
import * as commerceShot from '../controllers/commerceScreenshotController.js';

export const commerceRouter = Router();

commerceRouter.use(requireAuth);

commerceRouter.get('/profiles', commerce.listProfiles);
commerceRouter.post('/profiles', commerce.createProfile);
commerceRouter.delete('/profiles/:id', commerce.deleteProfile);

commerceRouter.post('/parse-order-screenshot', commerceShot.parseOrderScreenshot);

commerceRouter.get('/purchases', commerce.listPurchases);
commerceRouter.post('/purchases', commerce.createPurchase);
commerceRouter.post('/purchases/batch', commerce.createPurchasesBatch);
commerceRouter.delete('/purchases/:id', commerce.deletePurchase);

commerceRouter.get('/analytics', commerce.getAnalytics);
