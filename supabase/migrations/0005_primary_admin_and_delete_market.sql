-- Het echte beheerdersaccount van de school: krijgt automatisch de rol 'admin' bij aanmelden,
-- zowel lokaal (inloglink) als straks via het schoolaccount (Azure).
create or replace function primary_admin_email() returns text
language sql immutable as $$ select 'm.albers@my.nyenrode.nl' $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(split_part(new.email, '@', 2)) <> lower(allowed_email_domain()) then
    raise exception 'Alleen e-mailadressen van school kunnen inloggen';
  end if;
  insert into profiles (id, display_name, email, role, balance)
  values (
    new.id,
    split_part(new.email, '@', 1),
    new.email,
    case when lower(new.email) = lower(primary_admin_email()) then 'admin'::user_role else 'student'::user_role end,
    1000
  );
  insert into ledger_entries (user_id, amount, kind) values (new.id, 1000, 'grant');
  return new;
end $$;

-- Mocht het account al bestonden (bijv. eerst als gewone student aangemeld voordat deze migratie
-- draaide), zet de rol dan nu alsnog goed.
update profiles set role = 'admin' where lower(email) = lower(primary_admin_email());

-- ===== Markt verwijderen (alleen beheerders, alleen zonder activiteit) =====
-- Dit is bewust beperkter dan annuleren: zodra er is gehandeld (trades/grootboekregels bestaan),
-- moet een markt geannuleerd worden (cancel_market) zodat de inleg netjes wordt teruggestort en
-- het grootboek klopt. Verwijderen is alleen voor een foutief aangemaakte markt zonder activiteit,
-- zoals bij Polymarket/Kalshi een lege/ongepubliceerde markt gewoon weg kan.
create or replace function delete_market(p_market uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_trades int;
  v_ledger int;
begin
  if not is_admin() then raise exception 'Alleen beheerders'; end if;

  select count(*) into v_trades from trades where market_id = p_market;
  select count(*) into v_ledger from ledger_entries where market_id = p_market;
  if v_trades > 0 or v_ledger > 0 then
    raise exception 'Deze markt heeft al activiteit (trades of grootboekregels); annuleer hem in plaats van te verwijderen';
  end if;

  delete from market_exclusions where market_id = p_market;
  delete from outcomes where market_id = p_market;
  delete from markets where id = p_market;
end $$;

revoke execute on function delete_market(uuid) from anon;
