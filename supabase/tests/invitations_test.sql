-- pgTAP-tests voor het uitnodigingensysteem (activatiecode + optioneel Google, geen e-mailverkeer).
-- Draai met: supabase test db supabase/tests

create extension if not exists pgtap;

begin;

select plan(24);

-- ===== Testhulpmiddelen (zelfde patroon als supabase/tests/roles_test.sql) =====
create temp table kv (k text primary key, v text);

create or replace function kv_set(p_k text, p_v text) returns void
language sql security definer as $$
  insert into kv (k, v) values (p_k, p_v)
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function kv(p_k text) returns text
language sql security definer as $$ select v from kv where k = p_k $$;

create or replace function test_lookup_id(p_email text) returns uuid
language sql security definer set search_path = public as $$
  select id from profiles where email = p_email;
$$;

create or replace function test_as(p_email text, p_aal text default 'aal1') returns void
language plpgsql as $$
declare v_id uuid;
begin
  v_id := test_lookup_id(p_email);
  if v_id is null then
    raise exception 'onbekend testaccount: %', p_email;
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
  set local role authenticated;
end $$;

create or replace function test_as_anon() returns void
language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function test_as_postgres() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function test_as_service_role() returns void
language plpgsql as $$
begin
  set local role service_role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function test_restricted(p_sql text) returns text
language plpgsql as $$
declare v_count int;
begin
  execute format('select count(*) from (%s) s', p_sql) into v_count;
  if v_count = 0 then return 'empty'; else return 'leaked:' || v_count; end if;
exception when others then
  return 'error:' || sqlstate;
end $$;

-- Maakt direct een auth.users-rij aan (zoals supabase/seed.sql ook doet), zodat de echte
-- before_new_user/handle_new_user-triggers lopen.
create or replace function test_signup(p_email text, p_provider text, p_code text default null)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    case when p_provider = 'email'
      then extensions.crypt('test-wachtwoord', extensions.gen_salt('bf')) else null end,
    now(),
    jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)),
    case when p_code is null then '{}'::jsonb else jsonb_build_object('activation_code', p_code) end,
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email), p_provider, now(), now(), now()
  );
  return v_id;
end $$;

-- ============================================================
-- new_activation_code(): precies 8 cijfers
-- ============================================================
select ok(new_activation_code() ~ '^[0-9]{8}$', 'new_activation_code() geeft precies 8 cijfers');

-- ============================================================
-- Als beheerder (admin@my.nyenrode.nl, uit seed.sql) met MFA
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;

do $$
declare v_code text;
begin
  select admin_create_invitation('student1@my.nyenrode.nl', 'activate') into v_code;
  perform kv_set('code1', v_code);
end $$;

select ok(kv('code1') ~ '^[0-9]{8}$', 'admin_create_invitation geeft een 8-cijferige code terug');
select isnt(
  (select code_hash from invitations where email = 'student1@my.nyenrode.nl'), kv('code1'),
  'de opgeslagen hash is niet de platte code'
);

-- ============================================================
-- Juiste code + e-mail: account met 1.000 punten, uitnodiging wordt gebruikt
-- ============================================================
do $$ begin perform test_as_postgres(); end $$;

do $$
declare v_id uuid;
begin
  v_id := test_signup('student1@my.nyenrode.nl', 'email', kv('code1'));
  perform kv_set('student1_id', v_id::text);
end $$;

select is(
  (select balance::int from profiles where id = kv('student1_id')::uuid), 1000,
  'juiste code + e-mail maakt een account met 1.000 punten'
);
select ok(
  (select used_at is not null from invitations where email = 'student1@my.nyenrode.nl'),
  'de uitnodiging is na gebruik gemarkeerd als gebruikt'
);
select is(
  (select raw_user_meta_data ? 'activation_code' from auth.users where id = kv('student1_id')::uuid), false,
  'activation_code staat na het aanmaken niet meer in raw_user_meta_data'
);

-- ============================================================
-- Foute / verlopen / gebruikte / ingetrokken code worden alle vier geweigerd (via check_invitation,
-- de RPC die ook anon mag aanroepen)
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$
declare v_code text;
begin
  select admin_create_invitation('student2@my.nyenrode.nl', 'activate') into v_code;
  perform kv_set('code2', v_code);
  select admin_create_invitation('student3@my.nyenrode.nl', 'activate') into v_code;
  perform kv_set('code3', v_code);
end $$;

do $$ begin perform test_as_postgres(); end $$;
update invitations set expires_at = now() - interval '1 minute' where email = 'student2@my.nyenrode.nl';

do $$ begin perform test_as_anon(); end $$;
select is(
  check_invitation('student3@my.nyenrode.nl',
    lpad(((kv('code3')::bigint + 1) % 100000000)::text, 8, '0'), 'activate'),
  false, 'een foute code wordt geweigerd'
);
select is(
  check_invitation('student2@my.nyenrode.nl', kv('code2'), 'activate'), false,
  'een verlopen code wordt geweigerd, ook als hij verder klopt'
);
select is(
  check_invitation('student1@my.nyenrode.nl', '00000000', 'activate'), false,
  'een al gebruikte uitnodiging wordt geweigerd'
);

do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$
declare v_id uuid;
begin
  select id into v_id from invitations where email = 'student3@my.nyenrode.nl';
  perform admin_revoke_invitation(v_id);
end $$;
do $$ begin perform test_as_anon(); end $$;
select is(
  check_invitation('student3@my.nyenrode.nl', kv('code3'), 'activate'), false,
  'een ingetrokken uitnodiging wordt geweigerd, ook met de juiste code'
);

-- ============================================================
-- Na 5 foute pogingen werkt ook de juiste code niet meer
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$
declare v_code text;
begin
  select admin_create_invitation('student4@my.nyenrode.nl', 'activate') into v_code;
  perform kv_set('code4', v_code);
end $$;

do $$ begin perform test_as_anon(); end $$;
do $$
declare i int; v_wrong text;
begin
  v_wrong := lpad(((kv('code4')::bigint + 1) % 100000000)::text, 8, '0');
  for i in 1..5 loop
    perform check_invitation('student4@my.nyenrode.nl', v_wrong, 'activate');
  end loop;
end $$;
select is(
  check_invitation('student4@my.nyenrode.nl', kv('code4'), 'activate'), false,
  'na 5 foute pogingen werkt ook de juiste code niet meer'
);

-- ============================================================
-- Google: wel met uitnodiging (geen code nodig), niet zonder uitnodiging
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$ begin perform admin_create_invitation('student5@my.nyenrode.nl', 'activate'); end $$;

do $$ begin perform test_as_postgres(); end $$;
do $$
declare v_id uuid;
begin
  v_id := test_signup('student5@my.nyenrode.nl', 'google');
  perform kv_set('student5_id', v_id::text);
end $$;
select ok(
  kv('student5_id') is not null,
  'een Google-gebruiker met een uitnodiging krijgt zonder code een account'
);

select throws_ok(
  $sql$ select test_signup('student6@my.nyenrode.nl', 'google') $sql$,
  'P0001', 'NO_INVITATION', 'een Google-gebruiker zonder uitnodiging wordt geweigerd'
);

-- ============================================================
-- E-mail/wachtwoord zonder activation_code wordt geweigerd
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$ begin perform admin_create_invitation('student7@my.nyenrode.nl', 'activate'); end $$;
do $$ begin perform test_as_postgres(); end $$;
select throws_ok(
  $sql$ select test_signup('student7@my.nyenrode.nl', 'email', null) $sql$,
  'P0001', 'INVALID_CODE', 'e-mail/wachtwoord zonder activatiecode wordt geweigerd'
);

-- ============================================================
-- app_config.admin_email wordt automatisch admin (mét uitnodiging); een tweede is onmogelijk
-- ============================================================
do $$ begin perform test_as_postgres(); end $$;
-- Demoteer de seed-beheerder zodat er precies 0 beheerders zijn (nodig om de unieke index
-- hieronder zinvol te kunnen testen) — dit raakt alleen deze testtransactie, die aan het einde
-- wordt teruggedraaid.
update profiles set role = 'student' where email = 'admin@my.nyenrode.nl';
insert into app_config (key, value) values ('admin_email', 'test-admin@voorbeeld.nl');
insert into invitations (email, purpose, code_hash, expires_at)
values ('test-admin@voorbeeld.nl', 'activate', extensions.crypt('87654321', extensions.gen_salt('bf')),
        now() + interval '2 days');

do $$
declare v_id uuid;
begin
  v_id := test_signup('test-admin@voorbeeld.nl', 'email', '87654321');
  perform kv_set('newadmin_id', v_id::text);
end $$;
select is(
  (select role::text from profiles where id = kv('newadmin_id')::uuid), 'admin',
  'het e-mailadres uit app_config.admin_email wordt automatisch admin, mét geldige uitnodiging'
);
select is(
  (select balance::int from profiles where id = kv('newadmin_id')::uuid), 0,
  'de nieuwe beheerder krijgt geen 1.000 speelpunten'
);

update app_config set value = 'test-admin-2@voorbeeld.nl' where key = 'admin_email';
insert into invitations (email, purpose, code_hash, expires_at)
values ('test-admin-2@voorbeeld.nl', 'activate', extensions.crypt('11223344', extensions.gen_salt('bf')),
        now() + interval '2 days');
select throws_ok(
  $sql$ select test_signup('test-admin-2@voorbeeld.nl', 'email', '11223344') $sql$,
  '23505', null, 'een tweede beheerder aanwijzen faalt op de unieke index (precies één admin)'
);

-- Herstel de seed-beheerder weer als enige admin voor de rest van dit testbestand.
do $$ begin perform test_as_postgres(); end $$;
update profiles set role = 'student' where email = 'test-admin@voorbeeld.nl';
update profiles set role = 'admin' where email = 'admin@my.nyenrode.nl';

-- ============================================================
-- Beveiliging rondom de RPC's zelf
-- ============================================================
do $$ begin perform test_as_anon(); end $$;
select ok(
  (select r in ('empty') or r like 'error:%' from (select test_restricted('select * from invitations') as r) s),
  'anon kan invitations niet (zinvol) lezen: 0 rijen of een fout'
);
select ok(
  (select r in ('empty') or r like 'error:%' from (select test_restricted('select * from app_config') as r) s),
  'anon kan app_config niet (zinvol) lezen: 0 rijen of een fout'
);

do $$ begin perform test_as('student1@my.nyenrode.nl'); end $$;
select throws_ok(
  format('select admin_create_invitation(%L, ''activate'')', 'iemand@my.nyenrode.nl'),
  'P0001', 'Geen toegang', 'een speler kan admin_create_invitation niet aanroepen'
);
select throws_ok(
  'select * from admin_list_invitations()',
  'P0001', 'Geen toegang', 'een speler kan admin_list_invitations niet aanroepen'
);

-- consume_reset_code: alleen uitvoerbaar als service_role
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$
declare v_code text;
begin
  select admin_create_invitation('student1@my.nyenrode.nl', 'reset') into v_code;
  perform kv_set('resetcode1', v_code);
end $$;

do $$ begin perform test_as('student1@my.nyenrode.nl'); end $$;
select throws_ok(
  format('select consume_reset_code(%L, %L)', 'student1@my.nyenrode.nl', kv('resetcode1')),
  '42501', 'permission denied for function consume_reset_code',
  'consume_reset_code is niet uitvoerbaar voor een ingelogde gebruiker zelf'
);

do $$ begin perform test_as_anon(); end $$;
select throws_ok(
  format('select consume_reset_code(%L, %L)', 'student1@my.nyenrode.nl', kv('resetcode1')),
  '42501', 'permission denied for function consume_reset_code',
  'consume_reset_code is niet uitvoerbaar voor anon'
);

do $$ begin perform test_as_service_role(); end $$;
do $$
declare v_id uuid;
begin
  select consume_reset_code('student1@my.nyenrode.nl', kv('resetcode1')) into v_id;
  perform kv_set('reset_result_id', v_id::text);
end $$;
select is(
  kv('reset_result_id'), kv('student1_id'),
  'consume_reset_code werkt voor service_role en geeft de juiste user-id terug'
);

select * from finish();

rollback;
