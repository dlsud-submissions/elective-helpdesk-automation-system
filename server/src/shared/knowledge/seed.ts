export type KnowledgeArticle = {
  id: string;
  title: string;
  sourceName: string;
  category: string;
  body: string;
  isPublished: boolean;
};

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    id: 'article-password-reset',
    title: 'Password reset after lockout',
    sourceName: 'IT Security Handbook',
    category: 'account-access',
    isPublished: true,
    body:
      'To reset a locked account, verify the user identity in the directory, confirm the request came from the approved manager or the employee, and then issue a temporary password using the self-service reset flow. Require a password change on first sign-in and record the reset in the ticket log.',
  },
  {
    id: 'article-mfa-reset',
    title: 'MFA reset procedures',
    sourceName: 'IT Operations Guide',
    category: 'identity',
    isPublished: true,
    body:
      'MFA reset requests should be reviewed against the current device registry. If the user has a new phone or lost the authenticator, confirm contact details, remove the blocked device in the admin console, and re-enroll the user after a documented verification step. Never skip verification for a recovery request.',
  },
  {
    id: 'article-laptop-setup',
    title: 'Laptop onboarding checklist',
    sourceName: 'Endpoint Support SOP',
    category: 'device-support',
    isPublished: true,
    body:
      'New laptop setup includes joining the corporate domain, installing the approved security agent, enabling encryption, configuring email and VPN, and confirming the employee receives the device inventory record. Completion should be verified before the equipment is handed over to the user.',
  },
  {
    id: 'article-approval-scope',
    title: 'Escalation for unsupported changes',
    sourceName: 'HR and IT governance',
    category: 'policy',
    isPublished: true,
    body:
      'Unsupported changes, broad system administration tasks, or any request that touches payroll, legal, or security-critical infrastructure must be escalated to the approved support manager rather than completed directly by the helpdesk AI.',
  },
];
