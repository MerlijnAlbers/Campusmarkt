import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { formatDateTime, formatPointsShort } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/constants";
import { MarketLive } from "@/components/MarketLive";
import { ActivityFeed } from "@/components/ActivityFeed";
import { mapTradeRow } from "@/lib/activity";

const RECENT_TRADES_LIMIT = 10;

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();

  const [{ data: balanceRow }, { data: market }, { data: outcomes }, { data: positions }, { data: history }, { data: recentTrades }] =
    await Promise.all([
      supabase.from("profiles").select("balance").eq("id", viewer.userId).single(),
      supabase.from("markets").select("*").eq("id", id).maybeSingle(),
      supabase.from("outcomes").select("*").eq("market_id", id).order("sort_order"),
      supabase.from("positions").select("*").eq("market_id", id),
      supabase.rpc("get_price_history", { p_market: id }),
      supabase.rpc("get_public_trades", { p_market: id, p_limit: RECENT_TRADES_LIMIT }),
    ]);

  if (!market || !outcomes || outcomes.length === 0) {
    return (
      <section>
        <h1 className="font-display text-2xl font-bold text-ink">Markt niet gevonden</h1>
        <p className="mt-2 text-muted">
          Deze markt bestaat niet (meer), of je hebt er geen toegang tot.
        </p>
      </section>
    );
  }

  const n = outcomes.length;
  const heldShares: Record<string, number> = {};
  const netSpent: Record<string, number> = {};
  for (const p of positions ?? []) {
    heldShares[p.outcome_id] = Number(p.shares);
    netSpent[p.outcome_id] = Number(p.net_spent);
  }

  const initialHistory =
    history && history.length > 0
      ? history.map((row) => ({ createdAt: row.created_at!, probs: row.probs_after as number[] }))
      : [{ createdAt: market.created_at, probs: Array(n).fill(1 / n) }];

  const tradeCount = history?.length ?? 0;
  const maxLoss = market.b * Math.log(n);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-current px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {STATUS_LABELS[market.status] ?? market.status}
          </span>
          <span className="font-mono text-muted">
            b = {market.b} · {tradeCount} {tradeCount === 1 ? "transactie" : "transacties"} · max.
            verlies pot {formatPointsShort(maxLoss)} pnt
          </span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">{market.title}</h1>
        {market.description && <p className="mt-1 text-muted">{market.description}</p>}
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Resolutiecriteria</dt>
            <dd className="text-ink">{market.resolution_criteria}</dd>
          </div>
          <div>
            <dt className="text-muted">Bron</dt>
            <dd className="text-ink">{market.resolution_source}</dd>
          </div>
          <div>
            <dt className="text-muted">Sluit op</dt>
            <dd className="text-ink">{formatDateTime(market.closes_at)}</dd>
          </div>
        </dl>
      </section>

      <MarketLive
        marketId={market.id}
        b={market.b}
        status={market.status}
        winningOutcomeId={market.winning_outcome_id}
        initialOutcomes={outcomes.map((o) => ({ id: o.id, label: o.label, q: Number(o.q) }))}
        initialHistory={initialHistory}
        userName={viewer.displayName}
        userBalance={Number(balanceRow?.balance ?? 0)}
        heldShares={heldShares}
        netSpent={netSpent}
        isBlocked={viewer.isBlocked}
        blockedReason={viewer.blockedReason}
      />

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Laatste transacties
        </p>
        <ActivityFeed
          initialRows={(recentTrades ?? []).map(mapTradeRow)}
          initialHasMore={false}
          initialSummary={null}
          filters={{ marketId: market.id, outcomeId: null, side: null, onlyMine: false }}
          marketOptions={[]}
          showFilterBar={false}
          showExport={false}
          showLoadMore={false}
          moreHref={`/activity?market=${market.id}`}
          pageSize={RECENT_TRADES_LIMIT}
        />
      </section>
    </div>
  );
}
