import { createClient } from "@/lib/supabase/server";
import { AdminUsersTable } from "@/components/AdminUsersTable";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("admin_list_users");

  const users = (rows ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    email: r.email,
    balance: Number(r.balance),
    isBlocked: r.is_blocked,
    blockedReason: r.blocked_reason,
    createdAt: r.created_at,
    lastTradeAt: r.last_trade_at,
    tradeCount: Number(r.trade_count),
  }));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Gebruikers</h1>
      <p className="text-sm text-muted">
        Blokkeren voorkomt handelen (meekijken blijft mogelijk); puntenaanpassingen zijn bedoeld
        voor correcties en verschijnen als zodanig in het grootboek en het auditlog.
      </p>
      {users.length > 0 ? (
        <AdminUsersTable users={users} />
      ) : (
        <p className="text-muted">Nog geen spelers.</p>
      )}
    </section>
  );
}
