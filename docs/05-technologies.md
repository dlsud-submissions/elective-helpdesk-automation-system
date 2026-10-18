# 5. Technologies

| Component | Proposed Technology | Purpose / Notes |
| :-- | :-- | :-- |
| Frontend | React + TypeScript + Vite | Chat interface, ticket views, knowledge-base screens, and admin dashboard. |
| Backend | Node.js + Express.js + TypeScript | REST API, validation, business rules, authorization, RAG orchestration, and webhook handlers. |
| Database | Supabase PostgreSQL (Free Plan for prototype) | Stores tickets, profiles, conversations, and audit logs; subject to free-tier quotas. |
| Authentication | Supabase Auth | Handles sign-in and manages the built-in `auth.users` table. Application profiles and roles live in a linked `profiles` table. |
| Vector search | Supabase PostgreSQL + pgvector | Stores and searches document embeddings in the same database. pgvector is open-source and does not require a separate paid vector database; Supabase resource limits still apply. |
| LLM / model runtime | Ollama + locally run model | Runs the selected language model and exposes an API to Express. Model performance depends on available hardware. |
| Embeddings | Ollama embedding model (to be selected) | Generates document and query embeddings locally. Use the same embedding model for indexing and retrieval. |
| Automation | Express action handlers + webhooks; optional n8n | Executes allowlisted actions and demonstrates notifications or external integrations. |
| Testing | Vitest; API integration-test tooling to be selected | Unit tests and integration tests for business rules and API behavior. |
| Deployment | Vercel + Render | Vercel hosts the React frontend; Render hosts the Express API. Free tiers have usage limits and Render services may sleep when idle. |
| Version control | GitHub | Source control, collaboration, and deployment integration. |

## Notes

- React, Express.js, Supabase, Ollama, Vercel, and Render are the team's preferred choices.
- Supabase pgvector is recommended because it is an open-source PostgreSQL extension and can be used without buying a separate vector database. The Supabase Free Plan has project and resource quotas, so this is not unlimited hosting. Vercel Hobby and Render free services also have limits.

> **Important deployment caveat:** A Render-hosted backend cannot reach Ollama running only on a developer's local computer. For a live deployed demo, the Ollama model must run on a server reachable by Render, or the AI portion must be demonstrated locally.

## Open Decisions

- Whether Supabase pgvector is acceptable for the RAG requirement or a separate vector database is expected.
- Which LLM model and API budget are available to the team.
- Confirm Vercel frontend and Render backend deployment configuration, and whether Docker is mandatory for the final submission.

---

[← Scope & Limitations](04-scope-and-limitations.md) · [README](../README.md) · Next: [System Architecture](06-system-architecture.md)
