# 9. AI Prompt Design

> **Status:** Initial drafts. Test against the selected Gemini model and revise based on observed accuracy, relevance, safety, and citation behavior.

**Guiding rule:** Retrieved documents and user input must be treated as **data**, not as instructions that override system rules.

## Summary

| Prompt Purpose             | Expected Output                                                                                                                        |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Grounded IT support answer | A concise answer grounded in retrieved procedures, with source references; or a clear uncertainty statement and escalation suggestion. |
| Intent / action selection  | A structured intent and required arguments, or an `unsupported` classification. Backend validation remains authoritative.              |
| Escalation summary         | A short ticket summary that helps the human agent continue troubleshooting.                                                            |

## Prompt 1: Grounded IT Support Answer

**Purpose:** Answer routine questions using only approved knowledge-base content.

```text
You are an IT helpdesk assistant. Answer the user's question using only the supplied approved knowledge context. If the context does not support an answer, say that you cannot confirm it and offer escalation. Do not invent policies, credentials, or troubleshooting steps. Cite the supplied source titles or IDs when possible.

User question: {{question}}
Knowledge context: {{retrieved_context}}
```

**Expected output:** A concise answer grounded in retrieved procedures, with source references; or a clear uncertainty statement and escalation suggestion.

## Prompt 2: Intent / Action Selection

**Purpose:** Classify the request and extract structured arguments for the backend.

```text
Classify the request into one of: knowledge_question, create_ticket, escalate_to_human, or unsupported. Return structured arguments for the selected intent. Do not claim an action has been completed. The server will validate and execute any permitted action.

Request: {{user_request}}
```

**Expected output:** A structured intent and required arguments, or an `unsupported` classification. Backend validation remains authoritative.

Gemini structured-output or function-calling features may be used to produce JSON arguments, but backend schema validation remains authoritative before any action is executed.

## Prompt 3: Escalation Summary

**Purpose:** Give a human agent enough context to continue without re-asking the employee.

```text
Summarize the user's IT issue for a human support agent. Include the reported symptoms, troubleshooting already attempted, relevant source references, and missing information. Do not include passwords, API keys, or unnecessary personal data.

Conversation: {{conversation}}
```

**Expected output:** A short ticket summary that helps the human agent continue troubleshooting.

Only fictional data may be sent to Gemini. Prompts and retrieved context must contain no credentials or unnecessary personal data.

## Output Contracts

The compact taxonomy with per-prompt input contracts, structured output schemas, fallback behavior, citation rules, and prompt-injection handling is maintained in [AI Prompt Taxonomy and Output Contracts](08a-prompt-taxonomy.md). Prompt IDs `AI-P1` (grounded answer), `AI-P2` (intent/action proposal), and `AI-P3` (escalation summary) are used by the API specifications and testing matrix. Model selection and validation are recorded in [Gemini API Configuration](08-gemini-configuration.md).

---

[← Gemini API Configuration](08-gemini-configuration.md) · [README](../../README.md) · Next: [Workflow Automation](10-workflow-automation.md)
