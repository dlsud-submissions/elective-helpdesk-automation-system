import { Router } from 'express';
import { helloController } from './hello.controller.js';

export const helloRouter = Router();

helloRouter.post('/api/hello', helloController.greet);
