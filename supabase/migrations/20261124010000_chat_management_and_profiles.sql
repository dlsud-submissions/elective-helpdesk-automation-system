-- Chat management and staff replies.

alter table public.conversations
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.messages
  drop constraint if exists messages_sender_type_check,
  add constraint messages_sender_type_check
    check (sender_type in ('user', 'assistant', 'agent', 'system'));

alter table public.conversations
  drop constraint if exists conversations_title_check,
  add constraint conversations_title_check
    check (char_length(title) between 1 and 120);

create index if not exists conversations_archived_idx
  on public.conversations (archived_at, deleted_at, updated_at desc);
