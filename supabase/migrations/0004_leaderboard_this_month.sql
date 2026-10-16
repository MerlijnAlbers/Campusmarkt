-- Klassement "Deze maand", gebaseerd op grootboekmutaties sinds de 1e van de huidige maand.
-- (get_leaderboard() uit migratie 0001 dekt alleen het totaalklassement.)
create or replace function get_leaderboard_this_month()
returns table (user_id uuid, display_name text, amount numeric)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, coalesce(sum(l.amount), 0) as amount
  from profiles pr
  left join ledger_entries l
    on l.user_id = pr.id
    and l.created_at >= date_trunc('month', now())
  group by pr.id, pr.display_name
  order by 3 desc
$$;

revoke execute on function get_leaderboard_this_month() from anon;
