alter table public.conversations
  add column unread_employee boolean not null default false,
  add column unread_agent boolean not null default false;

create or replace function public.set_conversation_unread_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sender_type in ('user', 'system') then
    update public.conversations
    set unread_agent = true, updated_at = new.created_at
    where id = new.conversation_id;
  elsif new.sender_type = 'agent' then
    update public.conversations
    set unread_employee = true, updated_at = new.created_at
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger messages_set_conversation_unread_state
  after insert on public.messages
  for each row execute function public.set_conversation_unread_state();
