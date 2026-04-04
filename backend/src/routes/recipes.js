import { Router } from 'express';
import * as recipes from '../controllers/recipesController.js';

export const recipesRouter = Router();

recipesRouter.get('/', recipes.listRecipes);
recipesRouter.get('/:id', recipes.getRecipe);
recipesRouter.post('/', recipes.createRecipe);
recipesRouter.put('/:id', recipes.updateRecipe);
recipesRouter.delete('/:id', recipes.deleteRecipe);
