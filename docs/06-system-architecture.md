# 6. System Architecture

## High-Level Architecture

```mermaid
flowchart TD
    Browser["Employee / Admin Browser"]
    FE["React + TypeScript Frontend (Vite)"]
    API["Express.js API"]
    DB[("Supabase PostgreSQL<br/>tickets, profiles, logs")]
    RAG["RAG Service"]
    VEC[("pgvector<br/>embeddings")]
    ACT["Action / Webhook Handler"]
    WF["Allowlisted Workflows<br/>e.g. create ticket"]
    LLM["Gemini API (hosted, server-side calls)"]
    AUTH["Supabase Auth<br/>auth.users"]

    Browser --> FE
    FE -->|"sign in"| AUTH
    FE -->|"HTTPS / REST"| API
    API --> DB
    API -->|"verify token"| AUTH
    API --> RAG
    API --> ACT
    RAG --> VEC
    RAG --> LLM
    ACT --> WF
```

## Request Sequence

```mermaid
sequenceDiagram
    actor User as Employee
    participant FE as React Frontend
    participant API as Express API
    participant RAG as RAG Service
    participant LLM as Gemini API
    participant DB as Supabase
    participant AUTH as Supabase Auth

    User->>FE: Ask IT question
    FE->>API: POST chat request
    API->>AUTH: Verify user token
    AUTH-->>API: User identity
    API->>DB: Look up profile and role
    API->>API: Validate request and permissions
    API->>RAG: Retrieve relevant KB passages
    RAG->>LLM: Embed query via server-side adapter
    LLM-->>RAG: Query embedding
    RAG->>DB: Vector search (pgvector)
    DB-->>RAG: Top matching chunks
    RAG-->>API: Context + source refs
    API->>LLM: Question + retrieved context
    LLM-->>API: Answer or proposed action
    API->>API: Validate action and arguments
    API->>DB: Store messages, outcome, audit event
    API-->>FE: Answer with sources / ticket result
    FE-->>User: Display response
```

## Description

The frontend sends a question to the Express API. The API verifies the user's Supabase Auth token, looks up their profile and role, validates the request and permissions, and uses the provider adapter in `server/src/shared/ai/` for Gemini query embeddings and answer generation. The RAG service retrieves relevant knowledge-base passages and sends the question and retrieved context to the hosted Gemini API. If the model proposes a supported action, the backend validates the action and arguments before executing it. The result, response, and relevant audit event are returned or stored. Unsupported or uncertain requests receive a safe response or are escalated.

## Security Boundary

`GEMINI_API_KEY` and privileged credentials remain in server environment variables only, are never sent to the browser, and are never included in client environment variables. The LLM does not receive direct database credentials or unrestricted access to external systems.

---

[← Technologies](05-technologies.md) · [README](../README.md) · Next: [Database Design](07-database-design.md)
