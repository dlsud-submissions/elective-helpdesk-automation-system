# AI-HAS Defense Deck

## 1. Title

AI-Powered Enterprise Helpdesk and Workflow Automation System

## 2. Problem and users

- Repeat routine IT support questions are slow to route.
- Employees need grounded guidance and a usable escalation path.
- Agents and admins need role-appropriate ticket workflows.

## 3. Objectives and scope

- Grounded employee chat with citations.
- Controlled ticket creation and escalation.
- Agent/admin ticket operations and aggregate analytics.
- Prototype boundaries: fictional data, local or selected hosted demo, no production-readiness claim.

## 4. Architecture

- React/Vite employee and agent/admin UI.
- Express feature APIs with verified Supabase sessions.
- Supabase PostgreSQL, profiles, RLS, tickets, conversations, audit, and automation records.
- Server-side Gemini/RAG adapters; Gemini and service-role credentials remain server-only.

## 5. RAG and citations

- Versioned fictional knowledge articles and chunking.
- Retrieval yields source IDs, titles, excerpts, and relevance.
- No-match and weak-evidence behavior returns uncertainty and escalation.
- Hosted-model output is still subject to residual evaluation limitations.

## 6. Controlled automation

- Strict intent/action proposal validation.
- Server authorization and confirmation requirements.
- Only allowlisted ticket/escalation/simulation handlers execute.
- Idempotency and audit outcomes prevent uncontrolled duplicate actions.

## 7. Security and privacy

- Profiles come from the trusted server profile path, not user metadata.
- Protected routes enforce authentication and role checks.
- RLS and route authorization must agree.
- Provider details and internal errors are not returned to clients.

## 8. Evidence

- 44 client tests passed.
- 109 server tests passed.
- Security, RAG, timeout, 429, ticket, auth, and dashboard integration coverage passed.
- Typechecks, lint, format, and builds passed.
- E2E and hosted infrastructure remain explicitly environment-dependent.

## 9. Demo and fallback

- Local sign-in, cited chat, ticket, escalation, dashboard, and denial flow.
- If Gemini or hosted network is unavailable, show controlled uncertainty/503 behavior and the persisted local ticket flow.
- Reset to seeded fictional data; never expose credentials or real personal data.

## 10. Limitations and conclusion

- Hosted model, quota, cold-start, and RLS measurements remain uncompleted unless their environments are available.
- Prototype scope does not establish formal production certification.
- The implemented system demonstrates grounded assistance, role boundaries, controlled automation, and an auditable ticket workflow.
