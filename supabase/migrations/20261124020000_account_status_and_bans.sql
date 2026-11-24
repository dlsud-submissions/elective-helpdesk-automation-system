-- Account suspension and permanent ban state.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'banned')),
  add column if not exists suspended_until timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_account_status_idx
  on public.profiles (account_status, suspended_until);
