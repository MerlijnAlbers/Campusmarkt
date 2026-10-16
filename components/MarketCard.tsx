import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { OUTCOME_COLORS, METRIC_DESCRIPTIONS, STATUS_LABELS } from "@/lib/constants";
import { formatPointsShort, formatProbability } from "@/lib/format";
import { changeDirection, closesWithin24h, formatChangeWithArrow, formatClosesIn } from "@/lib/stats";
import { Sparkline } from "./Sparkline";
import { Tooltip } from "./Tooltip";

export interface MarketTileOutcome {
  outcomeId: string;
  label: string;
  prob: number;
  change24h: number;
  holders: number;
  q: number;
}

export interface MarketTileData {
  marketId: string;
  title: string;
  status: string;
  closesAt: string;
  winningOutcomeId: string | null;
  marketValue: number;
  pot: number;
  volumeTotal: number;
  volume24h: number;
  tradeCount: number;
  traderCount: number;
  outcomes: MarketTileOutcome[];
  spark: number[];
  myPosition: { label: string; shares: number } | null;
}

function ChangeBadge({ diff }: { diff: number }) {
  const direction = changeDirection(diff);
  const colorClass =
    direction === "up" ? "text-good" : direction === "down" ? "text-bad" : "text-muted";
  return <span className={`font-mono text-xs ${colorClass}`}>{formatChangeWithArrow(diff)}</span>;
}

function Metric({
  label,
  tooltip,
  value,
  valueTooltip,
}: {
  label: string;
  tooltip: string;
  value: string;
  valueTooltip?: string;
}) {
  const valueEl = (
    <span
      tabIndex={valueTooltip ? 0 : undefined}
      className={`font-mono text-sm tabular-nums text-ink ${valueTooltip ? "cursor-help" : ""}`}
    >
      {value}
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip label={tooltip}>
        <span tabIndex={0} className="cursor-help text-[11px] text-muted underline decoration-dotted decoration-from-font">
          {label}
        </span>
      </Tooltip>
      {valueTooltip ? <Tooltip label={valueTooltip}>{valueEl}</Tooltip> : valueEl}
    </div>
  );
}

function StackedBar({ outcomes }: { outcomes: MarketTileOutcome[] }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-sunk">
      {outcomes.map((o, i) => (
        <span
          key={o.outcomeId}
          style={{
            width: `${Math.max(0, Math.min(100, o.prob * 100)).toFixed(2)}%`,
            background: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
          }}
        />
      ))}
    </div>
  );
}

export function MarketCard({ market }: { market: MarketTileData }) {
  const { outcomes } = market;
  const leadingIdx = outcomes.reduce(
    (best, o, i, arr) => (o.prob > arr[best].prob ? i : best),
    0,
  );
  const leadingColor = OUTCOME_COLORS[leadingIdx % OUTCOME_COLORS.length];
  const winner = market.winningOutcomeId
    ? outcomes.find((o) => o.outcomeId === market.winningOutcomeId)
    : null;
  const within24h = closesWithin24h(market.closesAt);

  return (
    <Link
      href={`/markets/${market.marketId}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 hover:border-ink focus-visible:border-ink"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-current px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
          {STATUS_LABELS[market.status] ?? market.status}
        </span>
        <span className={within24h ? "font-medium text-bad" : "text-muted"}>
          {formatClosesIn(market.closesAt)}
        </span>
        {market.myPosition && (
          <span className="ml-auto whitespace-nowrap rounded-full bg-sunk px-2 py-0.5 font-mono text-ink">
            Jij: {market.myPosition.shares.toFixed(0)} {market.myPosition.label}
          </span>
        )}
      </div>

      <p className="line-clamp-2 font-medium leading-snug text-ink">{market.title}</p>

      {market.status === "resolved" && winner ? (
        <div className="flex items-center gap-2 rounded-md bg-sunk px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-none text-good" aria-hidden="true" />
          <span className="text-ink">
            <strong>{winner.label}</strong> wint
          </span>
          <span className="ml-auto font-mono text-xs text-muted">
            Pot uitbetaald: {formatPointsShort(winner.q)} pnt
          </span>
        </div>
      ) : market.status === "cancelled" ? (
        <div className="rounded-md bg-sunk px-3 py-2 text-sm text-muted">Geannuleerd</div>
      ) : (
        <>
          {outcomes.length <= 2 ? (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                {formatProbability(outcomes[0]?.prob ?? 0)}
              </span>
              <span className="text-sm text-ink">{outcomes[0]?.label}</span>
              {outcomes[0] && <ChangeBadge diff={outcomes[0].change24h} />}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {outcomes.slice(0, 3).map((o, i) => (
                <div key={o.outcomeId} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{o.label}</span>
                  <span className="font-mono tabular-nums text-ink">
                    {formatProbability(o.prob)}
                  </span>
                  <ChangeBadge diff={o.change24h} />
                </div>
              ))}
              {outcomes.length > 3 && (
                <p className="text-xs text-muted">+{outcomes.length - 3} meer</p>
              )}
            </div>
          )}
          <StackedBar outcomes={outcomes} />
        </>
      )}

      {market.spark.length > 0 && <Sparkline values={market.spark} color={leadingColor} />}

      <div className="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3">
        <Metric
          label="Marktwaarde"
          tooltip={METRIC_DESCRIPTIONS.marktwaarde}
          value={formatPointsShort(market.marketValue)}
        />
        <Metric
          label="Volume 24u"
          tooltip={METRIC_DESCRIPTIONS.volume}
          value={formatPointsShort(market.volume24h)}
          valueTooltip={`Totaal: ${formatPointsShort(market.volumeTotal)} pnt`}
        />
        <Metric
          label="Handelaren"
          tooltip={METRIC_DESCRIPTIONS.handelaren}
          value={String(market.traderCount)}
        />
        <Metric
          label="Houders"
          tooltip={METRIC_DESCRIPTIONS.houders}
          value={
            outcomes.length === 2
              ? `${outcomes[0].holders} · ${outcomes[1].holders}`
              : String(outcomes.reduce((sum, o) => sum + o.holders, 0))
          }
        />
      </div>
    </Link>
  );
}
