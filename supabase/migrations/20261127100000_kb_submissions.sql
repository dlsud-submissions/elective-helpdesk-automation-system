create table public.kb_submissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete restrict,
  agent_name text not null,
  ticket_id uuid references public.tickets(id) on delete set null,
  ticket_reference text,
  input text not null check (char_length(input) between 1 and 5000),
  solution text not null check (char_length(solution) between 1 and 8000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'denied')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kb_submissions_created_at_idx
  on public.kb_submissions (created_at desc);
create index kb_submissions_status_created_at_idx
  on public.kb_submissions (status, created_at desc);

create trigger kb_submissions_set_updated_at
  before update on public.kb_submissions
  for each row execute function public.set_updated_at();

alter table public.kb_submissions enable row level security;
revoke all on public.kb_submissions from anon, authenticated;
grant select, insert, update on public.kb_submissions to service_role;
