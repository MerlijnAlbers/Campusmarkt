-- ===== Types =====
create type user_role as enum ('student','admin');
create type market_status as enum ('draft','open','closed','resolved','cancelled');
create type ledger_kind as enum ('grant','topup','trade','payout','refund','adjustment');

-- ===== Tabellen =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role user_role not null default 'student',
  balance numeric(18,6) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table markets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  resolution_criteria text not null,
  resolution_source text not null,
  b numeric not null check (b > 0),
  status market_status not null default 'draft',
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  winning_outcome_id uuid,
  created_by uuid references profiles(id),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  label text not null,
  sort_order int not null,
  q numeric(18,6) not null default 0,
  unique (market_id, sort_order)
);
alter table markets add constraint markets_winner_fk
  foreign key (winning_outcome_id) references outcomes(id);

create table positions (
  user_id uuid not null references profiles(id) on delete cascade,
  outcome_id uuid not null references outcomes(id) on delete cascade,
  market_id uuid not null references markets(id) on delete cascade,
  shares numeric(18,6) not null default 0 check (shares >= 0),
  net_spent numeric(18,6) not null default 0,
  primary key (user_id, outcome_id)
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  market_id uuid not null references markets(id),
  outcome_id uuid not null references outcomes(id),
  shares numeric(18,6) not null,          -- > 0 kopen, < 0 verkopen
  cost numeric(18,6) not null,            -- > 0 betaald, < 0 ontvangen
  prob_before numeric not null,
  prob_after numeric not null,
  probs_after numeric[] not null,         -- kansen van alle uitkomsten na deze trade (op sort_order)
  created_at timestamptz not null default now()
);
create index on trades (market_id, created_at);

create table ledger_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  amount numeric(18,6) not null,
  kind ledger_kind not null,
  trade_id uuid references trades(id),
  market_id uuid references markets(id),
  created_at timestamptz not null default now()
);
create index on ledger_entries (user_id, created_at);

create table market_exclusions (
  market_id uuid not null references markets(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  reason text,
  primary key (market_id, user_id)
);

-- ===== Helpers =====
create or replace function allowed_email_domain() returns text
language sql immutable as $$ select 'my.nyenrode.nl' $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

-- LMSR-kostenfunctie, numeriek stabiel (log-sum-exp)
create or replace function lmsr_cost(q numeric[], b numeric)
returns numeric language plpgsql immutable as $$
declare m numeric; s numeric := 0; v numeric;
begin
  select max(x / b) into m from unnest(q) as x;
  foreach v in array q loop s := s + exp(v / b - m); end loop;
  return b * (m + ln(s));
end $$;

-- Kans van uitkomst i (1-based): exp(q_i/b - C(q)/b)
create or replace function lmsr_prob(q numeric[], b numeric, i int)
returns numeric language sql immutable as $$
  select exp(q[i] / b - lmsr_cost(q, b) / b)
$$;

-- Actuele kans per uitkomst (respecteert RLS van onderliggende tabellen)
create view outcome_prices with (security_invoker = true) as
with s1 as (
  select o.id, o.market_id, o.label, o.sort_order, o.q, m.b,
         o.q / m.b as x,
         max(o.q / m.b) over (partition by o.market_id) as mx
  from outcomes o join markets m on m.id = o.market_id
), s2 as (
  select *, mx + ln(sum(exp(x - mx)) over (partition by market_id)) as lse from s1
)
select id as outcome_id, market_id, label, sort_order, q, b, exp(x - lse) as prob from s2;

-- ===== Aanmelden: domeincheck, profiel en startpunten =====
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(split_part(new.email, '@', 2)) <> lower(allowed_email_domain()) then
    raise exception 'Alleen e-mailadressen van school kunnen inloggen';
  end if;
  insert into profiles (id, display_name, email, balance)
  values (new.id, split_part(new.email, '@', 1), new.email, 1000);
  insert into ledger_entries (user_id, amount, kind) values (new.id, 1000, 'grant');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ===== Handelen =====
create or replace function place_trade(p_outcome uuid, p_shares numeric, p_max_cost numeric)
returns trades language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_mkt markets%rowtype;
  v_ids uuid[]; v_q numeric[]; v_q2 numeric[]; v_i int;
  v_cost numeric; v_held numeric; v_bal numeric;
  v_trade trades%rowtype;
begin
  if v_user is null then raise exception 'Niet ingelogd'; end if;
  if p_shares = 0 then raise exception 'Aantal mag niet 0 zijn'; end if;

  select m.* into v_mkt from markets m join outcomes o on o.market_id = m.id
   where o.id = p_outcome for update of m;
  if not found then raise exception 'Onbekende uitkomst'; end if;
  if v_mkt.status <> 'open' or now() not between v_mkt.opens_at and v_mkt.closes_at then
    raise exception 'Deze markt is gesloten';
  end if;
  if exists (select 1 from market_exclusions where market_id = v_mkt.id and user_id = v_user) then
    raise exception 'Je kunt in deze markt niet handelen';
  end if;

  select array_agg(id order by sort_order), array_agg(q order by sort_order)
    into v_ids, v_q from outcomes where market_id = v_mkt.id;
  v_i := array_position(v_ids, p_outcome);
  v_q2 := v_q; v_q2[v_i] := v_q2[v_i] + p_shares;
  v_cost := lmsr_cost(v_q2, v_mkt.b) - lmsr_cost(v_q, v_mkt.b);

  -- slippage: kopen = maximaal te betalen; verkopen = negatief, minimale opbrengst als -p_max_cost
  if v_cost > p_max_cost then raise exception 'De prijs is veranderd, vraag een nieuwe offerte'; end if;

  select coalesce(sum(shares), 0) into v_held from positions
   where user_id = v_user and outcome_id = p_outcome;
  if v_held + p_shares < 0 then raise exception 'Je hebt niet genoeg aandelen'; end if;

  select balance into v_bal from profiles where id = v_user for update;
  if v_cost > v_bal then raise exception 'Te weinig punten'; end if;

  update outcomes set q = v_q2[v_i] where id = p_outcome;
  update profiles set balance = balance - v_cost where id = v_user;
  insert into positions (user_id, outcome_id, market_id, shares, net_spent)
       values (v_user, p_outcome, v_mkt.id, p_shares, v_cost)
  on conflict (user_id, outcome_id) do update
       set shares = positions.shares + excluded.shares,
           net_spent = positions.net_spent + excluded.net_spent;

  insert into trades (user_id, market_id, outcome_id, shares, cost, prob_before, prob_after, probs_after)
  values (v_user, v_mkt.id, p_outcome, p_shares, v_cost,
          lmsr_prob(v_q, v_mkt.b, v_i), lmsr_prob(v_q2, v_mkt.b, v_i),
          (select array_agg(lmsr_prob(v_q2, v_mkt.b, n::int) order by n)
             from generate_subscripts(v_q2, 1) as n))
  returning * into v_trade;

  insert into ledger_entries (user_id, amount, kind, trade_id, market_id)
  values (v_user, -v_cost, 'trade', v_trade.id, v_mkt.id);
  return v_trade;
end $$;

-- ===== Beheer (alleen admins) =====
create or replace function create_market(
  p_title text, p_description text, p_criteria text, p_source text,
  p_b numeric, p_outcomes text[], p_opens_at timestamptz, p_closes_at timestamptz, p_open boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; i int;
begin
  if not is_admin() then raise exception 'Alleen beheerders'; end if;
  if array_length(p_outcomes, 1) not between 2 and 5 then raise exception 'Geef 2 tot 5 uitkomsten op'; end if;
  insert into markets (title, description, resolution_criteria, resolution_source, b, status, opens_at, closes_at, created_by)
  values (p_title, p_description, p_criteria, p_source, p_b,
          case when p_open then 'open'::market_status else 'draft' end, p_opens_at, p_closes_at, auth.uid())
  returning id into v_id;
  for i in 1 .. array_length(p_outcomes, 1) loop
    insert into outcomes (market_id, label, sort_order) values (v_id, p_outcomes[i], i);
  end loop;
  return v_id;
end $$;

create or replace function set_market_status(p_market uuid, p_status market_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_old market_status;
begin
  if not is_admin() then raise exception 'Alleen beheerders'; end if;
  select status into v_old from markets where id = p_market for update;
  if not ((v_old = 'draft' and p_status = 'open') or (v_old = 'open' and p_status = 'closed')
          or (v_old = 'closed' and p_status = 'open')) then
    raise exception 'Deze statuswijziging kan niet (% naar %)', v_old, p_status;
  end if;
  update markets set status = p_status where id = p_market;
end $$;

create or replace function resolve_market(p_market uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status market_status; r record;
begin
  if not is_admin() then raise exception 'Alleen beheerders'; end if;
  select status into v_status from markets where id = p_market for update;
  if v_status not in ('open','closed') then raise exception 'Deze markt kan niet meer worden afgesloten'; end if;
  if not exists (select 1 from outcomes where id = p_winner and market_id = p_market) then
    raise exception 'Deze uitkomst hoort niet bij de markt';
  end if;
  for r in select user_id, shares from positions where outcome_id = p_winner and shares > 0 loop
    update profiles set balance = balance + r.shares where id = r.user_id;
    insert into ledger_entries (user_id, amount, kind, market_id) values (r.user_id, r.shares, 'payout', p_market);
  end loop;
  update markets set status = 'resolved', winning_outcome_id = p_winner,
         resolved_at = now(), resolved_by = auth.uid() where id = p_market;
end $$;

create or replace function cancel_market(p_market uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status market_status; r record; v_amt numeric;
begin
  if not is_admin() then raise exception 'Alleen beheerders'; end if;
  select status into v_status from markets where id = p_market for update;
  if v_status not in ('draft','open','closed') then raise exception 'Deze markt kan niet meer worden geannuleerd'; end if;
  for r in select p.user_id, sum(p.net_spent) as net from positions p
            where p.market_id = p_market group by p.user_id loop
    -- net kan negatief zijn (winst door verkopen); nooit onder 0 punten
    select greatest(r.net, -balance) into v_amt from profiles where id = r.user_id for update;
    if v_amt <> 0 then
      update profiles set balance = balance + v_amt where id = r.user_id;
      insert into ledger_entries (user_id, amount, kind, market_id) values (r.user_id, v_amt, 'refund', p_market);
    end if;
  end loop;
  update markets set status = 'cancelled' where id = p_market;
end $$;

-- ===== Lezen voor iedereen (zonder privégegevens) =====
create or replace function get_price_history(p_market uuid)
returns table (created_at timestamptz, probs_after numeric[])
language sql stable security definer set search_path = public as $$
  select t.created_at, t.probs_after from trades t
  join markets m on m.id = t.market_id
  where t.market_id = p_market and m.status <> 'draft'
  order by t.created_at
$$;

create or replace function get_leaderboard()
returns table (user_id uuid, display_name text, balance numeric, open_value numeric, total numeric)
language sql stable security definer set search_path = public as $$
  with pv as (
    select p.user_id, sum(p.shares * op.prob) as v
    from positions p
    join outcome_prices op on op.outcome_id = p.outcome_id
    join markets m on m.id = p.market_id and m.status in ('open','closed')
    group by p.user_id
  )
  select pr.id, pr.display_name, pr.balance, coalesce(pv.v, 0), pr.balance + coalesce(pv.v, 0)
  from profiles pr left join pv on pv.user_id = pr.id
  order by 5 desc
$$;

-- ===== Onderhoud =====
create or replace function weekly_topup() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, least(100, 1000 - balance) as amt from profiles where balance < 1000 loop
    update profiles set balance = balance + r.amt where id = r.id;
    insert into ledger_entries (user_id, amount, kind) values (r.id, r.amt, 'topup');
  end loop;
end $$;

create or replace function check_ledger()
returns table (user_id uuid, balance numeric, ledger_sum numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.balance, coalesce(sum(l.amount), 0)
  from profiles p left join ledger_entries l on l.user_id = p.id
  group by p.id, p.balance
  having p.balance <> coalesce(sum(l.amount), 0)
$$;

-- ===== RLS =====
alter table profiles enable row level security;
alter table markets enable row level security;
alter table outcomes enable row level security;
alter table positions enable row level security;
alter table trades enable row level security;
alter table ledger_entries enable row level security;
alter table market_exclusions enable row level security;

create policy "profielen leesbaar" on profiles for select to authenticated using (true);
create policy "eigen naam wijzigen" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (display_name) on profiles to authenticated;

create policy "markten leesbaar" on markets for select to authenticated
  using (status <> 'draft' or is_admin());
create policy "uitkomsten leesbaar" on outcomes for select to authenticated
  using (exists (select 1 from markets m where m.id = market_id and (m.status <> 'draft' or is_admin())));

create policy "eigen posities" on positions for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "eigen trades" on trades for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "eigen grootboek" on ledger_entries for select to authenticated using (user_id = auth.uid() or is_admin());

create policy "uitsluitingen admin" on market_exclusions for all to authenticated
  using (is_admin()) with check (is_admin());

-- Functies: alleen ingelogde gebruikers
revoke execute on all functions in schema public from anon;
