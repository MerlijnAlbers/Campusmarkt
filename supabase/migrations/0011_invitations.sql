-- ============================================================
-- Uitnodigingen: een account ontstaat alleen nog met een door de beheerder uitgegeven
-- activatiecode (of, zonder code, via Google — mits ook dan een uitnodiging bestaat). Vervangt
-- de domeincontrole (allowed_email_domain()) en de e-mail-inloglink/Azure-voorbereiding die in
-- Fase 1 van de livegangprompt al uit de code zijn verwijderd. Zie README.md, sectie "Inloggen
-- en accounts", voor de volledige opzet.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ===== 1. Instellingen die niet in code horen te staan =====
-- Bewust GEEN rij voor 'admin_email' hier invullen: dat zou het echte e-mailadres van de
-- beheerder in de git-geschiedenis zetten — precies het probleem dat migratie 0010 met het
-- verwijderen van primary_admin_email() al oploste. Zet die rij na het draaien van deze migratie
-- eenmalig zelf via SQL (zie README, sectie "Beheerdersaccount"):
--   insert into app_config (key, value) values ('admin_email', '<jouw e-mailadres>')
--     on conflict (key) do update set value = excluded.value;
create table if not exists app_config (
  key text primary key,
  value text not null
);
alter table app_config enable row level security;
-- Geen policies: alleen security definer-functies lezen dit.

-- ===== 2. Uitnodigingen =====
create type invitation_purpose as enum ('activate', 'reset');

create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose invitation_purpose not null default 'activate',
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index invitations_one_open on invitations (lower(email), purpose)
  where used_at is null and revoked_at is null;
alter table invitations enable row level security;
create policy "alleen admin leest uitnodigingen" on invitations for select to authenticated using (is_admin());
-- Geen insert/update/delete-policies: alleen beheerfuncties (security definer) schrijven hierin.

-- 8 cijfers uit een cryptografisch veilige bron
create or replace function new_activation_code() returns text
language sql volatile as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 100000000)::text, 8, '0')
$$;

-- Beheerder maakt een uitnodiging of resetcode; geeft de code één keer terug
create or replace function admin_create_invitation(p_email text, p_purpose invitation_purpose default 'activate')
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := new_activation_code(); v_email text := lower(trim(p_email));
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Ongeldig e-mailadres'; end if;
  if p_purpose = 'activate' and exists (select 1 from profiles where lower(email) = v_email) then
    raise exception 'Dit e-mailadres heeft al een account; maak een resetcode';
  end if;
  if p_purpose = 'reset' and not exists (select 1 from profiles where lower(email) = v_email) then
    raise exception 'Er is geen account met dit e-mailadres';
  end if;
  update invitations set revoked_at = now()
   where lower(email) = v_email and purpose = p_purpose and used_at is null and revoked_at is null;
  insert into invitations (email, purpose, code_hash, expires_at, created_by)
  values (v_email, p_purpose, extensions.crypt(v_code, extensions.gen_salt('bf')),
          now() + case when p_purpose = 'activate' then interval '48 hours' else interval '2 hours' end,
          auth.uid());
  insert into admin_actions (admin_id, action, details)
  values (auth.uid(), 'create_invitation', jsonb_build_object('email', v_email, 'purpose', p_purpose));
  return v_code;
end $$;

-- Controle vóór het formulier verstuurd wordt (voor nette foutmeldingen). Max. 5 foute pogingen per code.
create or replace function check_invitation(p_email text, p_code text, p_purpose invitation_purpose)
returns boolean language plpgsql security definer set search_path = public as $$
declare r invitations%rowtype;
begin
  select * into r from invitations
   where lower(email) = lower(trim(p_email)) and purpose = p_purpose
     and used_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found or r.failed_attempts >= 5 then return false; end if;
  if extensions.crypt(p_code, r.code_hash) = r.code_hash then return true; end if;
  update invitations set failed_attempts = failed_attempts + 1 where id = r.id;
  return false;
end $$;

-- VOOR het aanmaken van een gebruiker: uitnodiging verplicht, code verplicht bij e-mail/wachtwoord
create or replace function before_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_inv invitations%rowtype;
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_code text := new.raw_user_meta_data ->> 'activation_code';
begin
  select * into v_inv from invitations
   where lower(email) = lower(new.email) and purpose = 'activate'
     and used_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found then raise exception 'NO_INVITATION'; end if;
  if v_provider = 'email' then
    if v_inv.failed_attempts >= 5 or v_code is null
       or extensions.crypt(v_code, v_inv.code_hash) <> v_inv.code_hash then
      raise exception 'INVALID_CODE';
    end if;
  end if;
  update invitations set used_at = now() where id = v_inv.id;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'activation_code';  -- code niet bewaren
  return new;
end $$;
create trigger before_auth_user_created before insert on auth.users
  for each row execute function before_new_user();

-- NA het aanmaken: profiel, startpunten, en de beheerdersrol voor precies het e-mailadres uit
-- app_config.admin_email (vervangt handle_new_user() uit migratie 0010, die nooit een rol koos;
-- de domeincontrole op allowed_email_domain() vervalt — alleen wie is uitgenodigd komt hier nog
-- binnen, dus een apart domeinfilter is niet meer nodig).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean := coalesce(
    lower(new.email) = (select lower(value) from app_config where key = 'admin_email'), false);
begin
  insert into profiles (id, display_name, email, role, balance)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
          lower(new.email),
          case when v_is_admin then 'admin'::user_role else 'student'::user_role end,
          case when v_is_admin then 0 else 1000 end);
  if not v_is_admin then
    insert into ledger_entries (user_id, amount, kind) values (new.id, 1000, 'grant');
  end if;
  return new;
end $$;

drop function if exists allowed_email_domain();

-- Alleen voor de server-route (secret key): resetcode controleren en verbruiken, geeft user-id terug
create or replace function consume_reset_code(p_email text, p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not check_invitation(p_email, p_code, 'reset') then return null; end if;
  update invitations set used_at = now()
   where lower(email) = lower(trim(p_email)) and purpose = 'reset' and used_at is null and revoked_at is null;
  select id into v_id from profiles where lower(email) = lower(trim(p_email));
  return v_id;
end $$;

-- ===== 3. Overzicht en intrekken voor de beheerpagina =====
create or replace function admin_list_invitations()
returns table (
  id uuid, email text, purpose invitation_purpose, status text,
  expires_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  return query
    select i.id, i.email, i.purpose,
           case
             when i.revoked_at is not null then 'Ingetrokken'
             when i.used_at is not null then 'Gebruikt'
             when i.expires_at <= now() then 'Verlopen'
             when i.failed_attempts >= 5 then 'Geblokkeerd na 5 pogingen'
             else 'Open'
           end,
           i.expires_at, i.created_at
    from invitations i
    order by i.created_at desc;
end $$;

create or replace function admin_revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  update invitations set revoked_at = now() where id = p_id and used_at is null and revoked_at is null;
  insert into admin_actions (admin_id, action, details)
  values (auth.uid(), 'revoke_invitation', jsonb_build_object('invitation_id', p_id));
end $$;

-- ===== 4. admin_list_users(): ook laten zien via welke methode iemand inlogt =====
-- (drop vereist: er komt een kolom bij)
drop function if exists admin_list_users();

create or replace function admin_list_users()
returns table (
  user_id uuid, display_name text, email text, balance numeric,
  is_blocked boolean, blocked_reason text, created_at timestamptz,
  last_trade_at timestamptz, trade_count bigint, providers text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  return query
    select pr.id, pr.display_name, pr.email, pr.balance, pr.is_blocked, pr.blocked_reason,
           pr.created_at, max(t.created_at), count(t.id), max(idents.providers)
    from profiles pr
    left join trades t on t.user_id = pr.id
    left join (
      select i.user_id, string_agg(distinct i.provider, ', ' order by i.provider) as providers
      from auth.identities i
      group by i.user_id
    ) idents on idents.user_id = pr.id
    where pr.role = 'student'
    group by pr.id, pr.display_name, pr.email, pr.balance, pr.is_blocked, pr.blocked_reason, pr.created_at
    order by pr.display_name;
end $$;

-- ===== 5. Rechten =====
revoke execute on function
  new_activation_code(), before_new_user(), handle_new_user(), consume_reset_code(text, text)
  from public, anon, authenticated;

grant execute on function consume_reset_code(text, text) to service_role;
grant execute on function check_invitation(text, text, invitation_purpose) to anon, authenticated;
grant execute on function
  admin_create_invitation(text, invitation_purpose),
  admin_list_invitations(),
  admin_revoke_invitation(uuid),
  admin_list_users()
to authenticated;
