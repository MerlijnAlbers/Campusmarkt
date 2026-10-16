-- pgTAP-tests voor het openbare logboek en de markttegel-statistieken (v1.1, Fase 2).
-- Draai met: supabase test db supabase/tests

create extension if not exists pgtap;

begin;

select plan(21);

-- ===== Testhulpmiddelen (zelfstandig; dit bestand draait los van campusmarkt.test.sql) =====
create temp table kv (k text primary key, v text);

create or replace function kv_set(p_k text, p_v text) returns void
language sql security definer as $$
  insert into kv (k, v) values (p_k, p_v)
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function kv(p_k text) returns text
language sql security definer as $$ select v from kv where k = p_k $$;

-- Opzoeken mag RLS omzeilen (security definer); de roluitgifte hieronder mag dat juist niet
-- zijn, want "set role" is binnen een security-definer-functie niet toegestaan.
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

create or replace function test_as_logged_out() returns void
language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function test_as_postgres() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ===== Fixture: markt met b=100, 2 uitkomsten =====
do $$
declare v_market uuid; v_a uuid; v_b uuid;
begin
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: begrippen-testmarkt', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'Ja', 1) returning id into v_a;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'Nee', 2) returning id into v_b;
  perform kv_set('m1', v_market::text);
  perform kv_set('o1_ja', v_a::text);
  perform kv_set('o1_nee', v_b::text);

  -- Losse markt, puur voor de paginatietest (zodat eerdere trades op m1 niet meetellen).
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: paginatie-testmarkt', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  perform kv_set('m2', v_market::text);
  perform kv_set('o2_a', v_a::text);
end $$;

-- ===== 1. Controlewaarden: kopen van 50 aandelen bij b=100 =====
do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;
do $$ begin perform place_trade(kv('o1_ja')::uuid, 50, 30); end $$;

do $$ begin perform test_as_postgres(); end $$;
do $$
declare v_stats record;
begin
  select * into v_stats from get_market_stats(kv('m1')::uuid);
  perform kv_set('s1_prob', (v_stats.outcomes->0->>'prob'));
  perform kv_set('s1_value', v_stats.market_value::text);
  perform kv_set('s1_pot', v_stats.pot::text);
  perform kv_set('s1_volume', v_stats.volume_total::text);
  perform kv_set('s1_change', (v_stats.outcomes->0->>'change_24h'));
end $$;

select ok(abs(kv('s1_prob')::numeric - 0.6225) < 0.001, 'controlewaarde: kans Ja na 50 aandelen is ongeveer 62,25%');
select ok(abs(kv('s1_value')::numeric - 31.12) < 0.01, 'controlewaarde: marktwaarde is ongeveer 31,12');
select ok(abs(kv('s1_pot')::numeric - 28.09) < 0.01, 'controlewaarde: pot is ongeveer 28,09');
select ok(abs(kv('s1_volume')::numeric - 28.09) < 0.01, 'controlewaarde: volume is ongeveer 28,09');
select ok(abs(kv('s1_change')::numeric - 0.1225) < 0.001, 'controlewaarde: verandering 24u is ongeveer +12,25 pt');

-- ===== Zelfde markt, daarna verkoopt Sanne 20 aandelen =====
do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;
do $$
declare v_trade trades;
begin
  select * into v_trade from place_trade(kv('o1_ja')::uuid, -20, 1000);
  perform kv_set('t2_cost', v_trade.cost::text);
end $$;

do $$ begin perform test_as_postgres(); end $$;
do $$
declare v_stats record;
begin
  select * into v_stats from get_market_stats(kv('m1')::uuid);
  perform kv_set('s2_volume', v_stats.volume_total::text);
  perform kv_set('s2_trades', v_stats.trade_count::text);
  perform kv_set('s2_traders', v_stats.trader_count::text);
end $$;

select ok(
  abs(kv('s2_volume')::numeric - (28.09 + abs(kv('t2_cost')::numeric))) < 0.01,
  'volume na verkoop = eerste aankoop + opbrengst van de verkoop'
);
select is(kv('s2_trades')::int, 2, 'twee transacties in deze markt');
select is(kv('s2_traders')::int, 1, 'nog steeds maar één handelaar (dezelfde student)');

-- ===== 2. Anonimiteit: Daan zet show_name_in_feed uit =====
do $$ begin perform test_as('daan@my.nyenrode.nl'); end $$;
do $$ begin update profiles set show_name_in_feed = false where email = 'daan@my.nyenrode.nl'; end $$;
do $$ begin perform place_trade(kv('o1_nee')::uuid, 10, 1000); end $$;

do $$
declare v_row record;
begin
  select * into v_row from get_public_trades(kv('m1')::uuid, kv('o1_nee')::uuid) limit 1;
  perform kv_set('daan_self_name', v_row.trader_name);
  perform kv_set('daan_self_is_me', v_row.is_me::text);
end $$;

select is(kv('daan_self_name'), 'Daan', 'Daan ziet zijn eigen trade met zijn echte bijnaam');
select is(kv('daan_self_is_me')::boolean, true, 'Daan ziet is_me = true op zijn eigen trade');

do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;
do $$
declare v_row record;
begin
  select * into v_row from get_public_trades(kv('m1')::uuid, kv('o1_nee')::uuid) limit 1;
  perform kv_set('daan_other_name', v_row.trader_name);
  perform kv_set('daan_other_is_me', v_row.is_me::text);
end $$;

select is(kv('daan_other_name'), 'Anonieme student', 'andere studenten zien Daans trade als "Anonieme student"');
select is(kv('daan_other_is_me')::boolean, false, 'is_me staat op false voor andermans trade');

-- geen e-mailadres of user-id van Daan lekt naar buiten (het logboek toont immers al
-- "Anonieme student", en de profielen-RLS laat Sanne Daans rij nu sowieso niet meer lezen)
select is_empty(
  format('select email, id from profiles where email = %L', 'daan@my.nyenrode.nl'),
  'een andere student kan Daans e-mailadres of user-id niet rechtstreeks via profiles opvragen'
);

-- ===== 3. Conceptmarkten zijn nergens zichtbaar voor niet-admins =====
do $$ begin perform test_as_postgres(); end $$;
do $$ begin update markets set status = 'draft' where id = kv('m1')::uuid; end $$;

do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;
select is_empty(
  format('select * from get_public_trades(%L)', kv('m1')),
  'trades in een conceptmarkt komen niet terug in het logboek van een student'
);
select is_empty(
  format('select * from get_market_stats(%L)', kv('m1')),
  'een conceptmarkt komt niet terug in de statistieken van een student'
);

do $$ begin perform test_as('admin@my.nyenrode.nl'); end $$;
select isnt_empty(
  format('select * from get_market_stats(%L)', kv('m1')),
  'een beheerder ziet de statistieken van een conceptmarkt wel'
);

do $$ begin perform test_as_postgres(); end $$;
do $$ begin update markets set status = 'open' where id = kv('m1')::uuid; end $$;

-- ===== 4. Paginering: geen dubbele of ontbrekende rijen over drie pagina's =====
do $$ begin perform test_as('mehmet@my.nyenrode.nl'); end $$;
do $$
declare i int;
begin
  for i in 1..7 loop
    perform place_trade(kv('o2_a')::uuid, 1, 1000);
  end loop;
end $$;

do $$
declare
  v_all uuid[] := array[]::uuid[];
  v_page uuid[];
  v_before_at timestamptz := null;
  v_before_id uuid := null;
  v_row record;
  v_last record;
  v_page_count int;
begin
  for p in 1..3 loop
    v_page := array[]::uuid[];
    v_page_count := 0;
    for v_row in
      select * from get_public_trades(kv('m2')::uuid, kv('o2_a')::uuid, null, false, v_before_at, v_before_id, 3)
    loop
      v_page := v_page || v_row.id;
      v_page_count := v_page_count + 1;
      v_last := v_row;
    end loop;
    exit when v_page_count = 0;
    v_all := v_all || v_page;
    v_before_at := v_last.created_at;
    v_before_id := v_last.id;
  end loop;
  perform kv_set('page_total', array_length(v_all, 1)::text);
  perform kv_set('page_distinct', (select count(distinct x) from unnest(v_all) x)::text);
end $$;

select is(kv('page_total')::int, kv('page_distinct')::int, 'paginering levert geen dubbele rijen op over drie pagina''s');
select is(kv('page_total')::int, 7, 'paginering vindt alle 7 trades op outcome Ja terug (geen ontbrekende rijen)');

-- ===== 5. p_limit wordt begrensd =====
select is(least(greatest(500, 1), 200), 200, 'p_limit wordt naar boven begrensd op 200');
select is(least(greatest(0, 1), 200), 1, 'p_limit wordt naar onder begrensd op minimaal 1');

-- ===== 6. Een niet-ingelogde aanroep geeft 0 rijen =====
do $$ begin perform test_as_logged_out(); end $$;
select is_empty('select * from get_public_trades()', 'een niet-ingelogde aanroep van get_public_trades geeft 0 rijen');

select * from finish();

rollback;
