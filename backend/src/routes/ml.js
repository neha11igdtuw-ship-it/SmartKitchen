import { Router } from 'express';
import { mlHealth, mlPredict } from '../controllers/mlController.js';

export const mlRouter = Router();

mlRouter.get('/health', mlHealth);
mlRouter.post('/predict', mlPredict);
