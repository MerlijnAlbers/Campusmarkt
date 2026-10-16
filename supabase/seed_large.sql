-- Prestatietest-seed: ~150 extra studenten, 50 markten, ~5.000 transacties.
--
-- Dit script zit BEWUST niet in supabase/config.toml's db.seed.sql_paths: het zou elke gewone
-- `supabase db reset` tijdens ontwikkelen tientallen seconden extra kosten. Draai het apart, NA
-- een normale `supabase db reset` (die eerst de kleine seed.sql laadt):
--
--   docker exec -i supabase_db_campusmarkt psql -U postgres -d postgres -f /dev/stdin < supabase/seed_large.sql
--
-- (of plak de inhoud in Supabase Studio's SQL-editor op http://127.0.0.1:54323/project/default/sql).
-- Zie README, sectie "Prestaties testen" voor waar je daarna op moet letten.
--
-- Het script gebruikt overal de echte RPC's (create_market/place_trade/resolve_market/...) in
-- plaats van losse inserts, door het JWT-GUC te zetten dat auth.uid()/auth.jwt() ook leest als er
-- een echte ingelogde sessie zou zijn (dezelfde truc als de pgTAP-tests in supabase/tests/). Zo
-- blijft het grootboek automatisch consistent -- controleer dat met select * from check_ledger()
-- (ingelogd als beheerder) na het draaien; die hoort leeg te zijn.

create extension if not exists pgcrypto;

-- ===== 1. 150 extra studenten =====
do $$
declare
  v_id uuid;
  v_email text;
  i int;
begin
  for i in 1..150 loop
    v_id := gen_random_uuid();
    v_email := 'perf' || lpad(i::text, 3, '0') || '@my.nyenrode.nl';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt('campusmarkt-test', gen_salt('bf')), now(),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    -- handle_new_user() heeft het profiel + 1.000 startpunten al aangemaakt.
    update profiles set display_name = 'Speler ' || lpad(i::text, 3, '0') where id = v_id;
  end loop;

  raise notice '150 extra studenten aangemaakt.';
end $$;

-- ===== 2. 50 markten (als "beheerder", via create_market()) =====
create temporary table tmp_markets (id uuid primary key, outcome_ids uuid[]);

do $$
declare
  v_admin uuid;
  v_id uuid;
  v_outcomes text[];
  i int;
begin
  select id into v_admin from profiles where email = 'admin@my.nyenrode.nl';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  for i in 1..50 loop
    v_outcomes := case
      when i % 3 = 0 then array['Ja', 'Nee']
      when i % 3 = 1 then array['Optie A', 'Optie B', 'Optie C']
      else array['Minder dan gemiddeld', 'Gemiddeld', 'Meer dan gemiddeld', 'Veel meer dan gemiddeld']
    end;

    v_id := create_market(
      p_title := 'Prestatietestmarkt #' || i,
      p_description := 'Automatisch gegenereerde markt voor belasting- en prestatietesten.',
      p_criteria := 'Niet van toepassing (testdata).',
      p_source := 'Testdata, geen echte bron.',
      p_b := 50 + (i * 5),
      p_outcomes := v_outcomes,
      p_opens_at := now() - interval '1 day',
      p_closes_at := now() + ((5 + i) || ' days')::interval,
      p_open := true
    );

    insert into tmp_markets (id, outcome_ids)
    select v_id, array_agg(o.id order by o.sort_order)
    from outcomes o where o.market_id = v_id;
  end loop;

  raise notice '50 markten aangemaakt.';
end $$;

-- ===== 3. ~5.000 transacties, verspreid over willekeurige studenten/markten/uitkomsten =====
do $$
declare
  v_student uuid;
  v_market tmp_markets%rowtype;
  v_outcome uuid;
  v_shares numeric;
  v_held numeric;
  v_attempts int := 0;
  v_success int := 0;
  v_target constant int := 5000;
begin
  while v_success < v_target and v_attempts < v_target * 2 loop
    v_attempts := v_attempts + 1;

    select id into v_student from profiles where role = 'student' order by random() limit 1;
    select * into v_market from tmp_markets order by random() limit 1;
    v_outcome := v_market.outcome_ids[1 + floor(random() * array_length(v_market.outcome_ids, 1))::int];

    if random() < 0.25 then
      -- soms verkopen i.p.v. kopen, als deze speler al iets van deze uitkomst heeft.
      select shares into v_held from positions
        where user_id = v_student and outcome_id = v_outcome;
      if v_held is null or v_held <= 0 then
        v_shares := round((1 + random() * 19)::numeric, 2);
      else
        v_shares := -round((random() * v_held)::numeric, 2);
        if v_shares = 0 then
          continue;
        end if;
      end if;
    else
      v_shares := round((1 + random() * 19)::numeric, 2);
    end if;

    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_student, 'role', 'authenticated', 'aal', 'aal1')::text,
      true
    );

    begin
      -- Ruime max_cost: dit script test volume, niet prijsbescherming.
      perform place_trade(v_outcome, v_shares, 999999);
      v_success := v_success + 1;
    exception when others then
      -- Verwacht af en toe (te weinig punten, markt net dicht door eerdere iteratie, etc.) --
      -- gewoon overslaan en doorgaan.
      null;
    end;
  end loop;

  raise notice 'Transacties gelukt: % (van % pogingen)', v_success, v_attempts;
end $$;

-- ===== 4. Status-spreiding: een handvol markten afwikkelen/annuleren/sluiten =====
do $$
declare
  v_admin uuid;
  v_m tmp_markets%rowtype;
  i int := 0;
begin
  select id into v_admin from profiles where email = 'admin@my.nyenrode.nl';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  for v_m in select * from tmp_markets order by random() limit 10 loop
    i := i + 1;
    if i <= 6 then
      perform resolve_market(v_m.id, v_m.outcome_ids[1]);
    elsif i <= 8 then
      perform cancel_market(v_m.id);
    else
      perform set_market_status(v_m.id, 'closed');
    end if;
  end loop;

  raise notice '10 markten kregen een andere status (afgewikkeld/geannuleerd/gesloten).';
end $$;

drop table tmp_markets;
