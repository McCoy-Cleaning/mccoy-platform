begin;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1100000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aal1-staff@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('a2200000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aal2-staff@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c3300000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.users (id, account_kind, staff_role, status, email, full_name)
values
  ('a1100000-0000-4000-8000-000000000001', 'staff', 'admin', 'active', 'aal1-staff@example.test', 'AAL1 Staff'),
  ('a2200000-0000-4000-8000-000000000002', 'staff', 'admin', 'active', 'aal2-staff@example.test', 'AAL2 Staff'),
  ('c3300000-0000-4000-8000-000000000003', 'customer', null, 'active', 'customer@example.test', 'Customer');

insert into public.notifications (id, type, category, severity, title)
values
  ('d1100000-0000-4000-8000-000000000001', 'security.test', 'security', 'info', 'First'),
  ('d2200000-0000-4000-8000-000000000002', 'security.test', 'security', 'info', 'Second');

insert into public.notification_recipients (id, notification_id, user_id)
values
  ('e1100000-0000-4000-8000-000000000001', 'd1100000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001'),
  ('e2200000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000002', 'a2200000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (select count(*) from public.notification_recipients),
  0::bigint,
  'AAL1 staff cannot read notification recipient state'
);
select is(
  (select count(*) from public.notifications),
  0::bigint,
  'AAL1 staff cannot read notification payloads'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a2200000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (select count(*) from public.notification_recipients),
  1::bigint,
  'AAL2 active staff can read their own recipient state'
);
select is(
  (select count(*) from public.notification_recipients where user_id = 'a1100000-0000-4000-8000-000000000001'),
  0::bigint,
  'AAL2 staff cannot read another staff member recipient state'
);
select is(
  (select count(*) from public.notifications),
  1::bigint,
  'AAL2 active staff can read only notifications addressed to them'
);

update public.notification_recipients
set read_at = now()
where id = 'e1100000-0000-4000-8000-000000000001';

reset role;
select ok(
  (select read_at is null from public.notification_recipients where id = 'e1100000-0000-4000-8000-000000000001'),
  'RLS prevents AAL2 staff from updating another recipient row'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c3300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (select count(*) from public.notification_recipients),
  0::bigint,
  'AAL2 customer cannot read staff notification recipient state'
);
select is(
  (select count(*) from public.notifications),
  0::bigint,
  'AAL2 customer cannot read staff notifications'
);

select * from finish();
rollback;
