# Sprint 4 Security and RAG QA Evidence

## S4-02: Prompt injection, model output, and privacy boundaries

Reusable fictional adversarial cases are in `server/tests/security/sprint-4-adversarial.test.ts`. They cover direct and retrieved-context injection strings, unsupported questions, disallowed intents, unexpected structured-output fields, and redaction of credentials and contact information. The action-proposal validator rejects unsupported intents and additional argument fields. Unsupported chat queries produce `insufficient_context` without citations.

Conversation answer failures previously logged the caught error object, which could contain provider response details. The service now logs a fixed message without the error payload. Stored user text is subject to existing credential and contact-data sanitization in action workflows; chat message persistence itself does not currently apply that sanitizer, so user-provided chat content may contain personal data and is a residual privacy risk.

## S4-04: RAG evaluation

The versioned fictional evaluation set is `server/data/evaluation/sprint-4-rag-v1.json`. It includes answerable, ambiguous, no-match, direct-injection, and retrieved-injection examples with expected source IDs. Automated checks in `server/tests/rag/sprint-4-evaluation.test.ts` verify expected-source overlap, nonempty real source references, and uncertainty/no citations for no-match cases.

The retrieval and answer path under test is deterministic local code backed by `server/src/shared/knowledge/seed.ts`; it is not a Gemini-backed chat or embedding run. Model IDs: not applicable (no hosted model invoked). Evaluation run date: 2026-11-29. Hosted-model relevance, grounding, and baseline-versus-tuned comparisons remain unmeasured and must not be inferred from these local checks.

## Local verification and limitations

- `npm test --workspace @elective-helpdesk/server -- tests/security/sprint-4-adversarial.test.ts tests/rag/sprint-4-evaluation.test.ts tests/unit/action-proposal.service.test.ts` — passed (23 tests).
- `npm run lint --workspace @elective-helpdesk/server` — passed.
- `npm run typecheck --workspace @elective-helpdesk/server` — not completed; the checkout is missing `@supabase/supabase-js`, causing module-resolution errors and downstream implicit-any errors.
- Chat integration tests were attempted but could not load for the same missing `@supabase/supabase-js` dependency.

The rule-based retrieval score and one-source answer rendering were adjusted to reduce stop-word false matches and irrelevant multi-article citations. The small hand-authored set is not representative of a production corpus; semantic relevance, adversarial coverage breadth, and hosted model behavior require further evaluation.
