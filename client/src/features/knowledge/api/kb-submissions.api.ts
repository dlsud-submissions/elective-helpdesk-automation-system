import { apiFetch } from '../../../shared/api/http';

export type KbSubmissionStatus = 'pending' | 'accepted' | 'denied';

export type KbSubmission = {
  id: string;
  ticketId: string | null;
  ticketReference: string | null;
  agentId: string;
  agentName: string;
  input: string;
  solution: string;
  status: KbSubmissionStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  body: string;
  category: string;
  sourceName: string;
  isPublished: boolean;
  source: 'supabase' | 'seed';
};

export async function submitKbPair(input: {
  input: string;
  solution: string;
  ticketId?: string | null;
  ticketReference?: string | null;
}): Promise<KbSubmission> {
  return (
    await apiFetch<{ submission: KbSubmission }>('/api/kb-submissions', {
      method: 'POST',
      body: input,
    })
  ).submission;
}

export async function listKbSubmissions(
  status?: KbSubmissionStatus
): Promise<KbSubmission[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return (
    await apiFetch<{ submissions: KbSubmission[] }>(`/api/kb-submissions${qs}`)
  ).submissions;
}

export async function reviewKbSubmission(
  id: string,
  status: 'accepted' | 'denied',
  adminNote?: string
): Promise<KbSubmission> {
  return (
    await apiFetch<{ submission: KbSubmission }>(
      `/api/kb-submissions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { status, ...(adminNote ? { adminNote } : {}) } }
    )
  ).submission;
}

export async function listKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  return (
    await apiFetch<{ articles: KnowledgeArticle[] }>('/api/knowledge/articles')
  ).articles;
}
