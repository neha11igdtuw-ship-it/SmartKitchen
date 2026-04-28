import { Router } from 'express';
import * as gemini from '../controllers/geminiInsightsController.js';

export const insightsRouter = Router();

insightsRouter.get('/gemini/status', gemini.geminiInsightsStatus);
insightsRouter.post('/gemini', gemini.geminiPantryInsights);
