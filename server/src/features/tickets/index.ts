export { createTicketRouter } from './tickets.routes.js';
export {
  TicketService,
  allowedStatuses,
  assertTransition,
  normalizePriority,
  normalizeStatus,
  validTransitions,
  validateTicketRequest,
} from './tickets.service.js';
export {
  InMemoryTicketRepository,
  SupabaseTicketRepository,
  formatTicketReference,
} from './tickets.repository.js';
export type {
  AuditLogEntry,
  NewTicket,
  TicketMutation,
  TicketPriority,
  TicketRecord,
  TicketRepository,
  TicketRequest,
  TicketStatus,
} from './tickets.types.js';
