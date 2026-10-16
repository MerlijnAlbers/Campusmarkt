-- pgTAP-tests voor de kernregels van Campusmarkt (zie Fase 2 van de bouwprompt).
-- Draai met: supabase test db supabase/tests

create extension if not exists pgtap;

begin;

select plan(13);

-- ===== Testhulpmiddelen =====
create temp table kv (k text primary key, v text);

create or replace function kv_set(p_k text, p_v text) returns void
language sql security definer as $$
  insert into kv (k, v) values (p_k, p_v)
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function kv(p_k text) returns text
language sql security definer as $$ select v from kv where k = p_k $$;

-- Doet alsof we zijn ingelogd als het testaccount met dit e-mailadres (zet rol + jwt-claim, net
-- als PostgREST dat voor een echte ingelogde gebruiker zou doen).
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

-- Zet de sessie terug naar de bevoorrechte testrol (voor fixtures en admin-only checks).
create or replace function test_as_postgres() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ===== Fixtures: losse testmarkten, zodat ze de seed-markten niet raken =====
do $$
declare
  v_market uuid;
  v_a uuid;
  v_b uuid;
begin
  -- Markt voor kopen/verkopen (open)
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: handelsmarkt', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'B', 2) returning id into v_b;
  perform kv_set('m_trade', v_market::text);
  perform kv_set('o_a', v_a::text);
  perform kv_set('o_b', v_b::text);

  -- Gesloten markt
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: gesloten markt', 'test', 'test', 100, 'closed', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  perform kv_set('m_closed', v_market::text);
  perform kv_set('o_closed', v_a::text);

  -- Markt met een uitsluiting voor Daan
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: markt met uitsluiting', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  perform kv_set('m_excl', v_market::text);
  perform kv_set('o_excl', v_a::text);
  insert into market_exclusions (market_id, user_id, reason)
  values (v_market, (select id from profiles where email = 'daan@my.nyenrode.nl'), 'pgTAP-test');

  -- Markt voor de uitbetalingstest
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: uitbetalingsmarkt', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'B', 2) returning id into v_b;
  perform kv_set('m_payout', v_market::text);
  perform kv_set('o_payout_win', v_a::text);

  -- Markt voor de annuleringstest
  insert into markets (title, resolution_criteria, resolution_source, b, status, opens_at, closes_at)
  values ('pgTAP: annuleringsmarkt', 'test', 'test', 100, 'open', now() - interval '1 hour', now() + interval '7 days')
  returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values (v_market, 'A', 1) returning id into v_a;
  perform kv_set('m_cancel', v_market::text);
  perform kv_set('o_cancel', v_a::text);
end $$;

-- ===== 1. Kopen van 50 aandelen bij b=100 kost 28,09 en zet de kans op 62,25% =====
do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;

select ok(
  abs((select cost from place_trade(kv('o_a')::uuid, 50, 30)) - 28.09) < 0.01,
  'kopen van 50 aandelen bij b=100 kost ongeveer 28,09 punten'
);

select ok(
  abs((select prob from outcome_prices where outcome_id = kv('o_a')::uuid) - 0.6225) < 0.001,
  'de kans na kopen van 50 aandelen is ongeveer 62,25%'
);

-- ===== 2. Te weinig punten wordt geweigerd =====
select throws_ok(
  format('select place_trade(%L, 100000, 10000000)', kv('o_b')),
  'P0001',
  'Te weinig punten',
  'kopen met te weinig punten wordt geweigerd'
);

-- ===== 3. Verkopen van meer dan je hebt wordt geweigerd =====
-- Sanne heeft precies 50 aandelen van A (uit test 1); verkopen van 51 moet mislukken.
select throws_ok(
  format('select place_trade(%L, -51, 1000)', kv('o_a')),
  'P0001',
  'Je hebt niet genoeg aandelen',
  'verkopen van meer aandelen dan je hebt wordt geweigerd'
);

-- ===== 4. Handelen in een gesloten markt wordt geweigerd =====
select throws_ok(
  format('select place_trade(%L, 10, 1000)', kv('o_closed')),
  'P0001',
  'Deze markt is gesloten',
  'handelen in een gesloten markt wordt geweigerd'
);

-- ===== 5. Een uitgesloten student kan niet handelen =====
do $$ begin perform test_as('daan@my.nyenrode.nl'); end $$;

select throws_ok(
  format('select place_trade(%L, 10, 1000)', kv('o_excl')),
  'P0001',
  'Je kunt in deze markt niet handelen',
  'een uitgesloten student kan niet handelen in die markt'
);

-- ===== 6. Een student kan niet rechtstreeks balance of positions wijzigen (RLS) =====
do $$ begin perform test_as('sanne@my.nyenrode.nl'); end $$;

select throws_ok(
  format(
    'update profiles set balance = balance + 999999 where email = %L',
    'sanne@my.nyenrode.nl'
  ),
  '42501',
  'permission denied for table profiles',
  'een student kan het eigen saldo niet rechtstreeks wijzigen'
);

select throws_ok(
  format(
    'insert into positions (user_id, outcome_id, market_id, shares, net_spent) values (%L, %L, %L, 10, 10)',
    (select id from profiles where email = 'sanne@my.nyenrode.nl'),
    kv('o_b'),
    kv('m_trade')
  ),
  '42501',
  'new row violates row-level security policy for table "positions"',
  'een student kan niet rechtstreeks een positie aanmaken'
);

-- ===== 7. Een niet-admin kan resolve_market niet aanroepen =====
select throws_ok(
  format('select resolve_market(%L, %L)', kv('m_payout'), kv('o_payout_win')),
  'P0001',
  'Geen toegang',
  'een niet-admin kan resolve_market niet aanroepen'
);

-- ===== 8. Uitbetalen geeft winnaars 1 punt per aandeel =====
do $$ begin perform test_as('noor@my.nyenrode.nl'); end $$;
do $$ begin perform place_trade(kv('o_payout_win')::uuid, 20, 1000); end $$;

do $$
declare v_balance numeric;
begin
  select balance into v_balance from profiles where email = 'noor@my.nyenrode.nl';
  perform kv_set('noor_balance_before_resolve', v_balance::text);
end $$;

do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$ begin perform resolve_market(kv('m_payout')::uuid, kv('o_payout_win')::uuid); end $$;

select ok(
  (select balance from profiles where email = 'noor@my.nyenrode.nl')
    - kv('noor_balance_before_resolve')::numeric = 20,
  'uitbetalen geeft de winnaar exact 1 punt per gekocht aandeel'
);

select ok(
  (select status = 'resolved' and winning_outcome_id = kv('o_payout_win')::uuid
     from markets where id = kv('m_payout')::uuid),
  'de markt staat na uitbetalen op resolved met de juiste winnende uitkomst'
);

-- ===== 9. Annuleren stort de netto inleg terug =====
do $$ begin perform test_as('mehmet@my.nyenrode.nl'); end $$;
do $$ begin perform place_trade(kv('o_cancel')::uuid, 15, 1000); end $$;

do $$
declare v_balance numeric; v_net_spent numeric;
begin
  select balance into v_balance from profiles where email = 'mehmet@my.nyenrode.nl';
  select net_spent into v_net_spent from positions
    where user_id = (select id from profiles where email = 'mehmet@my.nyenrode.nl')
      and outcome_id = kv('o_cancel')::uuid;
  perform kv_set('mehmet_balance_before_cancel', v_balance::text);
  perform kv_set('mehmet_net_spent', v_net_spent::text);
end $$;

do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;
do $$ begin perform cancel_market(kv('m_cancel')::uuid); end $$;

select ok(
  (select balance from profiles where email = 'mehmet@my.nyenrode.nl')
    - kv('mehmet_balance_before_cancel')::numeric = kv('mehmet_net_spent')::numeric,
  'annuleren stort precies de netto inleg terug'
);

-- ===== 10. check_ledger() is leeg na alle scenario's =====
do $$ begin perform test_as('admin@my.nyenrode.nl', 'aal2'); end $$;

select is_empty(
  'select * from check_ledger()',
  'het grootboek klopt na alle testscenario''s (check_ledger() is leeg)'
);

select * from finish();

rollback;
