import { OUTCOME_COLORS } from "@/lib/constants";
import { formatProbability } from "@/lib/format";

export interface ProbabilityBarItem {
  id: string;
  label: string;
  prob: number;
  isWinner?: boolean;
}

export function ProbabilityBars({ outcomes }: { outcomes: ProbabilityBarItem[] }) {
  return (
    <div role="group" aria-label="Kansen per uitkomst" className="flex flex-col gap-3">
      {outcomes.map((o, i) => (
        <div key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
            <span
              className="inline-block h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
            />
            {o.label}
            {o.isWinner && <span className="text-xs text-good">✓ uitkomst</span>}
          </span>
          <span className="font-mono text-lg font-semibold text-ink">
            {formatProbability(o.prob)}
          </span>
          <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-sunk">
            <span
              className="block h-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{
                width: `${Math.max(0, Math.min(100, o.prob * 100)).toFixed(2)}%`,
                background: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
