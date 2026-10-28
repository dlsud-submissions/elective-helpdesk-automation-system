import type { Request, Response } from 'express';
import {
  createTicket,
  getAllTickets,
  getAuditEntries,
  getTicketById,
  resolveRequestContext,
  updateTicket,
} from './tickets.service.js';

function getHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getRouteParamId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export const ticketsController = {
  list: (_request: Request, response: Response) => {
    response.json({ tickets: getAllTickets() });
  },

  get: (request: Request, response: Response) => {
    const ticketId = getRouteParamId(request.params.ticketId);
    const ticket = getTicketById(ticketId);

    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    response.json({ ticket, audit: getAuditEntries(ticket.id) });
  },

  create: (request: Request, response: Response) => {
    try {
      const context = resolveRequestContext({
        userId: getHeaderValue(request.headers['x-user-id']) ?? 'local-user',
        role:
          (getHeaderValue(request.headers['x-user-role']) as
            'employee' | 'agent' | 'admin' | undefined) ?? 'employee',
        displayName:
          getHeaderValue(request.headers['x-user-name']) ?? 'Employee User',
      });

      const ticket = createTicket(request.body ?? {}, context);
      response.status(201).json({ ticket });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ticket could not be created.';
      response.status(400).json({ error: message });
    }
  },

  update: (request: Request, response: Response) => {
    try {
      const context = resolveRequestContext({
        userId: getHeaderValue(request.headers['x-user-id']) ?? 'local-user',
        role:
          (getHeaderValue(request.headers['x-user-role']) as
            'employee' | 'agent' | 'admin' | undefined) ?? 'employee',
        displayName:
          getHeaderValue(request.headers['x-user-name']) ?? 'Employee User',
      });

      const ticketId = getRouteParamId(request.params.ticketId);
      const ticket = updateTicket(ticketId, request.body ?? {}, context);
      response.json({ ticket });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ticket could not be updated.';
      response.status(400).json({ error: message });
    }
  },
};
