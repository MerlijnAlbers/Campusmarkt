import { createClient } from "@/lib/supabase/server";
import { P } from "@/lib/lmsr";
import { MarketCard, type MarketCardData } from "@/components/MarketCard";

const STATUS_PRIORITY: Record<string, number> = { open: 0, closed: 1, resolved: 2, cancelled: 3 };

export default async function MarketsOverviewPage() {
  const supabase = await createClient();

  const { data: markets } = await supabase.from("markets").select("*").order("closes_at");
  const { data: allOutcomes } = await supabase
    .from("outcomes")
    .select("*")
    .order("sort_order");

  const sorted = (markets ?? [])
    .slice()
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  const cards: MarketCardData[] = await Promise.all(
    sorted.map(async (m) => {
      const outcomes = (allOutcomes ?? []).filter((o) => o.market_id === m.id);
      const probs = P(outcomes.map((o) => Number(o.q)), m.b);
      const { data: history } = await supabase.rpc("get_price_history", { p_market: m.id });

      return {
        id: m.id,
        title: m.title,
        status: m.status,
        closesAt: m.closes_at,
        winningOutcomeId: m.winning_outcome_id,
        outcomes: outcomes.map((o, i) => ({ id: o.id, label: o.label, prob: probs[i] })),
        tradeCount: history?.length ?? 0,
      };
    }),
  );

  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-ink">Markten</h1>
      {cards.length === 0 ? (
        <p className="mt-4 text-muted">Nog geen open markten.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </section>
  );
}
