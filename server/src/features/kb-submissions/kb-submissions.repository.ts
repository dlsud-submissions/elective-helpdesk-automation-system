import { randomUUID } from 'node:crypto';
import { getServiceClient } from '../../shared/database/index.js';
import type {
  KbSubmission,
  KbSubmissionStatus,
} from './kb-submissions.types.js';

export interface KbSubmissionRepository {
  create(input: {
    ticketId: string | null;
    ticketReference: string | null;
    agentId: string;
    agentName: string;
    input: string;
    solution: string;
  }): Promise<KbSubmission>;

  list(filter?: { status?: KbSubmissionStatus }): Promise<KbSubmission[]>;

  findById(id: string): Promise<KbSubmission | null>;

  updateStatus(
    id: string,
    status: KbSubmissionStatus,
    adminNote?: string
  ): Promise<KbSubmission | null>;
}

/** In-memory fallback used when Supabase table doesn't exist yet. */
class InMemoryKbSubmissionRepository implements KbSubmissionRepository {
  private rows: KbSubmission[] = [];

  async create(input: {
    ticketId: string | null;
    ticketReference: string | null;
    agentId: string;
    agentName: string;
    input: string;
    solution: string;
  }): Promise<KbSubmission> {
    const now = new Date().toISOString();
    const row: KbSubmission = {
      id: randomUUID(),
      status: 'pending',
      adminNote: null,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.rows.push(row);
    return row;
  }

  async list(filter?: {
    status?: KbSubmissionStatus;
  }): Promise<KbSubmission[]> {
    if (filter?.status) {
      return this.rows.filter((r) => r.status === filter.status);
    }
    return [...this.rows];
  }

  async findById(id: string): Promise<KbSubmission | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async updateStatus(
    id: string,
    status: KbSubmissionStatus,
    adminNote?: string
  ): Promise<KbSubmission | null> {
    const index = this.rows.findIndex((r) => r.id === id);
    if (index < 0) return null;
    const updated: KbSubmission = {
      ...this.rows[index]!,
      status,
      adminNote: adminNote ?? this.rows[index]!.adminNote,
      updatedAt: new Date().toISOString(),
    };
    this.rows[index] = updated;
    return updated;
  }
}

export class SupabaseKbSubmissionRepository implements KbSubmissionRepository {
  private fallback = new InMemoryKbSubmissionRepository();

  private get db() {
    return getServiceClient();
  }

  async create(input: {
    ticketId: string | null;
    ticketReference: string | null;
    agentId: string;
    agentName: string;
    input: string;
    solution: string;
  }): Promise<KbSubmission> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const row = {
      id,
      ticket_id: input.ticketId,
      ticket_reference: input.ticketReference,
      agent_id: input.agentId,
      agent_name: input.agentName,
      input: input.input,
      solution: input.solution,
      status: 'pending' as KbSubmissionStatus,
      admin_note: null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.db
      .from('kb_submissions')
      .insert(row)
      .select()
      .single();
    if (error) {
      console.warn(
        'kb_submissions table not found, using in-memory store:',
        error.message
      );
      return this.fallback.create(input);
    }
    return this.toModel(data);
  }

  async list(filter?: {
    status?: KbSubmissionStatus;
  }): Promise<KbSubmission[]> {
    let query = this.db
      .from('kb_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (filter?.status) query = query.eq('status', filter.status);
    const { data, error } = await query;
    if (error) {
      console.warn(
        'kb_submissions list failed, using in-memory store:',
        error.message
      );
      return this.fallback.list(filter);
    }
    return (data ?? []).map((r) => this.toModel(r));
  }

  async findById(id: string): Promise<KbSubmission | null> {
    const { data, error } = await this.db
      .from('kb_submissions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return this.fallback.findById(id);
    return data ? this.toModel(data) : null;
  }

  async updateStatus(
    id: string,
    status: KbSubmissionStatus,
    adminNote?: string
  ): Promise<KbSubmission | null> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (adminNote !== undefined) patch.admin_note = adminNote;
    const { data, error } = await this.db
      .from('kb_submissions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) return this.fallback.updateStatus(id, status, adminNote);
    return data ? this.toModel(data) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toModel(row: any): KbSubmission {
    return {
      id: row.id,
      ticketId: row.ticket_id ?? null,
      ticketReference: row.ticket_reference ?? null,
      agentId: row.agent_id,
      agentName: row.agent_name,
      input: row.input,
      solution: row.solution,
      status: row.status,
      adminNote: row.admin_note ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Module-level singleton — shared by all requests
export const kbSubmissionRepository = new SupabaseKbSubmissionRepository();
