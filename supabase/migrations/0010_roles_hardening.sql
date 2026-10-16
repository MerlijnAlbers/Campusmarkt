-- ============================================================
-- Rollenhardening: precies één beheerder, strikte scheiding speler/beheerder op
-- database-, server- en UI-niveau. Zie de audit in het gesprek voor de aanleiding.
-- ============================================================

-- ===== 1. Precies één beheerder, alleen via SQL toe te wijzen =====
create unique index if not exists only_one_admin on profiles ((role)) where role = 'admin';

-- handle_new_user mag nooit zelf een rol kiezen; nieuwe accounts zijn altijd speler.
-- (Vervangt de vorige primary_admin_email()-aanpak, die een echt e-mailadres hardcodede in de
-- trigger. De beheerder wijst zichzelf voortaan eenmalig aan via SQL, zie README.)
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

drop function if exists primary_admin_email();

-- ===== 2. Profielen: spelers zien alleen hun eigen rij =====
drop policy if exists "profielen leesbaar" on profiles;
create policy "eigen profiel of admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

revoke update on profiles from authenticated, anon;
grant update (display_name, show_name_in_feed) on profiles to authenticated;

-- ===== 3. Blokkeren =====
alter table profiles add column if not exists is_blocked boolean not null default false;
alter table profiles add column if not exists blocked_reason text;

-- ===== 4. MFA-check voor beheerfuncties =====
create or replace function is_admin_mfa() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- ===== 5. Auditlog van beheeracties =====
create table if not exists admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid not null references profiles(id),
  action text not null,
  market_id uuid references markets(id),
  target_user uuid references profiles(id),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table admin_actions enable row level security;
drop policy if exists "alleen admin leest" on admin_actions;
create policy "alleen admin leest" on admin_actions for select to authenticated using (is_admin());
-- Geen insert/update/delete-policies: alleen beheerfuncties (security definer) schrijven hierin.

-- ===== 6. place_trade: geblokkeerde spelers weigeren =====
-- (De beheerder mag wel handelen; diens trades krijgen een eigen presentatie in
-- get_public_trades hieronder, niet een blokkade hier.)
create or replace function place_trade(p_outcome uuid, p_shares numeric, p_max_cost numeric)
returns trades language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_blocked boolean;
  v_mkt markets%rowtype;
  v_ids uuid[]; v_q numeric[]; v_q2 numeric[]; v_i int;
  v_cost numeric; v_held numeric; v_bal numeric;
  v_trade trades%rowtype;
begin
  if v_user is null then raise exception 'Niet ingelogd'; end if;
  if p_shares = 0 then raise exception 'Aantal mag niet 0 zijn'; end if;

  select is_blocked into v_blocked from profiles where id = v_user;
  if v_blocked then
    raise exception 'Je account is geblokkeerd. Neem contact op met de beheerder.';
  end if;

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

  if v_cost > p_max_cost then raise exception 'De prijs is veranderd, vraag een nieuwe offerte'; end if;

  select coalesce(sum(shares), 0) into v_held from positions
   where user_id = v_user and outcome_id = p_outcome;
  if v_held + p_shares < 0 then raise exception 'Je hebt niet genoeg aandelen'; end if;

  select balance into v_bal from profiles where id = v_user for update;
  if v_cost > v_bal then raise exception 'Te weinig punten'; end if;

  update outcomes set q = v_q2[v_i] where id = p_outcome;
  update profiles set balance = balance - v_cost where id = v_user;

  if exists (select 1 from positions where user_id = v_user and outcome_id = p_outcome) then
    update positions set shares = shares + p_shares, net_spent = net_spent + v_cost
     where user_id = v_user and outcome_id = p_outcome;
  else
    insert into positions (user_id, outcome_id, market_id, shares, net_spent)
         values (v_user, p_outcome, v_mkt.id, p_shares, v_cost);
  end if;

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

-- ===== 7. Openbaar logboek: beheerderstrades gemarkeerd, admin ziet wie anoniem is =====
create or replace function get_public_trades(
  p_market uuid default null,
  p_outcome uuid default null,
  p_side text default null,
  p_only_mine boolean default false,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50)
returns table (
  id uuid, created_at timestamptz,
  market_id uuid, market_title text,
  outcome_id uuid, outcome_label text, outcome_sort int,
  side text, shares numeric, points numeric, avg_price numeric,
  prob_before numeric, prob_after numeric,
  trader_name text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.created_at, m.id, m.title, o.id, o.label, o.sort_order,
         case when t.shares > 0 then 'buy' else 'sell' end,
         abs(t.shares), abs(t.cost), abs(t.cost) / nullif(abs(t.shares), 0),
         t.prob_before, t.prob_after,
         case
           when pr.role = 'admin' then 'Beheerder'
           when pr.show_name_in_feed or pr.id = auth.uid() or is_admin() then pr.display_name
           else 'Anonieme student'
         end,
         pr.id = auth.uid()
  from trades t
  join markets m on m.id = t.market_id
  join outcomes o on o.id = t.outcome_id
  join profiles pr on pr.id = t.user_id
  where auth.uid() is not null
    and m.status <> 'draft'
    and (p_market is null or t.market_id = p_market)
    and (p_outcome is null or t.outcome_id = p_outcome)
    and (p_side is null or (p_side = 'buy' and t.shares > 0) or (p_side = 'sell' and t.shares < 0))
    and (not p_only_mine or t.user_id = auth.uid())
    and (p_before_at is null or (t.created_at, t.id) < (p_before_at, p_before_id))
  order by t.created_at desc, t.id desc
  limit least(greatest(p_limit, 1), 200)
$$;

-- ===== 8. Klassement zonder user_id van anderen =====
-- (drop vereist: de kolomvorm verandert van user_id naar is_me)
drop function if exists get_leaderboard();
drop function if exists get_leaderboard_this_month();

create or replace function get_leaderboard()
returns table (is_me boolean, display_name text, balance numeric, open_value numeric, total numeric)
language sql stable security definer set search_path = public as $$
  with pv as (
    select p.user_id, sum(p.shares * op.prob) as v
    from positions p
    join outcome_prices op on op.outcome_id = p.outcome_id
    join markets m on m.id = p.market_id and m.status in ('open','closed')
    group by p.user_id
  )
  select pr.id = auth.uid(), pr.display_name, pr.balance, coalesce(pv.v, 0), pr.balance + coalesce(pv.v, 0)
  from profiles pr left join pv on pv.user_id = pr.id
  order by 5 desc
$$;

create or replace function get_leaderboard_this_month()
returns table (is_me boolean, display_name text, amount numeric)
language sql stable security definer set search_path = public as $$
  select pr.id = auth.uid(), pr.display_name, coalesce(sum(l.amount), 0) as amount
  from profiles pr
  left join ledger_entries l
    on l.user_id = pr.id
    and l.created_at >= date_trunc('month', now())
  group by pr.id, pr.display_name
  order by 3 desc
$$;

-- ===== 9. Beheerfuncties: is_admin_mfa() i.p.v. is_admin(), auditlog, "Geen toegang" =====
create or replace function create_market(
  p_title text, p_description text, p_criteria text, p_source text,
  p_b numeric, p_outcomes text[], p_opens_at timestamptz, p_closes_at timestamptz, p_open boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; i int;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  if array_length(p_outcomes, 1) not between 2 and 5 then raise exception 'Geef 2 tot 5 uitkomsten op'; end if;
  insert into markets (title, description, resolution_criteria, resolution_source, b, status, opens_at, closes_at, created_by)
  values (p_title, p_description, p_criteria, p_source, p_b,
          case when p_open then 'open'::market_status else 'draft' end, p_opens_at, p_closes_at, auth.uid())
  returning id into v_id;
  for i in 1 .. array_length(p_outcomes, 1) loop
    insert into outcomes (market_id, label, sort_order) values (v_id, p_outcomes[i], i);
  end loop;
  insert into admin_actions (admin_id, action, market_id, details)
  values (auth.uid(), 'create_market', v_id, jsonb_build_object('title', p_title, 'open', p_open));
  return v_id;
end $$;

create or replace function set_market_status(p_market uuid, p_status market_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_old market_status;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  select status into v_old from markets where id = p_market for update;
  if not ((v_old = 'draft' and p_status = 'open') or (v_old = 'open' and p_status = 'closed')
          or (v_old = 'closed' and p_status = 'open')) then
    raise exception 'Deze statuswijziging kan niet (% naar %)', v_old, p_status;
  end if;
  update markets set status = p_status where id = p_market;
  insert into admin_actions (admin_id, action, market_id, details)
  values (auth.uid(), 'set_status', p_market, jsonb_build_object('from', v_old, 'to', p_status));
end $$;

create or replace function resolve_market(p_market uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status market_status; r record; v_total_payout numeric := 0; v_n_winners int := 0;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  select status into v_status from markets where id = p_market for update;
  if v_status not in ('open','closed') then raise exception 'Deze markt kan niet meer worden afgesloten'; end if;
  if not exists (select 1 from outcomes where id = p_winner and market_id = p_market) then
    raise exception 'Deze uitkomst hoort niet bij de markt';
  end if;
  for r in select user_id, shares from positions where outcome_id = p_winner and shares > 0 loop
    update profiles set balance = balance + r.shares where id = r.user_id;
    insert into ledger_entries (user_id, amount, kind, market_id) values (r.user_id, r.shares, 'payout', p_market);
    v_total_payout := v_total_payout + r.shares;
    v_n_winners := v_n_winners + 1;
  end loop;
  update markets set status = 'resolved', winning_outcome_id = p_winner,
         resolved_at = now(), resolved_by = auth.uid() where id = p_market;
  insert into admin_actions (admin_id, action, market_id, details)
  values (auth.uid(), 'resolve_market', p_market,
          jsonb_build_object('winner', p_winner, 'winners', v_n_winners, 'total_payout', v_total_payout));
end $$;

create or replace function cancel_market(p_market uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status market_status; r record; v_amt numeric; v_total numeric := 0; v_n int := 0;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  select status into v_status from markets where id = p_market for update;
  if v_status not in ('draft','open','closed') then raise exception 'Deze markt kan niet meer worden geannuleerd'; end if;
  for r in select p.user_id, sum(p.net_spent) as net from positions p
            where p.market_id = p_market group by p.user_id loop
    select greatest(r.net, -balance) into v_amt from profiles where id = r.user_id for update;
    if v_amt <> 0 then
      update profiles set balance = balance + v_amt where id = r.user_id;
      insert into ledger_entries (user_id, amount, kind, market_id) values (r.user_id, v_amt, 'refund', p_market);
      v_total := v_total + v_amt;
      v_n := v_n + 1;
    end if;
  end loop;
  update markets set status = 'cancelled' where id = p_market;
  insert into admin_actions (admin_id, action, market_id, details)
  values (auth.uid(), 'cancel_market', p_market, jsonb_build_object('refunded_users', v_n, 'total_refund', v_total));
end $$;

create or replace function delete_market(p_market uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_trades int;
  v_ledger int;
  v_title text;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;

  select count(*) into v_trades from trades where market_id = p_market;
  select count(*) into v_ledger from ledger_entries where market_id = p_market;
  if v_trades > 0 or v_ledger > 0 then
    raise exception 'Deze markt heeft al activiteit (trades of grootboekregels); annuleer hem in plaats van te verwijderen';
  end if;

  select title into v_title from markets where id = p_market;
  delete from market_exclusions where market_id = p_market;
  delete from outcomes where market_id = p_market;
  delete from markets where id = p_market;

  insert into admin_actions (admin_id, action, details)
  values (auth.uid(), 'delete_market', jsonb_build_object('market_id', p_market, 'title', v_title));
end $$;

create or replace function check_ledger()
returns table (user_id uuid, balance numeric, ledger_sum numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  return query
    select p.id, p.balance, coalesce(sum(l.amount), 0)
    from profiles p left join ledger_entries l on l.user_id = p.id
    group by p.id, p.balance
    having p.balance <> coalesce(sum(l.amount), 0);
end $$;

-- ===== 10. Uitsluitingen: alleen via beheerfuncties schrijven, RLS wordt alleen-lezen =====
drop policy if exists "uitsluitingen admin" on market_exclusions;
create policy "admin leest uitsluitingen" on market_exclusions for select to authenticated using (is_admin());

create or replace function admin_add_exclusion(p_market uuid, p_user uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  insert into market_exclusions (market_id, user_id, reason) values (p_market, p_user, p_reason)
  on conflict (market_id, user_id) do update set reason = excluded.reason;
  insert into admin_actions (admin_id, action, market_id, target_user, details)
  values (auth.uid(), 'exclude', p_market, p_user, jsonb_build_object('reason', p_reason));
end $$;

create or replace function admin_remove_exclusion(p_market uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  delete from market_exclusions where market_id = p_market and user_id = p_user;
  insert into admin_actions (admin_id, action, market_id, target_user)
  values (auth.uid(), 'unexclude', p_market, p_user);
end $$;

-- ===== 11. Nieuwe beheerfuncties: gebruikers, blokkeren, correcties, auditlog =====
create or replace function admin_list_users()
returns table (
  user_id uuid, display_name text, email text, balance numeric,
  is_blocked boolean, blocked_reason text, created_at timestamptz,
  last_trade_at timestamptz, trade_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  return query
    select pr.id, pr.display_name, pr.email, pr.balance, pr.is_blocked, pr.blocked_reason,
           pr.created_at, max(t.created_at), count(t.id)
    from profiles pr
    left join trades t on t.user_id = pr.id
    where pr.role = 'student'
    group by pr.id, pr.display_name, pr.email, pr.balance, pr.is_blocked, pr.blocked_reason, pr.created_at
    order by pr.display_name;
end $$;

create or replace function admin_set_blocked(p_user uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  if p_user = auth.uid() then raise exception 'Je kunt jezelf niet blokkeren'; end if;
  if p_blocked and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'Geef een reden op om te blokkeren';
  end if;

  update profiles set is_blocked = p_blocked, blocked_reason = case when p_blocked then p_reason else null end
   where id = p_user;

  insert into admin_actions (admin_id, action, target_user, details)
  values (auth.uid(), case when p_blocked then 'block' else 'unblock' end, p_user,
          jsonb_build_object('reason', p_reason));
end $$;

create or replace function admin_adjust_points(p_user uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'Geef een reden van minstens 10 tekens op';
  end if;
  if p_amount = 0 or p_amount < -1000 or p_amount > 1000 then
    raise exception 'Bedrag moet tussen -1.000 en 1.000 liggen, en niet 0';
  end if;

  select balance into v_bal from profiles where id = p_user for update;
  if v_bal is null then raise exception 'Onbekende speler'; end if;
  if v_bal + p_amount < 0 then raise exception 'Saldo kan niet onder 0 komen'; end if;

  update profiles set balance = balance + p_amount where id = p_user;
  insert into ledger_entries (user_id, amount, kind) values (p_user, p_amount, 'adjustment');

  insert into admin_actions (admin_id, action, target_user, details)
  values (auth.uid(), 'adjust_points', p_user, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;

create or replace function admin_list_actions(p_limit int default 100)
returns table (
  id bigint, admin_id uuid, admin_name text, action text,
  market_id uuid, market_title text, target_user uuid, target_name text,
  details jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_mfa() then raise exception 'Geen toegang'; end if;
  return query
    select a.id, a.admin_id, pa.display_name, a.action, a.market_id, m.title,
           a.target_user, pt.display_name, a.details, a.created_at
    from admin_actions a
    left join profiles pa on pa.id = a.admin_id
    left join markets m on m.id = a.market_id
    left join profiles pt on pt.id = a.target_user
    order by a.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;

-- ===== 12. Functierechten: standaard dicht, dan een expliciete allowlist =====
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Spelers (en de beheerder, die ook speler-functies mag gebruiken):
grant execute on function
  place_trade(uuid, numeric, numeric),
  get_public_trades(uuid, uuid, text, boolean, timestamptz, uuid, int),
  get_market_stats(uuid),
  get_price_history(uuid),
  get_leaderboard(),
  get_leaderboard_this_month(),
  lmsr_cost(numeric[], numeric),
  lmsr_prob(numeric[], numeric, int),
  is_admin()
to authenticated;

-- Beheerfuncties: uitvoerbaar voor authenticated, maar elke functie begint zelf met
-- is_admin_mfa(), dus een speler (of een admin zonder MFA) krijgt altijd "Geen toegang".
grant execute on function
  create_market(text, text, text, text, numeric, text[], timestamptz, timestamptz, boolean),
  set_market_status(uuid, market_status),
  resolve_market(uuid, uuid),
  cancel_market(uuid),
  delete_market(uuid),
  check_ledger(),
  admin_add_exclusion(uuid, uuid, text),
  admin_remove_exclusion(uuid, uuid),
  admin_list_users(),
  admin_set_blocked(uuid, boolean, text),
  admin_adjust_points(uuid, numeric, text),
  admin_list_actions(int)
to authenticated;

-- Nooit voor de client (alleen intern, of alleen pg_cron als eigenaar postgres):
-- allowed_email_domain(), handle_new_user(), is_admin_mfa(), weekly_topup(),
-- run_weekly_topup_if_due() blijven dicht (geen grant hierboven).
