# Knowledge and Submission Contract

> Status: Current routes are implemented in `server/src/features/knowledge/` and `server/src/features/kb-submissions/`.

| Method and path                      | Access        | Behavior                                                                                         |
| :----------------------------------- | :------------ | :----------------------------------------------------------------------------------------------- |
| `GET /api/knowledge/search`          | Authenticated | Searches knowledge sources for a grounded answer.                                                |
| `GET /api/knowledge/articles`        | Admin         | Lists seeded and persisted knowledge articles.                                                   |
| `POST /api/kb-submissions`           | Agent         | Submits a problem/solution pair; `input` is limited to 5,000 characters and `solution` to 8,000. |
| `GET /api/kb-submissions?status=...` | Admin         | Lists submissions, optionally filtered by status.                                                |
| `PATCH /api/kb-submissions/:id`      | Admin         | Accepts or denies a submission and may include an admin note.                                    |

The API derives agent identity from the verified caller. Accepted submissions are available for knowledge-base review; only administrators can review and change submission status. Invalid submissions and unknown IDs return controlled errors.
