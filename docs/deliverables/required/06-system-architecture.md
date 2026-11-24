# 6. System Architecture

## High-Level Architecture

```mermaid
flowchart TD
    Browser["Employee / Agent / Admin Browser"]
    FE["React + TypeScript Frontend (Vite)"]
    API["Express.js API"]
    DB[("Supabase PostgreSQL<br/>profiles, tickets, chat, knowledge")]
    CHAT["Curated local knowledge answer path"]
    DRAFT["Optional ticket-solution draft"]
    LLM["Gemini API (server-side, optional)"]
    AUTH["Supabase Auth<br/>auth.users"]

    Browser --> FE
    FE -->|"sign in"| AUTH
    FE -->|"HTTPS / REST"| API
    API --> DB
    API -->|"verify token"| AUTH
    API --> CHAT
    API --> DRAFT
    DRAFT --> LLM
```

## Request Sequence

```mermaid
sequenceDiagram
    actor User as Employee
    participant FE as React Frontend
    participant API as Express API
    participant KB as Curated Knowledge
    participant DB as Supabase
    participant AUTH as Supabase Auth

    User->>FE: Ask IT question
    FE->>API: POST /api/chat/messages
    API->>AUTH: Verify user token
    AUTH-->>API: User identity
    API->>DB: Look up profile and role
    API->>API: Validate request and permissions
    API->>KB: Rank curated support articles
    KB-->>API: Answer + source references or uncertainty
    API->>DB: Store messages, outcome, audit event
    API-->>FE: Persisted answer and conversation state
    FE-->>User: Display response
```

## Description

The frontend authenticates through Supabase Auth and sends its access token to the Express API. The API verifies the user and loads the trusted profile, including role and account status, before serving protected requests. Chat messages are answered against the curated local knowledge set and persisted with their source references. Ticket creation, assignment, replies, status changes, conversation management, and admin operations are validated and authorized by the API. Agents can request an optional Gemini-generated ticket-solution draft; the provider key remains server-side.

## Security Boundary

`GEMINI_API_KEY` and privileged database credentials remain server-side and are never sent to the browser. The language model has no direct database credentials or unrestricted access to external systems. Role checks and account-status enforcement happen on the server; the UI is not an authorization boundary.

---

[← Technologies](05-technologies.md) · [README](../../README.md) · Next: [Database Design](07-database-design.md)
