create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null check (length(btrim(description)) between 1 and 4000),
  category text not null check (category in ('hardware', 'software', 'network', 'account', 'other')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'escalated')),
  assigned_to uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, idempotency_key)
);

create table public.ticket_escalations (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  reason text not null check (reason in ('low_confidence', 'policy_gap', 'user_requested_agent')),
  summary text not null check (length(btrim(summary)) between 1 and 2000),
  queue text not null default 'IT-agents',
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null,
  action_type text not null check (action_type in ('create_ticket', 'escalate_to_human', 'send_test_notification')),
  status text not null check (status in ('success', 'failed')),
  result_summary text not null check (length(btrim(result_summary)) between 1 and 500),
  error_code text,
  created_at timestamptz not null default now(),
  unique (actor_id, idempotency_key)
);

alter table public.conversations enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_escalations enable row level security;
alter table public.automation_runs enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

create policy "Users can read their own conversations"
  on public.conversations for select to authenticated
  using (requester_id = (select auth.uid()));

create policy "Users and agents can read tickets"
  on public.tickets for select to authenticated
  using (
    requester_id = (select auth.uid())
    or public.current_profile_role() in ('agent', 'admin')
  );

create policy "Users and agents can read escalation records"
  on public.ticket_escalations for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (
          t.requester_id = (select auth.uid())
          or public.current_profile_role() in ('agent', 'admin')
        )
    )
  );

create policy "Users and agents can read their automation outcomes"
  on public.automation_runs for select to authenticated
  using (
    actor_id = (select auth.uid())
    or public.current_profile_role() in ('agent', 'admin')
  );

create or replace function public.create_helpdesk_ticket(
  p_requester_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_priority text,
  p_idempotency_key text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket_id uuid;
  v_status text;
  v_action_type text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_requester_id::text || ':' || p_idempotency_key, 0)
  );
  select id, status into v_ticket_id, v_status
  from public.tickets
  where requester_id = p_requester_id and idempotency_key = p_idempotency_key;
  if v_ticket_id is not null then
    select action_type into v_action_type
    from public.automation_runs
    where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
    if v_action_type is distinct from 'create_ticket' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
    return jsonb_build_object('ticketId', v_ticket_id, 'status', v_status);
  end if;

  if not exists (select 1 from public.profiles where id = p_requester_id) then
    raise exception 'Requester profile does not exist' using errcode = '22023';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.conversations
    where id = p_conversation_id and requester_id = p_requester_id
  ) then
    raise exception 'Conversation does not belong to requester' using errcode = '22023';
  end if;

  insert into public.tickets (
    requester_id, title, description, category, priority, conversation_id, idempotency_key
  ) values (
    p_requester_id, p_title, p_description, p_category, p_priority, p_conversation_id, p_idempotency_key
  )
  on conflict (requester_id, idempotency_key) do nothing
  returning id, status into v_ticket_id, v_status;

  if v_ticket_id is null then
    select id, status into v_ticket_id, v_status
    from public.tickets
    where requester_id = p_requester_id and idempotency_key = p_idempotency_key;
    select action_type into v_action_type
    from public.automation_runs
    where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
    if v_action_type is distinct from 'create_ticket' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
    return jsonb_build_object('ticketId', v_ticket_id, 'status', v_status);
  end if;

  insert into public.automation_runs (
    ticket_id, conversation_id, actor_id, idempotency_key, action_type, status, result_summary
  ) values (
    v_ticket_id, p_conversation_id, p_requester_id, p_idempotency_key,
    'create_ticket', 'success', 'Ticket created'
  );

  return jsonb_build_object('ticketId', v_ticket_id, 'status', v_status);
end;
$$;

create or replace function public.create_helpdesk_escalation(
  p_requester_id uuid,
  p_title text,
  p_summary text,
  p_reason text,
  p_conversation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_ticket_id uuid;
  v_status text;
  v_queue text := 'IT-agents';
  v_action_type text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_requester_id::text || ':' || p_idempotency_key, 0)
  );
  if not exists (select 1 from public.profiles where id = p_requester_id) then
    raise exception 'Requester profile does not exist' using errcode = '22023';
  end if;

  select id, status into v_ticket_id, v_status
  from public.tickets
  where requester_id = p_requester_id and idempotency_key = p_idempotency_key;
  if v_ticket_id is not null then
    select action_type into v_action_type
    from public.automation_runs
    where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
    if v_action_type is distinct from 'escalate_to_human' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
    select queue into v_queue
    from public.ticket_escalations
    where ticket_id = v_ticket_id;
    return jsonb_build_object(
      'ticketId', v_ticket_id, 'status', v_status, 'queue', v_queue
    );
  end if;

  if p_conversation_id is null then
    insert into public.conversations (requester_id)
    values (p_requester_id)
    returning id into v_conversation_id;
  else
    select id into v_conversation_id
    from public.conversations
    where id = p_conversation_id and requester_id = p_requester_id;
    if v_conversation_id is null then
      raise exception 'Conversation does not belong to requester' using errcode = '22023';
    end if;
  end if;

  insert into public.tickets (
    requester_id, title, description, category, priority, status, conversation_id, idempotency_key
  ) values (
    p_requester_id, p_title, p_summary, 'other', 'medium', 'escalated',
    v_conversation_id, p_idempotency_key
  )
  on conflict (requester_id, idempotency_key) do nothing
  returning id, status into v_ticket_id, v_status;

  if v_ticket_id is null then
    select id, status into v_ticket_id, v_status
    from public.tickets
    where requester_id = p_requester_id and idempotency_key = p_idempotency_key;
    select action_type into v_action_type
    from public.automation_runs
    where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
    if v_action_type is distinct from 'escalate_to_human' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
    select queue into v_queue
    from public.ticket_escalations
    where ticket_id = v_ticket_id;
    return jsonb_build_object(
      'ticketId', v_ticket_id, 'status', v_status, 'queue', v_queue
    );
  end if;

  insert into public.ticket_escalations (ticket_id, conversation_id, reason, summary)
  values (v_ticket_id, v_conversation_id, p_reason, p_summary);

  insert into public.automation_runs (
    ticket_id, conversation_id, actor_id, idempotency_key, action_type, status, result_summary
  ) values (
    v_ticket_id, v_conversation_id, p_requester_id, p_idempotency_key,
    'escalate_to_human', 'success', 'Escalation queued'
  );

  return jsonb_build_object(
    'ticketId', v_ticket_id, 'status', v_status, 'queue', v_queue
  );
end;
$$;

create or replace function public.record_test_notification(
  p_requester_id uuid,
  p_channel text,
  p_message text,
  p_ticket_id uuid,
  p_conversation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_status text;
  v_action_type text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_requester_id::text || ':' || p_idempotency_key, 0)
  );
  if p_channel <> 'simulation' then
    raise exception 'Only simulated notifications are supported' using errcode = '22023';
  end if;
  if p_ticket_id is null and p_conversation_id is null then
    raise exception 'A ticket or conversation is required' using errcode = '22023';
  end if;
  select id, status, action_type into v_run_id, v_status, v_action_type
  from public.automation_runs
  where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
  if v_run_id is not null then
    if v_action_type is distinct from 'send_test_notification' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
    return jsonb_build_object('runId', v_run_id, 'status', v_status);
  end if;
  if p_ticket_id is not null and not exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and (
        t.requester_id = p_requester_id
        or exists (
          select 1 from public.profiles p
          where p.id = p_requester_id and p.role in ('agent', 'admin')
        )
      )
  ) then
    raise exception 'Ticket does not belong to requester' using errcode = '22023';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        c.requester_id = p_requester_id
        or exists (
          select 1 from public.profiles p
          where p.id = p_requester_id and p.role in ('agent', 'admin')
        )
      )
  ) then
    raise exception 'Conversation does not belong to requester' using errcode = '22023';
  end if;

  insert into public.automation_runs (
    ticket_id, conversation_id, actor_id, idempotency_key, action_type, status, result_summary
  ) values (
    p_ticket_id, p_conversation_id, p_requester_id, p_idempotency_key,
    'send_test_notification', 'success',
    left('Simulated notification: ' || p_message, 500)
  )
  on conflict (actor_id, idempotency_key) do nothing
  returning id, status into v_run_id, v_status;

  if v_run_id is null then
    select id, status, action_type into v_run_id, v_status, v_action_type
    from public.automation_runs
    where actor_id = p_requester_id and idempotency_key = p_idempotency_key;
    if v_action_type is distinct from 'send_test_notification' then
      raise exception 'Idempotency key has already been used' using errcode = '23505';
    end if;
  end if;

  return jsonb_build_object('runId', v_run_id, 'status', v_status);
end;
$$;

revoke all on function public.create_helpdesk_ticket(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_helpdesk_escalation(uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.record_test_notification(uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_helpdesk_ticket(uuid, text, text, text, text, text, uuid) to service_role;
grant execute on function public.create_helpdesk_escalation(uuid, text, text, text, uuid, text) to service_role;
grant execute on function public.record_test_notification(uuid, text, text, uuid, uuid, text) to service_role;
