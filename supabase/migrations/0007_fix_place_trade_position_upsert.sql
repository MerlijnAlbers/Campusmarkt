-- Bugfix (gevonden tijdens het testen van get_market_stats, los van de v1.1-functionaliteit):
--
-- place_trade() gebruikte "insert ... on conflict (user_id, outcome_id) do update
-- set shares = positions.shares + excluded.shares" om een positie bij te werken. PostgreSQL
-- valideert CHECK-constraints echter al tegen de kale, voorgestelde rij (de "excluded"-waarden
-- zelf) vóórdat het conflict wordt opgelost. Bij een verkoop is p_shares negatief: zodra iemand
-- méér verkocht dan 0 maar minder dan wat hij had (bijv. 50 in bezit, 20 verkopen), werd de
-- voorgestelde rij met shares = -20 al afgekeurd door de check "shares >= 0", terwijl de
-- uiteindelijke optelling (50 - 20 = 30) wél geldig zou zijn. Elke verkoop die niet exact alle
-- aandelen verkocht (of een eerste aankoop was) faalde hierdoor met een technische
-- postgres-foutmelding in plaats van te slagen.
--
-- Dit was niet eerder opgevallen omdat geen van de bestaande pgTAP-tests een succesvolle
-- deelverkoop op een bestaand, positief saldo aandelen deed (scenario 3 verkoopt juist te veel,
-- wat al vóór deze insert wordt geweigerd).
--
-- Oplossing: expliciet insert-of-update i.p.v. "on conflict", zodat de check alleen tegen de
-- echte einduitkomst wordt getoetst.
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

  if exists (select 1 from positions where user_id = v_user and outcome_id = p_outcome) then
    update positions
       set shares = shares + p_shares,
           net_spent = net_spent + v_cost
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
