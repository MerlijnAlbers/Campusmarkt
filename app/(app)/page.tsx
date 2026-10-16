import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { MarketCard, type MarketTileData } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { MarketFilters } from "@/components/MarketFilters";

type Status = "open" | "closed" | "resolved" | "all";
type Sort = "popular" | "new" | "closing" | "movers";

function parseStatus(value: string | undefined): Status {
  return value === "closed" || value === "resolved" || value === "all" ? value : "open";
}

function parseSort(value: string | undefined): Sort {
  return value === "new" || value === "closing" || value === "movers" ? value : "popular";
}

export default async function MarketsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const sort = parseSort(params.sort);
  const query = params.q ?? "";

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Markten</h1>
      <MarketFilters status={status} sort={sort} query={query} />
      <Suspense
        key={`${status}-${sort}-${query}`}
        fallback={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <MarketsGrid status={status} sort={sort} query={query} />
      </Suspense>
    </section>
  );
}

async function MarketsGrid({
  status,
  sort,
  query,
}: {
  status: Status;
  sort: Sort;
  query: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let marketsQuery = supabase.from("markets").select("*");
  if (status !== "all") {
    marketsQuery = marketsQuery.eq("status", status);
  } else {
    marketsQuery = marketsQuery.neq("status", "draft");
  }
  if (query.trim()) {
    marketsQuery = marketsQuery.ilike("title", `%${query.trim()}%`);
  }

  const [{ data: markets }, { data: stats }, { data: positions }] = await Promise.all([
    marketsQuery,
    supabase.rpc("get_market_stats"),
    supabase.from("positions").select("*, outcomes(label)").eq("user_id", user.id),
  ]);

  const statsByMarket = new Map((stats ?? []).map((s) => [s.market_id, s]));

  const myPositionByMarket = new Map<string, { label: string; shares: number }>();
  for (const p of positions ?? []) {
    const shares = Number(p.shares);
    if (shares <= 0) continue;
    const existing = myPositionByMarket.get(p.market_id);
    if (!existing || shares > existing.shares) {
      myPositionByMarket.set(p.market_id, { label: p.outcomes?.label ?? "", shares });
    }
  }

  const tiles: MarketTileData[] = (markets ?? [])
    .map((m) => {
      const s = statsByMarket.get(m.id);
      if (!s) return null;
      const outcomes = ((s.outcomes as unknown as Array<{
        outcome_id: string;
        label: string;
        prob: number;
        change_24h: number;
        holders: number;
        q: number;
      }>) ?? [])
        .map((o) => ({
          outcomeId: o.outcome_id,
          label: o.label,
          prob: Number(o.prob),
          change24h: Number(o.change_24h),
          holders: o.holders,
          q: Number(o.q),
        }));

      const tile: MarketTileData = {
        marketId: m.id,
        title: m.title,
        status: m.status,
        closesAt: m.closes_at,
        winningOutcomeId: m.winning_outcome_id,
        marketValue: Number(s.market_value),
        pot: Number(s.pot),
        volumeTotal: Number(s.volume_total),
        volume24h: Number(s.volume_24h),
        tradeCount: Number(s.trade_count),
        traderCount: Number(s.trader_count),
        outcomes,
        spark: (s.spark as unknown as number[]) ?? [],
        myPosition: myPositionByMarket.get(m.id) ?? null,
      };
      return tile;
    })
    .filter((t): t is MarketTileData => t !== null);

  const maxAbsChange = (t: MarketTileData) =>
    t.outcomes.reduce((max, o) => Math.max(max, Math.abs(o.change24h)), 0);
  const createdAtByMarket = new Map((markets ?? []).map((m) => [m.id, m.created_at]));

  tiles.sort((a, b) => {
    switch (sort) {
      case "new":
        return (
          new Date(createdAtByMarket.get(b.marketId) ?? 0).getTime() -
          new Date(createdAtByMarket.get(a.marketId) ?? 0).getTime()
        );
      case "closing":
        return new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime();
      case "movers":
        return maxAbsChange(b) - maxAbsChange(a);
      default:
        return b.volume24h - a.volume24h;
    }
  });

  if (tiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-10 text-center">
        <p className="text-muted">Geen markten gevonden.</p>
        <Link href="/" className="rounded-md border border-line px-4 py-2 text-sm hover:border-ink">
          Filters wissen
        </Link>
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => (
        <MarketCard key={tile.marketId} market={tile} />
      ))}
    </div>
  );
}
