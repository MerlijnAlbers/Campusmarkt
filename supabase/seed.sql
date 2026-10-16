-- Testaccounts en voorbeeldmarkten voor lokale ontwikkeling.
-- Wachtwoorden zijn hier niet relevant: iedereen logt in met de e-mail-inloglink (of straks het
-- schoolaccount). Het wachtwoord is alleen een technisch vereiste van de auth.users-tabel.

create extension if not exists pgcrypto;

-- ===== Testaccounts: 1 beheerder + 4 studenten =====
do $$
declare
  v_users jsonb := '[
    {"email": "admin@my.nyenrode.nl", "name": "admin"},
    {"email": "sanne@my.nyenrode.nl", "name": "Sanne"},
    {"email": "daan@my.nyenrode.nl", "name": "Daan"},
    {"email": "noor@my.nyenrode.nl", "name": "Noor"},
    {"email": "mehmet@my.nyenrode.nl", "name": "Mehmet"}
  ]'::jsonb;
  v_user jsonb;
  v_id uuid;
begin
  for v_user in select * from jsonb_array_elements(v_users) loop
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_user ->> 'email', crypt('campusmarkt-test', gen_salt('bf')), now(),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_user ->> 'email'),
      'email', now(), now(), now()
    );

    -- De trigger handle_new_user() heeft hierboven al het profiel en de 1.000 startpunten aangemaakt.
    update profiles set display_name = v_user ->> 'name' where id = v_id;
  end loop;

  update profiles set role = 'admin' where email = 'admin@my.nyenrode.nl';
end $$;

-- ===== Voorbeeldmarkten (uit de demo) =====
do $$
declare
  v_admin uuid;
  v_market uuid;
begin
  select id into v_admin from profiles where email = 'admin@my.nyenrode.nl';

  insert into markets (
    title, description, resolution_criteria, resolution_source, b, status, opens_at, closes_at, created_by
  ) values (
    'Wint team Logistiek het zaalvoetbaltoernooi in december?',
    'Het jaarlijkse interne zaalvoetbaltoernooi tussen studieverenigingen.',
    'Resolveert ''Ja'' als team Logistiek als winnaar uit het eindklassement van het toernooi komt, anders ''Nee''.',
    'Einduitslag zoals gepubliceerd door de toernooiorganisatie op het schoolintranet.',
    150, 'open', now(), now() + interval '30 days', v_admin
  ) returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values
    (v_market, 'Ja', 1),
    (v_market, 'Nee', 2);

  insert into markets (
    title, description, resolution_criteria, resolution_source, b, status, opens_at, closes_at, created_by
  ) values (
    'Hoeveel studenten kopen een kaartje voor het kerstgala?',
    'Het jaarlijkse kerstgala van de school.',
    'Resolveert op basis van het totaal aantal verkochte kaartjes op de sluitingsdatum van de verkoop.',
    'Officieel verkoopoverzicht van de organiserende commissie.',
    150, 'open', now(), now() + interval '30 days', v_admin
  ) returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values
    (v_market, 'Minder dan 200', 1),
    (v_market, '200 tot 350', 2),
    (v_market, 'Meer dan 350', 3);

  insert into markets (
    title, description, resolution_criteria, resolution_source, b, status, opens_at, closes_at, created_by
  ) values (
    'Gaat de kantine vóór 1 januari ook op zaterdag open?',
    'Voorstel dat bij de directie ligt om de openingstijden van de kantine uit te breiden.',
    'Resolveert ''Ja'' als de kantine vóór 1 januari minstens één keer op zaterdag geopend is geweest.',
    'Aankondiging van de facilitaire dienst, of een melding op het schoolintranet.',
    100, 'open', now(), now() + interval '30 days', v_admin
  ) returning id into v_market;
  insert into outcomes (market_id, label, sort_order) values
    (v_market, 'Ja', 1),
    (v_market, 'Nee', 2);
end $$;
