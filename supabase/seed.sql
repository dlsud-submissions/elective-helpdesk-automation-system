-- Seed data for development and regression testing. Fictional content only.
-- Linked dev project: `npm run supabase:seed` (after `npm run supabase:push`).
-- Local stack: run `npm run supabase:reset:local` for migrations, then
-- `npm run supabase:seed:local` to seed without resetting.
-- Idempotent: safe to run more than once.
-- It creates sign-in accounts with a known password, so only run it against a
-- development project, never production.

-- Fail fast with a clear message when the target is missing migrations.
do $$
declare
  missing text;
begin
  select string_agg(name, ', ') into missing
  from (
    values
      ('public.tickets', to_regclass('public.tickets') is not null),
      ('public.conversations', to_regclass('public.conversations') is not null),
      ('public.messages', to_regclass('public.messages') is not null),
      ('public.audit_logs', to_regclass('public.audit_logs') is not null),
      ('public.automation_runs', to_regclass('public.automation_runs') is not null),
      ('public.ticket_escalations', to_regclass('public.ticket_escalations') is not null),
      ('public.ticket_solution_drafts', to_regclass('public.ticket_solution_drafts') is not null),
      ('profiles.account_status', exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'account_status')),
      ('knowledge_chunks.chunk_ordinal', exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'knowledge_chunks'
          and column_name = 'chunk_ordinal'))
  ) as required(name, present)
  where not present;

  if missing is not null then
    raise exception 'Seed aborted: migrations are not applied (missing %). Run `npm run supabase:push` first, then re-run the seed.', missing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fictional accounts (password for all: Password123!)
--   dana.cruz@example.test  employee
--   lee.agent@example.test  agent
--   ari.admin@example.test  admin
--   elena.cho@example.test  employee
--   omar.ali@example.test   employee
--   jo.kim@example.test     agent
--   priya.shah@example.test suspended fixture
--   noah.lee@example.test   banned fixture
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
    now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'elena.cho@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Elena Cho"}',
    now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'omar.ali@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Omar Ali"}',
    now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'jo.kim@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Jo Kim"}',
    now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'priya.shah@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Priya Shah"}',
    now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888',
    'authenticated', 'authenticated', 'noah.lee@example.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Noah Lee"}',
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
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888'
)
on conflict do nothing;

-- Profiles are created by the on_auth_user_created trigger with role
-- 'employee'. Promote the staff accounts here (server-side seed only).
update public.profiles set role = 'agent'
where id in (
  '22222222-2222-4222-8222-222222222222',
  '66666666-6666-4666-8666-666666666666'
);

update public.profiles set role = 'admin'
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles
set account_status = 'suspended',
    suspended_until = now() + interval '7 days',
    ban_reason = null
where id = '77777777-7777-4777-8777-777777777777';

update public.profiles
set account_status = 'banned',
    suspended_until = null,
    ban_reason = 'Seed fixture account for admin status workflows.'
where id = '88888888-8888-4888-8888-888888888888';

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
    now()),
    ('10000000-0000-4000-8000-000000000001',
    'Office Wi-Fi reconnect checklist',
    'Confirm the device is connected to the approved office network, toggle Wi-Fi off and on, and reconnect using the managed profile. If multiple nearby users are affected, record the location and time in a ticket for network support.',
    'network',
    'Harbor Network Guide',
    true,
    now()),
    ('10000000-0000-4000-8000-000000000002',
    'Printer queue troubleshooting',
    'Check that the printer is powered on and reachable, then clear only the affected user job from the local queue and retry once. If several users see the same issue, capture the printer name and contact workplace support.',
    'hardware',
    'Workplace Support SOP',
    true,
    now()),
    ('10000000-0000-4000-8000-000000000003',
    'Meeting room display input check',
    'Confirm the display is powered on and set to the input used by the room cable or wireless presentation device. Reconnect the cable once. If the display remains blank, report the room name and panel status to workplace support.',
    'hardware',
    'Meeting Room Guide',
    true,
    now()),
    ('10000000-0000-4000-8000-000000000004',
    'Docking station display check',
    'Confirm the dock power light is on, reconnect the display cable, and check the operating system display settings for a detected monitor. Record the dock model and monitor connection type if the display remains unavailable.',
    'hardware',
    'Endpoint Support SOP',
    true,
    now()),
    ('10000000-0000-4000-8000-000000000005',
    'VPN client reconnect steps',
    'Confirm the device has a working internet connection, disconnect the managed VPN profile, and reconnect once. If the connection continues to fail, note the client version and approximate failure time in a helpdesk ticket.',
    'network',
    'Remote Access Guide',
    true,
    now()),
    ('10000000-0000-4000-8000-000000000006',
    'Draft device loan workflow',
    'Draft only: confirm inventory availability, obtain manager approval, and record the expected return date before issuing a temporary device.',
    'device-support',
    'Draft Support Article',
    false,
    now())
on conflict (id) do update
set title = excluded.title,
    body = excluded.body,
    category = excluded.category,
    source_name = excluded.source_name,
    is_published = excluded.is_published,
    updated_at = now();

-- Small fixture vectors keep local smoke tests deterministic. They are not
-- semantic embeddings; real vectors are produced by the knowledge ingest task.
insert into public.knowledge_chunks (article_id, chunk_ordinal, chunk_text, embedding)
select
  a.id,
  0,
  left(a.body, 900),
  array_fill(0.1::real, array[1536])::extensions.vector(1536)
from public.knowledge_articles a
where a.id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005'
)
on conflict (article_id, chunk_ordinal) do nothing;

-- ---------------------------------------------------------------------------
-- Conversations, messages, and tickets
-- ---------------------------------------------------------------------------

insert into public.conversations (
  id, requester_id, title, created_at, updated_at, archived_at
)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'VPN drops on home network', now() - interval '30 minutes', now() - interval '25 minutes', null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd02', '44444444-4444-4444-8444-444444444444',
   'Printer queue stays offline', now() - interval '4 days', now() - interval '3 days', null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd03', '55555555-5555-4555-8555-555555555555',
   'Meeting room display is blank', now() - interval '3 days', now() - interval '2 days', null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd04', '77777777-7777-4777-8777-777777777777',
   'MFA device replacement', now() - interval '2 days', now() - interval '2 days', null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd05', '88888888-8888-4888-8888-888888888888',
   'Dock does not detect monitors', now() - interval '1 day', now() - interval '12 hours', null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd06', '11111111-1111-4111-8111-111111111111',
   'VPN setup notes', now() - interval '30 days', now() - interval '28 days', now() - interval '28 days')
on conflict (id) do nothing;

insert into public.messages (id, conversation_id, sender_type, content, outcome, source_refs, created_at)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'user', 'My VPN keeps disconnecting every 10 to 15 minutes on my home Wi-Fi.',
   null, '[]', now() - interval '30 minutes'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'assistant', 'I could not find enough approved internal guidance to answer that request safely. You can create a ticket or talk to a person.',
    'escalation_suggested', '[]', now() - interval '29 minutes'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
    'user', 'The printer on level 2 stays offline after I submit a job.', null, '[]', now() - interval '4 days'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
    'assistant', 'Check the printer power and clear only your stuck job before retrying once. Contact support if other users are affected.',
    'answered', '[{"articleId":"10000000-0000-4000-8000-000000000002","title":"Printer queue troubleshooting","sourceName":"Workplace Support SOP","excerpt":"Check that the printer is powered on and reachable, then clear only the affected user job from the local queue and retry once.","relevance":0.81}]', now() - interval '4 days' + interval '1 minute'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
    'user', 'The meeting room display is blank before a presentation.', null, '[]', now() - interval '3 days'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
    'assistant', 'Check the panel power and selected input, then reconnect the room cable once.',
    'answered', '[{"articleId":"10000000-0000-4000-8000-000000000003","title":"Meeting room display input check","sourceName":"Meeting Room Guide","excerpt":"Confirm the display is powered on and set to the input used by the room cable or wireless presentation device.","relevance":0.76}]', now() - interval '3 days' + interval '1 minute'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07', 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
    'user', 'I replaced my phone and cannot approve the MFA prompt.', null, '[]', now() - interval '2 days'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08', 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
    'assistant', 'The recovery process requires identity verification and a review of the registered device before re-enrollment.',
    'answered', '[{"articleId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","title":"MFA reset procedures","sourceName":"IT Operations Guide","excerpt":"MFA reset requests should be reviewed against the current device registry. Never skip verification for a recovery request.","relevance":0.91}]', now() - interval '2 days' + interval '1 minute'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee09', 'dddddddd-dddd-4ddd-8ddd-dddddddddd05',
    'user', 'My dock powers the laptop but does not detect either external monitor.', null, '[]', now() - interval '1 day'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd05',
    'agent', 'I have assigned this to endpoint support. Please include the dock model and monitor connection type.',
    null, '[]', now() - interval '23 hours'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11', 'dddddddd-dddd-4ddd-8ddd-dddddddddd06',
    'user', 'How do I reconnect the managed VPN profile?', null, '[]', now() - interval '30 days'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12', 'dddddddd-dddd-4ddd-8ddd-dddddddddd06',
    'assistant', 'Confirm internet access, disconnect the managed profile, and reconnect once. Record the client version if it fails again.',
    'answered', '[{"articleId":"10000000-0000-4000-8000-000000000005","title":"VPN client reconnect steps","sourceName":"Remote Access Guide","excerpt":"Confirm the device has a working internet connection, disconnect the managed VPN profile, and reconnect once.","relevance":0.87}]', now() - interval '30 days' + interval '1 minute')
on conflict (id) do nothing;

insert into public.tickets (
  id, requester_id, title, description, category, priority, status,
  assigned_to, is_escalated, conversation_id, escalation_summary, idempotency_key, created_at
)
values
  ('ffffffff-ffff-4fff-8fff-ffffffff0001', '11111111-1111-4111-8111-111111111111',
   'VPN drops on home network',
   'VPN disconnects every 10 to 15 minutes on home Wi-Fi. Router restart did not help.',
   'network', 'high', 'open', null, true,
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'Reason: user requested agent. Symptoms: VPN disconnects every 10-15 minutes on home Wi-Fi. Tried: reconnecting and restarting the router. Missing: VPN client version.',
  'seed-escalation-vpn', now() - interval '25 minutes'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0002', '11111111-1111-4111-8111-111111111111',
   'Wi-Fi disconnects in meeting room 3',
   'Laptop loses the office Wi-Fi connection in meeting room 3 several times a day.',
   'network', 'medium', 'in_progress', '22222222-2222-4222-8222-222222222222', false,
  null, null, 'seed-create-wifi', now() - interval '2 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0003', '11111111-1111-4111-8111-111111111111',
   'Request for second monitor',
   'Requesting a second monitor for the finance analyst desk.',
   'hardware', 'low', 'resolved', '22222222-2222-4222-8222-222222222222', false,
   null, null, null, now() - interval '5 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0004', '44444444-4444-4444-8444-444444444444',
   'Printer queue stays offline',
   'Printer on level 2 remains offline after a user clears and retries a stuck job.',
   'hardware', 'low', 'new', null, false,
   'dddddddd-dddd-4ddd-8ddd-dddddddddd02', null, null, now() - interval '4 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0005', '55555555-5555-4555-8555-555555555555',
   'Meeting room display is blank',
   'The room display remains blank after checking power and the selected input.',
   'hardware', 'medium', 'pending', '66666666-6666-4666-8666-666666666666', false,
   'dddddddd-dddd-4ddd-8ddd-dddddddddd03', null, null, now() - interval '3 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0006', '77777777-7777-4777-8777-777777777777',
   'MFA device replacement review',
   'A replacement authenticator requires the documented identity verification and device review.',
   'account', 'urgent', 'open', '22222222-2222-4222-8222-222222222222', true,
   'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
   'Reason: policy gap. The requester replaced a phone and needs an approved recovery review.',
   'seed-escalation-account', now() - interval '2 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0007', '88888888-8888-4888-8888-888888888888',
   'Dock does not detect monitors',
   'The laptop receives power from the dock but does not detect external monitors.',
   'hardware', 'medium', 'in_progress', '66666666-6666-4666-8666-666666666666', false,
   'dddddddd-dddd-4ddd-8ddd-dddddddddd05', null, null, now() - interval '1 day'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0008', '44444444-4444-4444-8444-444444444444',
   'Approved design software request',
   'A team member needs the approved design application added to a managed workstation.',
   'software', 'low', 'closed', '22222222-2222-4222-8222-222222222222', false,
   null, null, null, now() - interval '8 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0009', '55555555-5555-4555-8555-555555555555',
   'Account access restored',
   'The employee completed the approved account recovery process and confirmed sign-in.',
   'account', 'medium', 'resolved', '66666666-6666-4666-8666-666666666666', false,
   null, null, null, now() - interval '6 days')
on conflict (id) do update
set idempotency_key = excluded.idempotency_key
where tickets.idempotency_key is null
  and excluded.idempotency_key is not null;

insert into public.ticket_escalations (
  ticket_id, conversation_id, reason, summary, queue
)
values
  ('ffffffff-ffff-4fff-8fff-ffffffff0001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'user_requested_agent',
   'VPN disconnects every 10 to 15 minutes on home Wi-Fi after reconnect and router restart.',
   'IT-agents'),
  ('ffffffff-ffff-4fff-8fff-ffffffff0006', 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
   'policy_gap',
   'The employee replaced a phone and needs an agent to complete the approved identity and device review.',
   'IT-agents')
on conflict (ticket_id) do nothing;

insert into public.automation_runs (
  id, ticket_id, conversation_id, actor_id, idempotency_key,
  action_type, status, result_summary, error_code, created_at
)
values
  ('20000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffff0001',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111',
   'seed-escalation-vpn', 'escalate_to_human', 'succeeded',
   'Escalation placed in the IT-agents queue.', null, now() - interval '25 minutes'),
  ('20000000-0000-4000-8000-000000000002', 'ffffffff-ffff-4fff-8fff-ffffffff0002',
   null, '11111111-1111-4111-8111-111111111111',
   'seed-create-wifi', 'create_ticket', 'succeeded',
   'Ticket created from the employee ticket workflow.', null, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000003', 'ffffffff-ffff-4fff-8fff-ffffffff0006',
   'dddddddd-dddd-4ddd-8ddd-dddddddddd04', '77777777-7777-4777-8777-777777777777',
   'seed-escalation-account', 'escalate_to_human', 'succeeded',
   'Account recovery review placed in the IT-agents queue.', null, now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000004', 'ffffffff-ffff-4fff-8fff-ffffffff0007',
   'dddddddd-dddd-4ddd-8ddd-dddddddddd05', '66666666-6666-4666-8666-666666666666',
   'seed-notification-dock', 'send_test_notification', 'succeeded',
   'Simulated ticket notification recorded for the endpoint queue.', null, now() - interval '23 hours'),
  ('20000000-0000-4000-8000-000000000005', 'ffffffff-ffff-4fff-8fff-ffffffff0008',
   null, '22222222-2222-4222-8222-222222222222',
   'seed-notification-disabled', 'send_test_notification', 'failed',
   'Simulation was disabled; no external notification was sent.', 'simulation_disabled', now() - interval '8 days')
on conflict (actor_id, idempotency_key) do nothing;

-- These are clearly marked fixture drafts, not output generated by Gemini.
insert into public.ticket_solution_drafts (
  id, ticket_id, generated_by, content, model, created_at
)
values
  ('30000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffff0002',
   '22222222-2222-4222-8222-222222222222',
   'Fixture draft: confirm the affected room and printer name, then verify the device is powered and reachable. If several users are affected, route the issue to workplace support.',
   'seed-fixture', now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000002', 'ffffffff-ffff-4fff-8fff-ffffffff0005',
   '66666666-6666-4666-8666-666666666666',
   'Fixture draft: confirm the selected display input and test the room cable once. If the panel remains blank, record the room name and arrange an endpoint check.',
   'seed-fixture', now() - interval '3 days'),
  ('30000000-0000-4000-8000-000000000003', 'ffffffff-ffff-4fff-8fff-ffffffff0007',
   '66666666-6666-4666-8666-666666666666',
   'Fixture draft: record the dock model and monitor connection type, reconnect the display cable, and check whether the operating system detects either monitor.',
   'seed-fixture', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.audit_logs (id, actor_id, action, resource_type, resource_id, outcome, summary)
values
  ('99999999-9999-4999-8999-999999999901', '11111111-1111-4111-8111-111111111111',
   'ticket.agent_reply', 'ticket', 'ffffffff-ffff-4fff-8fff-ffffffff0002', 'success',
   'Agent shared the printer troubleshooting steps.'),
  ('99999999-9999-4999-8999-999999999902', '22222222-2222-4222-8222-222222222222',
   'ticket.status_changed', 'ticket', 'ffffffff-ffff-4fff-8fff-ffffffff0003', 'success',
   'Ticket marked resolved after the monitor request was completed.'),
  ('99999999-9999-4999-8999-999999999903', '66666666-6666-4666-8666-666666666666',
   'ticket.gemini_draft_saved', 'ticket', 'ffffffff-ffff-4fff-8fff-ffffffff0007', 'success',
   'Fixture solution draft saved for the dock troubleshooting ticket.'),
  ('99999999-9999-4999-8999-999999999904', '11111111-1111-4111-8111-111111111111',
   'conversation.archived', 'conversation', 'dddddddd-dddd-4ddd-8ddd-dddddddddd06', 'success',
   'Employee archived the completed VPN setup conversation.'),
  ('99999999-9999-4999-8999-999999999905', '33333333-3333-4333-8333-333333333333',
   'profile.account_suspended', 'profile', '77777777-7777-4777-8777-777777777777', 'success',
   'Seed fixture account suspended for admin status workflows.'),
  ('99999999-9999-4999-8999-999999999906', '33333333-3333-4333-8333-333333333333',
   'profile.account_banned', 'profile', '88888888-8888-4888-8888-888888888888', 'success',
   'Seed fixture account banned for admin status workflows.')
on conflict (id) do nothing;
