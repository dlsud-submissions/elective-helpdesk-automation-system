import { Router } from 'express';
import { chatController } from './chat.controller.js';

export const chatRouter = Router();

chatRouter.post('/api/chat/answer', chatController.answer);
