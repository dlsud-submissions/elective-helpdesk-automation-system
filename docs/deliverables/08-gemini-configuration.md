# 8. Gemini API Configuration and Validation

> **Sprint:** 1 (task S1-09, owner: Reganit, John; support: Rullan, Harvey)
> **Status:** Model IDs, dimension, and contract recorded from provider documentation. The live key check and the sample generation/embedding requests are **pending** the team's Google AI Studio project — see [Validation checklist](#validation-checklist).

This document records the Gemini model selection, embedding dimension, free-tier expectations, data-use terms, and failure behavior for the initial prototype. Implementation starts in Sprint 2 through the server-side provider adapter described in the [system architecture](../deliverables/06-system-architecture.md).

## Selected models

| Purpose        | Model ID (exact)       | Environment variable     | Notes                                                                                                               |
| :------------- | :--------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------ |
| Chat / answers | `gemini-2.5-flash`     | `GEMINI_CHAT_MODEL`      | Stable, price-performance model reachable at `models/gemini-2.5-flash`. Supports structured output for prompts 1–3. |
| Embeddings     | `gemini-embedding-001` | `GEMINI_EMBEDDING_MODEL` | Text-only embedding model for retrieval. Supports a configurable output dimension.                                  |

The same embedding model (`gemini-embedding-001`) must be used for **both** knowledge-base indexing and query embedding. Mixing embedding models makes the vector space inconsistent and produces meaningless similarity scores.

Pin the stable IDs (not an alias such as `gemini-flash-latest`) so a partner release cannot silently change model behavior during the sprint or on demo day. A model change requires re-embedding every `knowledge_chunks` row.

## Embedding dimension

| Setting                | Value                                     |
| :--------------------- | :---------------------------------------- |
| `EMBEDDING_DIMENSIONS` | `1536`                                    |
| pgvector column        | `knowledge_chunks.embedding vector(1536)` |
| Distance operator      | Cosine (`vector_cosine_ops`, HNSW index)  |

`gemini-embedding-001` returns a 3072-dimension vector by default and supports truncation to smaller sizes (for example 1536 or 768) through `output_dimensionality`. The initial schema already declares `vector(1536)` in [`supabase/migrations/20261022112527_init_schema.sql`](../supabase/migrations/20261022112527_init_schema.sql), so the adapter must request `outputDimensionality: 1536` explicitly, normalise the truncated vector, and fail closed if the returned length is not 1536.

Changing either the model or `EMBEDDING_DIMENSIONS` requires a new migration that resizes the column and re-embeds every stored chunk.

## Endpoints used (server-side only)

- Generation: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Embedding: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
- Authentication header: `x-goog-api-key: $GEMINI_API_KEY`

The API key is read only from the server process environment (local untracked `server/.env`, Render environment settings). It is never placed in `client/.env`, `VITE_*` variables, browser bundles, logs, error messages, or documentation.

## Validation checklist

Run these once a key exists, from a machine with the key only in the local environment. Record the date, status code, and response metadata — never the key or the full response body.

```bash
# 1. Generation smoke test (expect 200 and a short text candidate)
curl -sS -w '\nHTTP %{http_code}\n' \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Reply with the single word: ready"}]}]}'

# 2. Embedding smoke test (expect 200 and 1536 values in embeddings[0].values)
curl -sS -w '\nHTTP %{http_code}\n' \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent" \
  -d '{"model":"models/gemini-embedding-001","taskType":"RETRIEVAL_DOCUMENT","outputDimensionality":1536,"content":{"parts":[{"text":"Fictional procedure: reset the demo VPN client profile."}]}}'
```

| Check                                                | Result  | Recorded |
| :--------------------------------------------------- | :------ | :------- |
| Key present and accepted (no `401`/`403`)            | Pending | —        |
| Generation returns a candidate                       | Pending | —        |
| Embedding count equals `EMBEDDING_DIMENSIONS` (1536) | Pending | —        |
| Billing/tier shown in AI Studio                      | Pending | —        |
| Rate limits shown in AI Studio captured              | Pending | —        |

**Access blocker:** the team has not yet provided an AI Studio project key. Owner: Reganit, John with Rullan, Harvey; next action is to create the key in AI Studio, store it in Render/local `.env`, and complete this table before Sprint 2 ingestion work.

## Free-tier limits and data-use terms

- Rate limits apply **per project** (not per key) across requests per minute (RPM), input tokens per minute (TPM), and requests per day (RPD); RPD resets at midnight Pacific time. Limits for free tier are lower than paid tiers and preview models are more restricted. The exact numbers are visible only in AI Studio → _Rate limits_ for the team's project, so they are recorded in the validation pass rather than copied here.
- Spend-based limits do not apply to the free tier; exhausting any dimension returns the same quota error.
- **Data-use terms:** free-tier ("Unpaid services") prompts and responses may be used by Google to improve its products, and human reviewers may process them. The team therefore agrees that **only fictional IT support content** — invented procedures, invented employee names, invented ticket text — is ever sent to Gemini. No real employee data, credentials, API keys, tickets, or screenshots are submitted.
- The key must remain server-side. Any proposal to call Gemini from the browser is rejected because it would expose the key and violate the project's security boundary.

## Failure, quota, and demo fallback behavior

| Condition                                 | API surface                            | Server behavior expected from Sprint 2 adapter                                                                                           |
| :---------------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid or missing key (`401/403`)        | Error payload                          | Log a configuration error without the key, return `503` with a generic message, never echo the key.                                      |
| Quota exceeded (`429 RESOURCE_EXHAUSTED`) | Error with `RetryInfo` (when provided) | Honor `retryDelay` for at most one bounded retry; otherwise return `429` with a user-safe "assistant busy" message and offer escalation. |
| Transient `5xx` / network timeout         | Error                                  | Single short retry with backoff, then return `502`/`504` and offer escalation.                                                           |
| Empty or safety-blocked candidate         | Response with no usable text           | Treat as "cannot confirm", state uncertainty, and offer escalation instead of inventing an answer.                                       |
| Latency / cold start                      | n/a                                    | Request timeout of 20–30 s for generation, show a loading state, and keep the user request idempotent for retries.                       |
| Model deprecation                         | n/a                                    | Model IDs come from env vars, so a replacement is a configuration + re-index decision, not a code edit.                                  |

Demo fallback: if the Gemini API is unavailable during a demonstration, the backend serves a recorded, clearly labelled sample response (fictional data) and disables action execution, so no action is ever confirmed without model output and backend validation.

## Related decisions

- Prompt contracts and prompt-injection handling: [AI Prompt Design](../deliverables/09-ai-prompt-design.md) and [AI Prompt Taxonomy and Output Contracts](08a-prompt-taxonomy.md).
- Key location and provider table: [Technologies](../deliverables/05-technologies.md), [System Architecture](../deliverables/06-system-architecture.md).
- Vector column and re-embedding rule: [Database Design](../deliverables/07-database-design.md).

---

[← Database Design](../deliverables/07-database-design.md) · [README](../../README.md) · Next: [AI Prompt Design](../deliverables/09-ai-prompt-design.md)
