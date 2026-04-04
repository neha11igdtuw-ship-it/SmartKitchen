import { Router } from 'express';
import * as deals from '../controllers/dealsController.js';

export const dealsRouter = Router();

dealsRouter.get('/', deals.listDeals);
dealsRouter.post('/', deals.createDeal);
dealsRouter.post('/:id/claim', deals.claimDeal);
