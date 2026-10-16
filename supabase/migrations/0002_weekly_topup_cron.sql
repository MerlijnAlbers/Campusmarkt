create extension if not exists pg_cron;

grant usage on schema cron to postgres;

-- `cron.timezone` kan niet via een migratie worden gezet (vereist een serverherstart), dus we
-- draaien de controle elk uur in UTC en voeren de aanvulling alleen uit als het dan lokaal in
-- Amsterdam maandag 07:00 is. De iso-week-registratie voorkomt dat dit per week meer dan één keer
-- gebeurt (ook rond de overgang naar/van zomertijd).
create table if not exists weekly_topup_runs (
  iso_week text primary key,
  ran_at timestamptz not null default now()
);

create or replace function run_weekly_topup_if_due() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := now() at time zone 'Europe/Amsterdam';
  v_week text := to_char(v_local, 'IYYY-IW');
  v_inserted text;
begin
  if extract(isodow from v_local) <> 1 or extract(hour from v_local) <> 7 then
    return;
  end if;

  insert into weekly_topup_runs (iso_week) values (v_week)
  on conflict (iso_week) do nothing
  returning iso_week into v_inserted;

  if v_inserted is not null then
    perform weekly_topup();
  end if;
end $$;

select cron.schedule(
  'weekly-topup',
  '0 * * * 1', -- elk uur op maandag (UTC); run_weekly_topup_if_due() filtert op 07:00 Europe/Amsterdam
  $$select run_weekly_topup_if_due()$$
);

alter table weekly_topup_runs enable row level security;

-- Alleen de cron-taak (als eigenaar postgres) mag deze aanroepen, geen enkele ingelogde gebruiker.
revoke execute on function weekly_topup() from public;
revoke execute on function run_weekly_topup_if_due() from public;

-- Diagnostische functie; niet bedoeld om door studenten via RPC aangeroepen te worden.
revoke execute on function check_ledger() from public;
