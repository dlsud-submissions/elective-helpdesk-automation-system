-- Seed data for Sprint 2 local development and regression testing.
-- Fictional content only; profile rows remain Supabase-auth managed in production.

insert into public.knowledge_articles (id, title, body, category, source_name, is_published, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Password reset after lockout',
   'To reset a locked account, verify the user identity in the directory, confirm the request came from the approved manager or the employee, and then issue a temporary password using the self-service reset flow. Require a password change on first sign-in and record the reset in the ticket log.',
   'account-access',
   'IT Security Handbook',
   true,
   now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'MFA reset procedures',
   'MFA reset requests should be reviewed against the current device registry. If the user has a new phone or lost the authenticator, confirm contact details, remove the blocked device in the admin console, and re-enroll the user after a documented verification step. Never skip verification for a recovery request.',
   'identity',
   'IT Operations Guide',
   true,
   now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'Laptop onboarding checklist',
   'New laptop setup includes joining the corporate domain, installing the approved security agent, enabling encryption, configuring email and VPN, and confirming the employee receives the device inventory record. Completion should be verified before the equipment is handed over to the user.',
   'device-support',
   'Endpoint Support SOP',
   true,
   now())
on conflict (id) do update
set title = excluded.title,
    body = excluded.body,
    category = excluded.category,
    source_name = excluded.source_name,
    is_published = excluded.is_published,
    updated_at = now();

-- Representative chunk rows for local RAG smoke testing.
-- The project uses the `knowledge_chunks` table with a 1536-dim vector column.
with article_data as (
  select id, body from public.knowledge_articles where title = 'Password reset after lockout'
)
insert into public.knowledge_chunks (article_id, chunk_text, embedding)
select
  ad.id,
  left(ad.body, 900),
  array_fill(0.1::double precision, ARRAY[1536])::vector
from article_data ad
on conflict do nothing;
