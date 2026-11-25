alter table public.tickets
  add column is_open boolean not null default true;

alter table public.tickets
  alter column status set default 'pending';

update public.tickets
set
  is_open = status not in ('resolved', 'closed'),
  status = case
    when status = 'in_progress' then 'in_progress'
    when status = 'pending' then 'pending'
    when status in ('resolved', 'closed') then 'resolved'
    else 'pending'
  end;

alter table public.tickets
  drop constraint if exists tickets_status_check;

alter table public.tickets
  add constraint tickets_status_check
  check (status in ('pending', 'in_progress', 'resolved'));

create index tickets_is_open_idx on public.tickets (is_open);

create or replace function public.normalize_legacy_ticket_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('new', 'open') then
    new.status = 'pending';
  elsif new.status = 'closed' then
    new.status = 'resolved';
    new.is_open = false;
  elsif tg_op = 'INSERT' and new.status = 'resolved' then
    new.is_open = false;
  end if;
  return new;
end;
$$;

create trigger tickets_normalize_legacy_status
  before insert or update of status on public.tickets
  for each row execute function public.normalize_legacy_ticket_status();

create or replace function public.set_ticket_resolved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' and new.resolved_at is null then
    new.resolved_at = now();
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;
