import Link from "next/link";
import { OUTCOME_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatProbability } from "@/lib/format";

export interface MarketCardOutcome {
  id: string;
  label: string;
  prob: number;
}

export interface MarketCardData {
  id: string;
  title: string;
  status: string;
  closesAt: string;
  winningOutcomeId: string | null;
  outcomes: MarketCardOutcome[];
  tradeCount: number;
}

export function MarketCard({ market }: { market: MarketCardData }) {
  const top = market.outcomes.reduce(
    (best, o) => (o.prob > best.prob ? o : best),
    market.outcomes[0],
  );
  const winner = market.winningOutcomeId
    ? market.outcomes.find((o) => o.id === market.winningOutcomeId)
    : null;

  const statusLine =
    market.status === "resolved" && winner
      ? `Uitkomst: ${winner.label}`
      : market.status === "cancelled"
        ? "Geannuleerd"
        : top
          ? `${top.label} ${formatProbability(top.prob)}`
          : "";

  return (
    <Link
      href={`/markets/${market.id}`}
      className="block rounded-lg border border-line bg-surface p-4 hover:border-ink focus-visible:border-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {STATUS_LABELS[market.status] ?? market.status}
        </span>
        <span className="text-xs text-muted">Sluit op {formatDate(market.closesAt)}</span>
      </div>
      <p className="mt-2 font-medium leading-snug text-ink">{market.title}</p>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-sunk">
        {market.outcomes.map((o, i) => (
          <span
            key={o.id}
            style={{
              width: `${Math.max(0, Math.min(100, o.prob * 100)).toFixed(2)}%`,
              background: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{statusLine}</span>
        <span>
          {market.tradeCount} {market.tradeCount === 1 ? "transactie" : "transacties"}
        </span>
      </div>
    </Link>
  );
}
