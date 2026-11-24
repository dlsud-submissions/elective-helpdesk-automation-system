# Chat and Conversation Contract

> Status: Current authenticated routes are implemented in `server/src/features/chat/`.

Employees submit questions through the persisted conversation flow. The current answer path ranks the curated knowledge set and returns a grounded answer with source references or an insufficient-context result. It does not call Gemini for chat answers.

| Method and path                                   | Access            | Behavior                                                                                    |
| :------------------------------------------------ | :---------------- | :------------------------------------------------------------------------------------------ |
| `POST /api/chat/answer`                           | Employee          | Stateless grounded answer; question is limited to 1,000 characters.                         |
| `POST /api/chat/messages`                         | Employee          | Adds a user message, creates or updates its conversation, and returns the assistant result. |
| `GET /api/conversations`                          | Employee or agent | Lists conversations visible to the caller.                                                  |
| `GET /api/conversations/archived`                 | Employee          | Lists the caller's archived conversations.                                                  |
| `GET /api/conversations/:conversationId/messages` | Employee or agent | Loads messages when the caller is authorized for the conversation.                          |
| `PATCH /api/conversations/:conversationId`        | Employee or agent | Renames a conversation or changes its archived state, based on the request fields.          |
| `DELETE /api/conversations/:conversationId`       | Employee or agent | Deletes an authorized conversation (soft deletion in persisted storage).                    |

Answers include source metadata when a curated article supports the response. Unsupported topics return a safe insufficient-context status without fabricated guidance. The persisted flow stores messages and sources so users can return to conversation history. The API remains responsible for authorization and ownership checks.
