import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPointsShort } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/constants";
import { AdminMarketActions } from "@/components/AdminMarketActions";
import { ExclusionsManager } from "@/components/ExclusionsManager";

export default async function AdminMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: market }, { data: outcomes }, { data: exclusions }, { data: students }, { count: tradeCount }] =
    await Promise.all([
      supabase.from("markets").select("*").eq("id", id).maybeSingle(),
      supabase.from("outcomes").select("*").eq("market_id", id).order("sort_order"),
      supabase.from("market_exclusions").select("*, profiles(display_name)").eq("market_id", id),
      supabase.from("profiles").select("id, display_name, email").eq("role", "student").order("display_name"),
      supabase.from("trades").select("*", { count: "exact", head: true }).eq("market_id", id),
    ]);

  if (!market || !outcomes) {
    return (
      <section>
        <h1 className="font-display text-2xl font-bold text-ink">Markt niet gevonden</h1>
      </section>
    );
  }

  const n = outcomes.length;
  const maxLoss = market.b * Math.log(n);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-current px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {STATUS_LABELS[market.status] ?? market.status}
          </span>
          <span className="font-mono text-muted">
            b = {market.b} · max. verlies pot {formatPointsShort(maxLoss)} pnt
          </span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">{market.title}</h1>
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
          <div>
            <dt className="text-muted">Uitkomsten</dt>
            <dd className="text-ink">{outcomes.map((o) => o.label).join(", ")}</dd>
          </div>
        </dl>
      </div>

      <AdminMarketActions
        marketId={market.id}
        status={market.status}
        outcomes={outcomes.map((o) => ({ id: o.id, label: o.label }))}
        tradeCount={tradeCount ?? 0}
      />

      <ExclusionsManager
        marketId={market.id}
        exclusions={(exclusions ?? []).map((e) => ({
          userId: e.user_id,
          displayName: e.profiles?.display_name ?? "?",
          reason: e.reason,
        }))}
        students={(students ?? []).map((s) => ({
          id: s.id,
          displayName: s.display_name,
          email: s.email,
        }))}
      />
    </section>
  );
}
