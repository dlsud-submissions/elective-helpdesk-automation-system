-- Core helpdesk schema: tickets, conversations, messages, audit logs,
-- automation runs, and Row Level Security policies for every application table.
-- The Express API uses the service role for writes; policies below define what a
-- signed-in browser session may read or write directly with the anon key.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Authoritative role for the current session, read from profiles (never from
-- user-editable auth metadata). security definer avoids recursive RLS checks.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_requester_idx
  on public.conversations (requester_id, updated_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'assistant', 'system')),
  content text not null check (char_length(content) between 1 and 8000),
  outcome text check (
    outcome is null or outcome in (
      'answered', 'clarification', 'escalation_suggested', 'ticket_created', 'escalated'
    )
  ),
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs) = 'array'),
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  -- Human-friendly reference shown in the UI as TCK-<ticket_number>.
  ticket_number bigint generated always as identity (start with 2001) unique,
  -- Tickets are retained when a requester is removed only after an admin
  -- reassigns or archives them, so deletion is restricted.
  requester_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 5000),
  category text not null default 'general' check (char_length(category) between 1 and 60),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'open', 'in_progress', 'pending', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  is_escalated boolean not null default false,
  conversation_id uuid references public.conversations(id) on delete set null,
  escalation_summary text check (
    escalation_summary is null or char_length(escalation_summary) <= 4000
  ),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tickets_status_idx on public.tickets (status);
create index tickets_requester_idx on public.tickets (requester_id, created_at desc);
create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_created_at_idx on public.tickets (created_at);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- Record when a ticket first reaches resolved/closed so analytics can count
-- resolutions per date range without reading the audit log.
create or replace function public.set_ticket_resolved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('resolved', 'closed') and new.resolved_at is null then
    new.resolved_at = now();
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;

create trigger tickets_set_resolved_at
  before insert or update of status on public.tickets
  for each row execute function public.set_ticket_resolved_at();

-- ---------------------------------------------------------------------------
-- Audit and automation
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Audit history is kept when an actor is deleted; the actor becomes null.
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  resource_type text not null check (char_length(resource_type) between 1 and 60),
  resource_id text not null,
  outcome text not null default 'success'
    check (outcome in ('success', 'denied', 'failed')),
  summary text check (summary is null or char_length(summary) <= 1000),
  created_at timestamptz not null default now()
);

create index audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id, created_at);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  action_type text not null check (char_length(action_type) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  result_summary text check (result_summary is null or char_length(result_summary) <= 1000),
  created_at timestamptz not null default now()
);

create index automation_runs_ticket_idx
  on public.automation_runs (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.automation_runs enable row level security;

-- profiles: users read their own profile; agents/admins read all profiles.
-- No update/insert/delete policy exists for browser sessions, so roles can only
-- be changed by server-side code (service role) or an admin in SQL.
create policy "profiles_select_own_or_staff"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role() in ('agent', 'admin'));

revoke insert, update, delete on public.profiles from anon, authenticated;

-- knowledge: signed-in users may read published articles; chunks and
-- embeddings stay service-role only (no policy).
create policy "knowledge_articles_select_published"
  on public.knowledge_articles for select to authenticated
  using (is_published);

-- conversations: owners only.
create policy "conversations_select_own"
  on public.conversations for select to authenticated
  using (requester_id = auth.uid());

create policy "conversations_insert_own"
  on public.conversations for insert to authenticated
  with check (requester_id = auth.uid());

-- messages: readable/insertable only inside a conversation the user owns.
create policy "messages_select_own_conversation"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.requester_id = auth.uid()
    )
  );

create policy "messages_insert_own_conversation"
  on public.messages for insert to authenticated
  with check (
    sender_type = 'user'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.requester_id = auth.uid()
    )
  );

-- tickets: requesters read their own; agents/admins read and update all.
create policy "tickets_select_own_or_staff"
  on public.tickets for select to authenticated
  using (
    requester_id = auth.uid()
    or public.current_app_role() in ('agent', 'admin')
  );

create policy "tickets_insert_own"
  on public.tickets for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'new'
    and assigned_to is null
  );

create policy "tickets_update_staff"
  on public.tickets for update to authenticated
  using (public.current_app_role() in ('agent', 'admin'))
  with check (public.current_app_role() in ('agent', 'admin'));

-- audit_logs / automation_runs: admins may read; writes are service-role only.
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using (public.current_app_role() = 'admin');

create policy "automation_runs_select_admin"
  on public.automation_runs for select to authenticated
  using (public.current_app_role() = 'admin');

revoke all on public.audit_logs, public.automation_runs from anon;
revoke insert, update, delete on public.audit_logs, public.automation_runs from authenticated;
revoke all on public.knowledge_chunks from anon, authenticated;

-- Similarity search is executed by the API with the service role.
revoke all on function public.match_chunks(extensions.vector, int, float) from public, anon, authenticated;
grant execute on function public.match_chunks(extensions.vector, int, float) to service_role;
