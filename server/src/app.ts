import cors from 'cors';
import express from 'express';
import { getAllowedOrigins } from './config/cors.js';
import { chatRouter } from './features/chat/index.js';
import { helloRouter } from './features/hello/index.js';
import { knowledgeRouter } from './features/knowledge/index.js';
import { ticketRouter } from './features/tickets/index.js';

export const app = express();

app.use(cors({ origin: getAllowedOrigins() }));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use(helloRouter);
app.use(ticketRouter);
app.use(knowledgeRouter);
app.use(chatRouter);
