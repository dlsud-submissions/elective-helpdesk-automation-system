import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteConversation,
  listArchivedConversations,
  setConversationArchived,
} from '../api/chat.api';
import type { Conversation } from '../types';
import { useDocumentTitle } from '../../../shared/ui/useDocumentTitle';

export function ArchivePage() {
  useDocumentTitle('Archived chats');
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setConversations(await listArchivedConversations());
    } catch {
      setError('Archived chats could not be loaded.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function restore(conversationId: string) {
    await setConversationArchived(conversationId, false);
    await load();
  }

  async function remove(conversationId: string) {
    await deleteConversation(conversationId);
    await load();
  }

  return (
    <div className="narrow">
      <section className="panel" aria-labelledby="archive-title">
        <h1 id="archive-title">Archived chats</h1>
        {error ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}
        {conversations === null ? <p className="muted">Loading…</p> : null}
        {conversations?.length === 0 ? (
          <p className="muted">No archived chats.</p>
        ) : null}
        {conversations?.length ? (
          <ul className="archive-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link to={`/chat/${conversation.id}`}>
                  {conversation.title}
                </Link>
                <div className="archive-actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void restore(conversation.id)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => void remove(conversation.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
