-- Seed data for local development and regression testing.
-- Fictional content only. Run with `npm run supabase:reset:local`.
-- Never run this seed against a shared or production project: it creates
-- sign-in accounts with a known password.

-- ---------------------------------------------------------------------------
-- Fictional accounts (password for all: Password123!)
--   dana.cruz@example.test  employee
--   lee.agent@example.test  agent
--   ari.admin@example.test  admin
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'dana.cruz@example.test',
   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Dana Cruz"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'lee.agent@example.test',
   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Lee Santos"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'ari.admin@example.test',
   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Ari Reyes"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id, u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
)
on conflict do nothing;

-- Profiles are created by the on_auth_user_created trigger with role
-- 'employee'. Promote the staff accounts here (server-side seed only).
update public.profiles set role = 'agent'
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

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

-- Representative chunk row for local RAG smoke testing. Real embeddings are
-- produced by `npm run knowledge:ingest --workspace @elective-helpdesk/server`.
insert into public.knowledge_chunks (article_id, chunk_ordinal, chunk_text, embedding)
select
  a.id,
  0,
  left(a.body, 900),
  array_fill(0.1::real, array[1536])::extensions.vector(1536)
from public.knowledge_articles a
where a.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
on conflict (article_id, chunk_ordinal) do nothing;

-- ---------------------------------------------------------------------------
-- Conversations, messages, and tickets
-- ---------------------------------------------------------------------------

insert into public.conversations (id, requester_id, title, created_at, updated_at)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'VPN drops on home network', now() - interval '30 minutes', now() - interval '25 minutes')
on conflict (id) do nothing;

insert into public.messages (id, conversation_id, sender_type, content, outcome, source_refs, created_at)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'user', 'My VPN keeps disconnecting every 10 to 15 minutes on my home Wi-Fi.',
   null, '[]', now() - interval '30 minutes'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'assistant', 'I could not find enough approved internal guidance to answer that request safely. You can create a ticket or talk to a person.',
   'escalation_suggested', '[]', now() - interval '29 minutes')
on conflict (id) do nothing;

insert into public.tickets (
  id, requester_id, title, description, category, priority, status,
  assigned_to, is_escalated, conversation_id, escalation_summary, created_at
)
values
  ('ffffffff-ffff-4fff-8fff-ffffffff0001', '11111111-1111-4111-8111-111111111111',
   'VPN drops on home network',
   'VPN disconnects every 10 to 15 minutes on home Wi-Fi. Router restart did not help.',
   'network', 'high', 'open', null, true,
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'Reason: user requested agent. Symptoms: VPN disconnects every 10-15 minutes on home Wi-Fi. Tried: reconnecting and restarting the router. Missing: VPN client version.',
   now() - interval '25 minutes'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0002', '11111111-1111-4111-8111-111111111111',
   'Wi-Fi disconnects in meeting room 3',
   'Laptop loses the office Wi-Fi connection in meeting room 3 several times a day.',
   'network', 'medium', 'in_progress', '22222222-2222-4222-8222-222222222222', false,
   null, null, now() - interval '2 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0003', '11111111-1111-4111-8111-111111111111',
   'Request for second monitor',
   'Requesting a second monitor for the finance analyst desk.',
   'hardware', 'low', 'resolved', '22222222-2222-4222-8222-222222222222', false,
   null, null, now() - interval '5 days')
on conflict (id) do nothing;

insert into public.audit_logs (id, actor_id, action, resource_type, resource_id, outcome, summary)
values
  ('99999999-9999-4999-8999-999999999901', '11111111-1111-4111-8111-111111111111',
   'ticket.created', 'ticket', 'ffffffff-ffff-4fff-8fff-ffffffff0001', 'success',
   'Ticket created from chat escalation.')
on conflict (id) do nothing;
