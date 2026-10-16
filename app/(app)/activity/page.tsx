import { createClient } from "@/lib/supabase/server";
import { mapTradeRow } from "@/lib/activity";
import { ActivityFeed, type MarketOption, type SummaryOutcome } from "@/components/ActivityFeed";

const PAGE_SIZE = 25;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; outcome?: string; side?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const marketId = params.market ?? null;
  const outcomeId = params.outcome ?? null;
  const side = params.side === "buy" || params.side === "sell" ? params.side : null;
  const onlyMine = params.mine === "1";

  const supabase = await createClient();

  const [{ data: markets }, { data: outcomes }, { data: tradesData }] = await Promise.all([
    supabase.from("markets").select("id, title").neq("status", "draft").order("title"),
    supabase.from("outcomes").select("id, market_id, label, sort_order").order("sort_order"),
    supabase.rpc("get_public_trades", {
      p_market: marketId ?? undefined,
      p_outcome: outcomeId ?? undefined,
      p_side: side ?? undefined,
      p_only_mine: onlyMine,
      p_limit: PAGE_SIZE,
    }),
  ]);

  const marketOptions: MarketOption[] = (markets ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    outcomes: (outcomes ?? [])
      .filter((o) => o.market_id === m.id)
      .map((o) => ({ id: o.id, label: o.label, sortOrder: o.sort_order })),
  }));

  const initialRows = (tradesData ?? []).map(mapTradeRow);

  let initialSummary: SummaryOutcome[] | null = null;
  if (marketId) {
    const { data: statsRows } = await supabase.rpc("get_market_stats", { p_market: marketId });
    const stats = statsRows?.[0];
    if (stats) {
      const rawOutcomes =
        (stats.outcomes as unknown as Array<{
          label: string;
          prob: number;
          holders: number;
          volume_24h: number;
        }>) ?? [];
      initialSummary = rawOutcomes.map((o) => ({
        label: o.label,
        prob: Number(o.prob),
        holders: o.holders,
        volume24h: Number(o.volume_24h),
      }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Logboek</h1>
        <p className="mt-1 text-muted">
          Alle transacties van iedereen. Zie wat medestudenten verwachten, en waarom kansen
          bewegen.
        </p>
      </div>
      <ActivityFeed
        key={`${marketId ?? "all"}-${outcomeId ?? "all"}-${side ?? "all"}-${onlyMine}`}
        initialRows={initialRows}
        initialHasMore={initialRows.length >= PAGE_SIZE}
        initialSummary={initialSummary}
        filters={{ marketId, outcomeId, side, onlyMine }}
        marketOptions={marketOptions}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
