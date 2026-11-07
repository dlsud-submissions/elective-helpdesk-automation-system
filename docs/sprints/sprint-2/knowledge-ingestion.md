# Knowledge ingestion and retrieval

The knowledge feature uses the fictional JSON corpus in `server/data/knowledge/`.
Add or replace an article by creating a `.json` file that includes a stable UUID
`id`, `title`, `sourceName`, `category`, `body`, and boolean `isPublished`.
Malformed files cause ingestion to fail with the article filename and validation
reason; unpublished files are not indexed.

Run `npm run knowledge:ingest --workspace @elective-helpdesk/server` after
configuring `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`,
`EMBEDDING_DIMENSIONS`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the
server environment. Apply the Supabase migrations first. Each run replaces an
article's existing chunks transactionally, so updates do not leave stale
chunks. Embedding failures occur before replacement and leave the prior index
intact.

Chunking normalizes newlines and horizontal whitespace, combines paragraphs up
to 900 characters, and splits long paragraphs into overlapping chunks (120
characters of overlap). The Gemini adapter batches at most 16 texts per request,
limits each input to 8,000 characters, checks every vector against the configured
dimension, and retries one HTTP 429 using a bounded `Retry-After` delay.
The configured model and dimension must match the database's
`extensions.vector(1536)` column. Changing either requires updating the
pgvector column/migrations and re-ingesting the complete corpus.

`GET /api/knowledge/search?q=<question>` embeds a query with
`RETRIEVAL_QUERY` and returns up to five published chunks with similarity at
least 0.5. Search settings can be changed through `KnowledgeService` options;
the database RPC also enforces a maximum of 20 results. An empty `results`
array means retrieval completed without a qualifying match. Retrieval failures
are returned as controlled service-unavailable responses.

The fixture corpus and automated tests are fictional and use mocked provider
responses. A live Supabase migration and Gemini request were not performed as
part of local validation.
