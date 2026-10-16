import { createClient } from "@/lib/supabase/server";
import { LeaderboardTabs } from "@/components/LeaderboardTabs";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: totalRows }, { data: monthRows }] = await Promise.all([
    supabase.rpc("get_leaderboard"),
    supabase.rpc("get_leaderboard_this_month"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Klassement</h1>
      <LeaderboardTabs
        totalRows={(totalRows ?? []).map((r) => ({
          isMe: r.is_me,
          displayName: r.display_name,
          balance: Number(r.balance),
          openValue: Number(r.open_value),
          total: Number(r.total),
        }))}
        monthRows={(monthRows ?? []).map((r) => ({
          isMe: r.is_me,
          displayName: r.display_name,
          amount: Number(r.amount),
        }))}
      />
    </div>
  );
}
