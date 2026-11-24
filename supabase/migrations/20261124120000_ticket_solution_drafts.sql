create table public.ticket_solution_drafts (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  generated_by uuid not null references public.profiles(id) on delete restrict,
  content text not null check (char_length(content) between 1 and 8000),
  model text not null check (char_length(model) between 1 and 120),
  created_at timestamptz not null default now()
);

create index ticket_solution_drafts_ticket_created_idx
  on public.ticket_solution_drafts (ticket_id, created_at desc);

alter table public.ticket_solution_drafts enable row level security;
revoke all on public.ticket_solution_drafts from anon, authenticated;
grant select, insert on public.ticket_solution_drafts to service_role;
