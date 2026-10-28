# 3. Objectives

## General Objective

To develop a web-based AI helpdesk prototype that provides grounded IT support answers, manages support tickets, and demonstrates safe workflow automation and escalation.

## Specific Objectives

1. Build a responsive React website with an employee chat interface and an IT support/admin dashboard.
2. Develop an Express.js REST API for ticket management, knowledge-base operations, AI requests, and analytics.
3. Use Supabase Auth to authenticate users and Supabase PostgreSQL to persist application profiles (linked to the built-in `auth.users` table), tickets, knowledge-base records, conversations, and audit events.
4. Implement RAG retrieval over a curated set of fictional IT support procedures and include source references where available.
5. Demonstrate controlled AI function calling for permitted workflows, such as creating a ticket or escalating a request.
6. Evaluate core behavior using automated tests and a documented set of functional, security, and AI-quality test cases.

> **Note:** The course template asks for 3–5 specific objectives. The draft currently lists 6; consider merging items 1–2 or 5–6 before submission.

---

[← Problem Statement](../deliverables/02-problem-statement.md) · [README](../../README.md) · Next: [Scope & Limitations](../deliverables/04-scope-and-limitations.md)
