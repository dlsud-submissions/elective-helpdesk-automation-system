export type KbSubmissionStatus = 'pending' | 'accepted' | 'denied';

export type KbSubmission = {
  id: string;
  ticketId: string | null;
  ticketReference: string | null;
  agentId: string;
  agentName: string;
  input: string; // employee problem / question
  solution: string; // agent solution text
  status: KbSubmissionStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};
