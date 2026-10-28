import { Router } from 'express';
import { ticketsController } from './tickets.controller.js';

export const ticketRouter = Router();

ticketRouter.get('/api/tickets', ticketsController.list);
ticketRouter.post('/api/tickets', ticketsController.create);
ticketRouter.get('/api/tickets/:ticketId', ticketsController.get);
ticketRouter.patch('/api/tickets/:ticketId', ticketsController.update);
