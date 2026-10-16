"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPointsShort } from "@/lib/format";
import { P } from "@/lib/lmsr";
import { createClient } from "@/lib/supabase/client";
import { ProbabilityBars } from "./ProbabilityBars";
import { PriceChart, type PriceChartPoint } from "./PriceChart";
import { TradeTicket } from "./TradeTicket";

interface OutcomeInfo {
  id: string;
  label: string;
  q: number;
}

export function MarketLive({
  marketId,
  b,
  status,
  winningOutcomeId,
  initialOutcomes,
  initialHistory,
  userName,
  userBalance,
  heldShares,
  netSpent,
}: {
  marketId: string;
  b: number;
  status: string;
  winningOutcomeId: string | null;
  initialOutcomes: OutcomeInfo[];
  initialHistory: PriceChartPoint[];
  userName: string;
  userBalance: number;
  heldShares: Record<string, number>;
  netSpent: Record<string, number>;
}) {
  const router = useRouter();
  const [state, setState] = useState<{ outcomes: OutcomeInfo[]; history: PriceChartPoint[] }>({
    outcomes: initialOutcomes,
    history: initialHistory,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`market-outcomes-${marketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outcomes", filter: `market_id=eq.${marketId}` },
        (payload) => {
          const updated = payload.new as { id: string; q: number };
          setState((prev) => {
            const nextOutcomes = prev.outcomes.map((o) =>
              o.id === updated.id ? { ...o, q: updated.q } : o,
            );
            const probs = P(nextOutcomes.map((o) => o.q), b);
            return {
              outcomes: nextOutcomes,
              history: [...prev.history, { createdAt: new Date().toISOString(), probs }],
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, b]);

  const probs = P(state.outcomes.map((o) => o.q), b);
  const probabilityItems = state.outcomes.map((o, i) => ({
    id: o.id,
    label: o.label,
    prob: probs[i],
    isWinner: winningOutcomeId === o.id,
  }));

  const totalValue = state.outcomes.reduce(
    (sum, o, i) => sum + (heldShares[o.id] ?? 0) * probs[i],
    0,
  );
  const totalSpent = Object.values(netSpent).reduce((sum, v) => sum + v, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-4">
        <ProbabilityBars outcomes={probabilityItems} />
        <div className="mt-4">
          <PriceChart outcomes={state.outcomes} history={state.history} />
        </div>
      </section>

      {status === "open" && (
        <TradeTicket
          b={b}
          outcomes={state.outcomes}
          userBalance={userBalance}
          heldShares={heldShares}
          onTrade={() => router.refresh()}
        />
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Positie van {userName}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-semibold">Uitkomst</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Aandelen</th>
                <th className="py-1.5 text-right font-semibold">Waarde nu</th>
              </tr>
            </thead>
            <tbody>
              {state.outcomes.map((o, i) => (
                <tr key={o.id} className="border-b border-line last:border-none">
                  <td className="py-1.5 pr-2">{o.label}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {(heldShares[o.id] ?? 0).toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatPointsShort((heldShares[o.id] ?? 0) * probs[i])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">
          Netto ingelegd {formatPointsShort(totalSpent)} pnt · waarde nu {formatPointsShort(totalValue)}{" "}
          pnt. Elk aandeel betaalt 1 punt als die uitkomst wint.
        </p>
      </section>
    </div>
  );
}
