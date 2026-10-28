import { Router } from 'express';
import { knowledgeController } from './knowledge.controller.js';

export const knowledgeRouter = Router();

knowledgeRouter.get('/api/knowledge/search', knowledgeController.search);
