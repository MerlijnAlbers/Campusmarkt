-- pgTAP-tests voor de rollenhardening (speler vs. beheerder, strikt gescheiden).
-- Draai met: supabase test db supabase/tests

create extension if not exists pgtap;

begin;

select plan(36);

-- ===== Testhulpmiddelen =====
create temp table kv (k text primary key, v text);

create or replace function kv_set(p_k text, p_v text) returns void
language sql security definer as $$
  insert into kv (k, v) values (p_k, p_v)
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function kv(p_k text) returns text
language sql security definer as $$ select v from kv where k = p_k $$;

-- Opzoeken mag RLS omzeilen; de roluitgifte zelf mag dat niet zijn ("set role" is verboden
-- binnen een security-definer-functie).
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

-- Voert p_sql uit en meldt 'empty' (0 rijen) of 'error:<sqlstate>'; gebruikt waar de matrix
-- "0 rijen of een permission-fout" toestaat.
create or replace function test_restricted(p_sql text) returns text
language plpgsql as $$
declare v_count int;
begin
  execute format('select count(*) from (%s) s', p_sql) into v_count;
  if v_count = 0 then return 'empty'; else return 'leaked:' || v_count; end if;
exception when others then
  return 'error:' || sqlstate;
end $$;

-- ===== Fixture: een conceptmarkt (nooit geopend) =====
do $$
declare v_market uuid; v_a uuid;
begin
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: conceptmarkt (rollen)', 'test', 'test', 100, 'draft', now(), now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  perform kv_set('draft_market', v_market::text);
  perform kv_set('draft_outcome', v_a::text);
end $$;

-- ============================================================
-- Als speler (Sanne)
-- ============================================================
do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;

select is(
  (select count(*) from profiles)::int, 1,
  'select email from profiles geeft alleen de eigen rij terug'
);
select ok(
  (select email from profiles limit 1) = 'sanne@my.nyenrode.nl',
  'de enige zichtbare rij is de eigen rij (eigen e-mailadres)'
);

select is_empty('select * from markets where status = ''draft''', 'conceptmarkten zijn niet zichtbaar in markets');
select is_empty(
  format('select * from outcomes where market_id = %L', kv('draft_market')),
  'uitkomsten van een conceptmarkt zijn niet zichtbaar in outcomes'
);

select throws_ok(
  'update profiles set role = ''admin'' where id = auth.uid()',
  '42501', 'permission denied for table profiles',
  'een speler kan de eigen rol niet wijzigen'
);
select throws_ok(
  'update profiles set balance = 99999 where id = auth.uid()',
  '42501', 'permission denied for table profiles',
  'een speler kan het eigen saldo niet rechtstreeks wijzigen'
);

-- Elke beheerfunctie geeft "Geen toegang" aan een speler.
select throws_ok(
  format('select create_market(%L,%L,%L,%L,100,array[%L,%L],now(),now()+interval ''1 day'',false)',
    'x','x','x','x','A','B'),
  'P0001', 'Geen toegang', 'create_market: geen toegang voor een speler'
);
select throws_ok(
  format('select set_market_status(%L, ''open'')', kv('draft_market')),
  'P0001', 'Geen toegang', 'set_market_status: geen toegang voor een speler'
);
select throws_ok(
  format('select resolve_market(%L, %L)', kv('draft_market'), kv('draft_outcome')),
  'P0001', 'Geen toegang', 'resolve_market: geen toegang voor een speler'
);
select throws_ok(
  format('select cancel_market(%L)', kv('draft_market')),
  'P0001', 'Geen toegang', 'cancel_market: geen toegang voor een speler'
);
select throws_ok(
  format('select delete_market(%L)', kv('draft_market')),
  'P0001', 'Geen toegang', 'delete_market: geen toegang voor een speler'
);
select throws_ok(
  'select * from check_ledger()',
  'P0001', 'Geen toegang', 'check_ledger: geen toegang voor een speler'
);
select throws_ok(
  'select * from admin_list_users()',
  'P0001', 'Geen toegang', 'admin_list_users: geen toegang voor een speler'
);
select throws_ok(
  format('select admin_set_blocked(%L, true, ''test'')', kv('draft_outcome')),
  'P0001', 'Geen toegang', 'admin_set_blocked: geen toegang voor een speler'
);
select throws_ok(
  format('select admin_adjust_points(%L, 10, ''test correctie'')', kv('draft_outcome')),
  'P0001', 'Geen toegang', 'admin_adjust_points: geen toegang voor een speler'
);
select throws_ok(
  'select * from admin_list_actions(10)',
  'P0001', 'Geen toegang', 'admin_list_actions: geen toegang voor een speler'
);
select throws_ok(
  format('select admin_add_exclusion(%L, auth.uid(), ''test'')', kv('draft_market')),
  'P0001', 'Geen toegang', 'admin_add_exclusion: geen toegang voor een speler'
);
select throws_ok(
  format('select admin_remove_exclusion(%L, auth.uid())', kv('draft_market')),
  'P0001', 'Geen toegang', 'admin_remove_exclusion: geen toegang voor een speler'
);

select throws_ok(
  'select weekly_topup()', '42501', 'permission denied for function weekly_topup',
  'weekly_topup() geeft een permission-fout voor een speler'
);
select throws_ok(
  'select handle_new_user()', '42501', 'permission denied for function handle_new_user',
  'handle_new_user() geeft een permission-fout voor een speler'
);

select is_empty('select * from positions where user_id <> auth.uid()', 'positions toont alleen eigen rijen');
select is_empty('select * from trades where user_id <> auth.uid()', 'trades toont alleen eigen rijen');
select is_empty('select * from ledger_entries where user_id <> auth.uid()', 'ledger_entries toont alleen eigen rijen');
select is_empty('select * from admin_actions', 'admin_actions is onzichtbaar voor een speler');
select is_empty('select * from market_exclusions', 'market_exclusions is onzichtbaar voor een speler');

select throws_ok(
  'select user_id from get_leaderboard() limit 1',
  '42703', 'column "user_id" does not exist',
  'get_leaderboard() heeft geen user_id-kolom meer (gebruikt is_me)'
);
select throws_ok(
  'select user_id from get_public_trades() limit 1',
  '42703', 'column "user_id" does not exist',
  'get_public_trades() heeft geen user_id-kolom'
);

-- ============================================================
-- Als beheerder zonder MFA (aal1)
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal1'); end $$;

select throws_ok(
  format('select create_market(%L,%L,%L,%L,100,array[%L,%L],now(),now()+interval ''1 day'',false)',
    'x','x','x','x','A','B'),
  'P0001', 'Geen toegang', 'create_market: geen toegang voor admin zonder MFA'
);
select throws_ok(
  'select * from admin_list_users()',
  'P0001', 'Geen toegang', 'admin_list_users: geen toegang voor admin zonder MFA'
);

-- ============================================================
-- Als beheerder met MFA (aal2)
-- ============================================================
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;

do $$
declare v_before bigint; v_after bigint; v_id uuid;
begin
  select count(*) into v_before from admin_actions;
  select create_market('pgTAP rollen-markt', '', 'test', 'test', 100, array['A','B'],
                        now(), now() + interval '1 day', false)
    into v_id;
  select count(*) into v_after from admin_actions;
  perform kv_set('new_market', v_id::text);
  perform kv_set('actions_before', v_before::text);
  perform kv_set('actions_after', v_after::text);
end $$;

select ok(kv('new_market') is not null, 'create_market werkt voor een beheerder met MFA');
select ok(
  kv('actions_after')::bigint = kv('actions_before')::bigint + 1,
  'create_market schrijft een regel in admin_actions'
);

do $$ begin perform test_as_postgres(); end $$;
select throws_ok(
  format('update profiles set role = ''admin'' where email = %L', 'sanne@my.nyenrode.nl'),
  '23505', 'duplicate key value violates unique constraint "only_one_admin"',
  'een tweede beheerder aanwijzen faalt op de unieke index (precies één admin)'
);

-- ============================================================
-- Als anon
-- ============================================================
do $$ begin perform test_as_anon(); end $$;

select ok(
  (select r in ('empty') or r like 'error:%' from (select test_restricted('select * from profiles') as r) s),
  'anon kan profiles niet (zinvol) lezen: 0 rijen of een fout'
);
select ok(
  (select r in ('empty') or r like 'error:%' from (select test_restricted('select * from get_public_trades()') as r) s),
  'anon krijgt bij get_public_trades 0 rijen of een permission-fout'
);
select ok(
  (select r in ('empty') or r like 'error:%' from (select test_restricted('select * from get_leaderboard()') as r) s),
  'anon krijgt bij get_leaderboard 0 rijen of een permission-fout'
);
select throws_ok(
  format('select place_trade(%L, 1, 1000)', kv('draft_outcome')),
  '42501', 'permission denied for function place_trade',
  'place_trade geeft een permission-fout voor anon'
);

select * from finish();

rollback;
