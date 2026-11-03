# Grounded Answer Contract

> Status: Sprint 3 contract baseline for authenticated employee chat and RAG response handling.

## Purpose

This endpoint allows an authenticated employee to ask an IT support question and receive a grounded answer with source references. The backend retrieves relevant knowledge, applies the allowed prompt contract, and returns either a direct answer, an uncertainty result, or an escalation result.

## Endpoint

### `POST /api/chat/answer`

#### Request body

```json
{
  "question": "How do I reset my VPN connection after a failed update?"
}
```

#### Validation rules

- `question` is required and must be a non-empty string.
- `question` length must respect the implementation limit defined by the backend.
- The request must be authenticated and tied to the active employee profile.
- Retrieval and model calls happen only on the server side.

#### Success response: `200 OK`

```json
{
  "status": "answered",
  "answer": "The approved VPN reset procedure is to close the client, restart the network adapter, and reconnect using the company profile. Re-run the connection only after the update is complete.",
  "citations": [
    {
      "sourceId": "vpn-reset-procedure",
      "title": "VPN Reset Procedure",
      "chunkId": "chunk-7",
      "relevanceScore": 0.92
    }
  ],
  "confidence": "high"
}
```

#### Uncertain response: `200 OK`

```json
{
  "status": "uncertain",
  "answer": "I could not find enough approved guidance for this exact issue. Please provide the error text or request a human agent.",
  "citations": [],
  "confidence": "low",
  "requiresEscalation": true
}
```

#### Escalation response: `200 OK`

```json
{
  "status": "escalated",
  "answer": "I’ve escalated this issue to the IT helpdesk for review.",
  "citationCount": 0,
  "confidence": "low",
  "escalationId": "ESC-17"
}
```

## Error responses

- `400 Bad Request` — invalid question payload or malformed input
- `401 Unauthorized` — missing or invalid session
- `429 Too Many Requests` — API quota or rate limit reached
- `504 Gateway Timeout` — model or upstream retrieval timed out
- `503 Service Unavailable` — retrieval/model dependency unavailable

## Response contract rules

- Answers must be grounded in retrieved approved content and never invent unsupported procedures.
- Source references are included only when evidence exists and the source can be identified reliably.
- The backend must distinguish between an unsupported result, a low-confidence answer, and a true dependency failure.
- The LLM may propose an action, but the backend validates it before any side effect is allowed.
- The client must not call the Gemini API directly or expose provider credentials.

## Source reference model

```json
{
  "sourceId": "string",
  "title": "string",
  "chunkId": "string",
  "relevanceScore": 0.0
}
```

Where:

- `sourceId` is the stable article or source identifier
- `title` is the visible source title for the UI
- `chunkId` is the internal knowledge chunk identifier used for traceability
- `relevanceScore` is optional but recommended for ranking and display
