import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { P } from "@/lib/lmsr";
import { formatDateTime, formatPointsShort } from "@/lib/format";
import { LEDGER_KIND_LABELS, STATUS_LABELS } from "@/lib/constants";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", user.id);

  const marketIds = [...new Set((positions ?? []).map((p) => p.market_id))];

  const [{ data: markets }, { data: outcomes }, { data: ledger }] = await Promise.all([
    marketIds.length
      ? supabase.from("markets").select("*").in("id", marketIds)
      : Promise.resolve({ data: [] as never[] }),
    marketIds.length
      ? supabase.from("outcomes").select("*").in("market_id", marketIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const marketsById = new Map((markets ?? []).map((m) => [m.id, m]));
  const outcomesByMarket = new Map<string, typeof outcomes>();
  for (const o of outcomes ?? []) {
    const list = outcomesByMarket.get(o.market_id) ?? [];
    list.push(o);
    outcomesByMarket.set(o.market_id, list);
  }

  const openRows: {
    marketId: string;
    title: string;
    label: string;
    shares: number;
    valueNow: number;
  }[] = [];
  const closedRows: {
    marketId: string;
    title: string;
    label: string;
    shares: number;
    netSpent: number;
    result: number;
    status: string;
  }[] = [];

  for (const marketId of marketIds) {
    const market = marketsById.get(marketId);
    if (!market) continue;
    const marketOutcomes = (outcomesByMarket.get(marketId) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const probs = P(marketOutcomes.map((o) => Number(o.q)), market.b);
    const marketPositions = (positions ?? []).filter((p) => p.market_id === marketId);

    for (const pos of marketPositions) {
      const idx = marketOutcomes.findIndex((o) => o.id === pos.outcome_id);
      const outcome = marketOutcomes[idx];
      if (!outcome) continue;
      const shares = Number(pos.shares);
      const netSpent = Number(pos.net_spent);

      if (market.status === "open" || market.status === "closed") {
        if (shares > 1e-9 || Math.abs(netSpent) > 1e-9) {
          openRows.push({
            marketId,
            title: market.title,
            label: outcome.label,
            shares,
            valueNow: shares * probs[idx],
          });
        }
      } else if (market.status === "resolved") {
        const payout = market.winning_outcome_id === outcome.id ? shares : 0;
        closedRows.push({
          marketId,
          title: market.title,
          label: outcome.label,
          shares,
          netSpent,
          result: payout - netSpent,
          status: market.status,
        });
      } else if (market.status === "cancelled") {
        closedRows.push({
          marketId,
          title: market.title,
          label: outcome.label,
          shares,
          netSpent,
          result: 0,
          status: market.status,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-display text-2xl font-bold text-ink">Portfolio</h1>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open posities</p>
        {openRows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Je hebt nog geen open posities.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 pr-2 font-semibold">Markt</th>
                  <th className="py-1.5 pr-2 font-semibold">Uitkomst</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Aandelen</th>
                  <th className="py-1.5 text-right font-semibold">Waarde nu</th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-none">
                    <td className="py-1.5 pr-2">
                      <Link href={`/markets/${r.marketId}`} className="text-ink hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{r.shares.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono">{formatPointsShort(r.valueNow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Afgesloten markten
        </p>
        {closedRows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Je hebt nog geen afgesloten markten.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 pr-2 font-semibold">Markt</th>
                  <th className="py-1.5 pr-2 font-semibold">Uitkomst</th>
                  <th className="py-1.5 pr-2 font-semibold">Status</th>
                  <th className="py-1.5 text-right font-semibold">Resultaat</th>
                </tr>
              </thead>
              <tbody>
                {closedRows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-none">
                    <td className="py-1.5 pr-2">
                      <Link href={`/markets/${r.marketId}`} className="text-ink hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td className="py-1.5 pr-2">{STATUS_LABELS[r.status] ?? r.status}</td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        r.result >= 0 ? "text-good" : "text-bad"
                      }`}
                    >
                      {r.result >= 0.05 ? "+" : ""}
                      {formatPointsShort(r.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Puntenhistorie
        </p>
        {!ledger || ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nog geen puntenmutaties.</p>
        ) : (
          <div className="mt-3 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 pr-2 font-semibold">Datum</th>
                  <th className="py-1.5 pr-2 font-semibold">Soort</th>
                  <th className="py-1.5 text-right font-semibold">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-none">
                    <td className="py-1.5 pr-2 text-muted">{formatDateTime(entry.created_at)}</td>
                    <td className="py-1.5 pr-2">{LEDGER_KIND_LABELS[entry.kind] ?? entry.kind}</td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        Number(entry.amount) >= 0 ? "text-good" : "text-bad"
                      }`}
                    >
                      {Number(entry.amount) >= 0.05 ? "+" : ""}
                      {formatPointsShort(Number(entry.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
