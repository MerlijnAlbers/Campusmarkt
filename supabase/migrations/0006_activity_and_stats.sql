-- Openbaar logboek en markttegel-statistieken. Alleen-lezen: deze migratie voegt geen nieuwe
-- manieren toe om saldo's, posities, trades of het grootboek te wijzigen.

-- ===== Zichtbaarheid in het logboek =====
-- Standaard staat je bijnaam zichtbaar; je kunt in je profiel kiezen voor "Toon mij als anonieme
-- student".
alter table profiles add column show_name_in_feed boolean not null default true;
grant update (show_name_in_feed) on profiles to authenticated;

create index if not exists trades_created_at_idx on trades (created_at desc, id desc);

-- ===== Openbaar logboek (keyset-paginering) =====
create or replace function get_public_trades(
  p_market uuid default null,
  p_outcome uuid default null,
  p_side text default null,              -- 'buy' | 'sell' | null
  p_only_mine boolean default false,
  p_before_at timestamptz default null,  -- paginering: created_at van de laatste rij
  p_before_id uuid default null,         -- paginering: id van de laatste rij
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
         case when pr.show_name_in_feed or pr.id = auth.uid() then pr.display_name
              else 'Anonieme student' end,
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

revoke execute on function get_public_trades(uuid, uuid, text, boolean, timestamptz, uuid, int) from anon;

-- ===== Markttegel-statistieken =====
create or replace function get_market_stats(p_market uuid default null)
returns table (
  market_id uuid,
  status market_status,
  closes_at timestamptz,
  b numeric,
  n_outcomes int,
  market_value numeric,
  pot numeric,
  volume_total numeric,
  volume_24h numeric,
  trade_count bigint,
  trader_count bigint,
  last_trade_at timestamptz,
  outcomes jsonb,
  spark numeric[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  mkt record;
  v_ids uuid[];
  v_labels text[];
  v_q numeric[];
  v_probs numeric[];
  v_n int;
  v_baseline numeric[];
  v_last_probs numeric[];
  v_change numeric[];
  v_holders int[];
  v_leading int;
  v_outcomes_json jsonb;
  v_spark numeric[];
begin
  for mkt in
    select mk.id, mk.status, mk.closes_at, mk.b
    from markets mk
    where (p_market is null or mk.id = p_market)
      and (mk.status <> 'draft' or is_admin())
  loop
    select array_agg(o.id order by o.sort_order),
           array_agg(o.label order by o.sort_order),
           array_agg(o.q order by o.sort_order)
      into v_ids, v_labels, v_q
      from outcomes o where o.market_id = mkt.id;

    v_n := coalesce(array_length(v_ids, 1), 0);
    if v_n = 0 then
      continue;
    end if;

    select array_agg(op.prob order by op.sort_order) into v_probs
      from outcome_prices op where op.market_id = mkt.id;

    select t.probs_after into v_last_probs
      from trades t
      where t.market_id = mkt.id and t.created_at <= now() - interval '24 hours'
      order by t.created_at desc limit 1;
    if v_last_probs is null then
      v_baseline := array(select 1.0 / v_n from generate_series(1, v_n));
    else
      v_baseline := v_last_probs;
    end if;
    v_change := array(select v_probs[g] - v_baseline[g] from generate_series(1, v_n) g);

    v_holders := array(
      select (select count(*)::int from positions p
               where p.outcome_id = v_ids[g] and p.shares > 0)
      from generate_series(1, v_n) g
    );

    select g into v_leading from generate_series(1, v_n) g order by v_probs[g] desc limit 1;

    v_outcomes_json := (
      select jsonb_agg(jsonb_build_object(
               'outcome_id', v_ids[g],
               'label', v_labels[g],
               'prob', v_probs[g],
               'change_24h', v_change[g],
               'holders', v_holders[g]
             ) order by g)
      from generate_series(1, v_n) g
    );

    v_spark := array(
      select coalesce(
               (select t.probs_after[v_leading]
                  from trades t
                  where t.market_id = mkt.id
                    and t.created_at <= (now() - interval '7 days') + (k::numeric / 19) * interval '7 days'
                  order by t.created_at desc limit 1),
               1.0 / v_n
             )
      from generate_series(0, 19) k
    );

    market_id := mkt.id;
    status := mkt.status;
    closes_at := mkt.closes_at;
    b := mkt.b;
    n_outcomes := v_n;
    market_value := (select sum(v_q[g] * v_probs[g]) from generate_series(1, v_n) g);
    pot := lmsr_cost(v_q, mkt.b) - mkt.b * ln(v_n);
    select coalesce(sum(abs(cost)), 0) into volume_total from trades where trades.market_id = mkt.id;
    select coalesce(sum(abs(cost)), 0) into volume_24h from trades
      where trades.market_id = mkt.id and created_at >= now() - interval '24 hours';
    select count(*) into trade_count from trades where trades.market_id = mkt.id;
    select count(distinct user_id) into trader_count from trades where trades.market_id = mkt.id;
    select max(created_at) into last_trade_at from trades where trades.market_id = mkt.id;
    outcomes := v_outcomes_json;
    spark := v_spark;

    return next;
  end loop;
end $$;

revoke execute on function get_market_stats(uuid) from anon;
