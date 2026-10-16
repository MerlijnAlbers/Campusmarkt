"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { mapTradeRow, type ActivityFilterState, type TradeRow } from "@/lib/activity";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { formatPointsShort, formatProbability, formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { OUTCOME_COLORS } from "@/lib/constants";

export interface MarketOption {
  id: string;
  title: string;
  outcomes: { id: string; label: string; sortOrder: number }[];
}

export interface SummaryOutcome {
  label: string;
  prob: number;
  holders: number;
  volume24h: number;
}

const EXPORT_LIMIT = 5000;

function buildTradesArgs(
  filters: ActivityFilterState,
  extra: { limit: number; beforeAt?: string; beforeId?: string },
) {
  return {
    p_market: filters.marketId ?? undefined,
    p_outcome: filters.outcomeId ?? undefined,
    p_side: filters.side ?? undefined,
    p_only_mine: filters.onlyMine,
    p_before_at: extra.beforeAt,
    p_before_id: extra.beforeId,
    p_limit: extra.limit,
  };
}

function tradeTime(row: TradeRow) {
  return `${formatRelativeTime(row.createdAt)}`;
}

function SideLabel({ side }: { side: "buy" | "sell" }) {
  return (
    <span className={side === "buy" ? "font-medium text-good" : "font-medium text-muted"}>
      {side === "buy" ? "kocht" : "verkocht"}
    </span>
  );
}

function OutcomeDot({ outcomeSort }: { outcomeSort: number }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 flex-none rounded-full"
      style={{ background: OUTCOME_COLORS[(outcomeSort - 1) % OUTCOME_COLORS.length] }}
    />
  );
}

export function ActivityFeed({
  initialRows,
  initialHasMore,
  initialSummary,
  filters,
  marketOptions,
  showFilterBar = true,
  showExport = true,
  showLoadMore = true,
  moreHref,
  pageSize = 25,
}: {
  initialRows: TradeRow[];
  initialHasMore: boolean;
  initialSummary: SummaryOutcome[] | null;
  filters: ActivityFilterState;
  marketOptions: MarketOption[];
  showFilterBar?: boolean;
  showExport?: boolean;
  showLoadMore?: boolean;
  moreHref?: string;
  pageSize?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState(initialSummary);
  const [pendingNew, setPendingNew] = useState<TradeRow[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [marketSearch, setMarketSearch] = useState(
    marketOptions.find((m) => m.id === filters.marketId)?.title ?? "",
  );

  const knownIdsRef = useRef(new Set(initialRows.map((r) => r.id)));
  const isAtTopRef = useRef(true);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      isAtTopRef.current = entry.isIntersecting;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function doRefetch() {
      const { data } = await supabase.rpc(
        "get_public_trades",
        buildTradesArgs(filters, { limit: pageSize }),
      );
      if (data) {
        const fresh = data.map(mapTradeRow);
        const newOnes = fresh.filter((r) => !knownIdsRef.current.has(r.id));
        if (newOnes.length > 0) {
          newOnes.forEach((r) => knownIdsRef.current.add(r.id));
          if (isAtTopRef.current) {
            setRows((prev) => [...newOnes, ...prev]);
            const ids = newOnes.map((r) => r.id);
            setHighlightIds((prev) => new Set([...prev, ...ids]));
            setTimeout(() => {
              setHighlightIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
              });
            }, 2500);
          } else {
            setPendingNew((prev) => [...newOnes, ...prev]);
          }
        }
      }

      if (filters.marketId) {
        const { data: statsRows } = await supabase.rpc("get_market_stats", {
          p_market: filters.marketId,
        });
        const stats = statsRows?.[0];
        if (stats) {
          const outcomes = (stats.outcomes as unknown as Array<{
            label: string;
            prob: number;
            holders: number;
            volume_24h: number;
          }>) ?? [];
          setSummary(
            outcomes.map((o) => ({
              label: o.label,
              prob: Number(o.prob),
              holders: o.holders,
              volume24h: Number(o.volume_24h),
            })),
          );
        }
      }
    }

    function scheduleRefetch() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doRefetch, 1000);
    }

    const channel = supabase
      .channel(`activity-feed-${filters.marketId ?? "all"}-${filters.outcomeId ?? "all"}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "outcomes" }, scheduleRefetch)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [filters, pageSize]);

  function showPendingNow() {
    setRows((prev) => [...pendingNew, ...prev]);
    const ids = pendingNew.map((r) => r.id);
    setHighlightIds((prev) => new Set([...prev, ...ids]));
    setPendingNew([]);
    topSentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 2500);
  }

  async function loadMore() {
    if (rows.length === 0) return;
    setLoadingMore(true);
    const supabase = createClient();
    const last = rows[rows.length - 1];
    const { data } = await supabase.rpc(
      "get_public_trades",
      buildTradesArgs(filters, { limit: pageSize, beforeAt: last.createdAt, beforeId: last.id }),
    );
    setLoadingMore(false);
    if (!data) return;
    const mapped = data.map(mapTradeRow);
    mapped.forEach((r) => knownIdsRef.current.add(r.id));
    setRows((prev) => [...prev, ...mapped]);
    setHasMore(mapped.length >= pageSize);
  }

  async function handleExport() {
    setExporting(true);
    const supabase = createClient();
    const all: TradeRow[] = [];
    let beforeAt: string | undefined;
    let beforeId: string | undefined;
    while (all.length < EXPORT_LIMIT) {
      const { data } = await supabase.rpc(
        "get_public_trades",
        buildTradesArgs(filters, { limit: 200, beforeAt, beforeId }),
      );
      if (!data || data.length === 0) break;
      const mapped = data.map(mapTradeRow);
      all.push(...mapped);
      if (data.length < 200) break;
      const last = mapped[mapped.length - 1];
      beforeAt = last.createdAt;
      beforeId = last.id;
    }
    const limited = all.slice(0, EXPORT_LIMIT);
    const csv = buildCsv<TradeRow>(
      [
        { header: "Tijd (ISO)", value: (r) => r.createdAt },
        { header: "Student", value: (r) => r.traderName },
        { header: "Actie", value: (r) => (r.side === "buy" ? "kocht" : "verkocht") },
        { header: "Uitkomst", value: (r) => r.outcomeLabel },
        { header: "Aandelen", value: (r) => r.shares.toFixed(2) },
        { header: "Punten", value: (r) => r.points.toFixed(1) },
        { header: "Gem. prijs", value: (r) => r.avgPrice.toFixed(3) },
        { header: "Kans voor (%)", value: (r) => (r.probBefore * 100).toFixed(1) },
        { header: "Kans na (%)", value: (r) => (r.probAfter * 100).toFixed(1) },
        { header: "Markt", value: (r) => r.marketTitle },
      ],
      limited,
    );
    downloadCsv(`campusmarkt-logboek-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setExporting(false);
  }

  function navigate(next: Partial<ActivityFilterState>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.marketId) params.set("market", merged.marketId);
    if (merged.outcomeId) params.set("outcome", merged.outcomeId);
    if (merged.side) params.set("side", merged.side);
    if (merged.onlyMine) params.set("mine", "1");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function handleMarketSearchChange(value: string) {
    setMarketSearch(value);
    if (value.trim() === "") {
      navigate({ marketId: null, outcomeId: null });
      return;
    }
    const match = marketOptions.find((m) => m.title.toLowerCase() === value.toLowerCase());
    if (match) {
      navigate({ marketId: match.id, outcomeId: null });
    }
  }

  const selectedMarket = marketOptions.find((m) => m.id === filters.marketId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {showFilterBar && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="activity-market" className="text-xs text-muted">
              Markt
            </label>
            <input
              id="activity-market"
              type="text"
              list="activity-market-options"
              value={marketSearch}
              onChange={(e) => handleMarketSearchChange(e.target.value)}
              placeholder="Alle markten"
              className="w-56 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
            <datalist id="activity-market-options">
              {marketOptions.map((m) => (
                <option key={m.id} value={m.title} />
              ))}
            </datalist>
          </div>

          {selectedMarket && (
            <div className="flex flex-col gap-1">
              <label htmlFor="activity-outcome" className="text-xs text-muted">
                Uitkomst
              </label>
              <select
                id="activity-outcome"
                value={filters.outcomeId ?? ""}
                onChange={(e) => navigate({ outcomeId: e.target.value || null })}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">Alle uitkomsten</option>
                {selectedMarket.outcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="activity-side" className="text-xs text-muted">
              Actie
            </label>
            <select
              id="activity-side"
              value={filters.side ?? ""}
              onChange={(e) => navigate({ side: (e.target.value as "buy" | "sell") || null })}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">Alles</option>
              <option value="buy">Kopen</option>
              <option value="sell">Verkopen</option>
            </select>
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={filters.onlyMine}
              onChange={(e) => navigate({ onlyMine: e.target.checked })}
            />
            Alleen mijn transacties
          </label>

          {showExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="ml-auto rounded-md border border-line px-3 py-2 text-sm hover:border-ink disabled:opacity-50"
            >
              {exporting ? "Exporteren..." : "Exporteer als CSV"}
            </button>
          )}
        </div>
      )}

      {summary && summary.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-surface p-3 text-sm">
          {summary.map((o, i) => (
            <span key={o.label} className="flex items-center gap-1.5 font-mono">
              <OutcomeDot outcomeSort={i + 1} />
              <span className="font-sans text-ink">{o.label}</span>
              <span className="text-muted">·</span>
              <span>{formatProbability(o.prob)}</span>
              <span className="text-muted">·</span>
              <span>{o.holders} houders</span>
              <span className="text-muted">·</span>
              <span>{formatPointsShort(o.volume24h)} pnt (24u)</span>
            </span>
          ))}
        </div>
      )}

      <div ref={topSentinelRef} />

      {pendingNew.length > 0 && (
        <button
          type="button"
          onClick={showPendingNow}
          className="self-center rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink"
        >
          {pendingNew.length} nieuwe {pendingNew.length === 1 ? "transactie" : "transacties"}
        </button>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-center text-muted">
          Nog geen transacties gevonden.
        </p>
      ) : (
        <>
          {/* Desktop-tabel */}
          <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-3 py-2">
                    Tijd
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Student
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Actie
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Uitkomst
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Aandelen
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Punten
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Gem. prijs
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Kans
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Markt
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-line bg-surface last:border-none transition-colors duration-1000 motion-reduce:transition-none ${
                      highlightIds.has(r.id) ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-muted" title={formatRelativeTime(r.createdAt)}>
                      <time dateTime={r.createdAt}>{tradeTime(r)}</time>
                    </td>
                    <td className="px-3 py-2 text-ink">
                      {r.traderName}
                      {r.isMe && <span className="ml-1 text-xs text-muted">(jij)</span>}
                    </td>
                    <td className="px-3 py-2">
                      <SideLabel side={r.side} />
                    </td>
                    <td className="px-3 py-2 text-ink">
                      <span className="flex items-center gap-1.5">
                        <OutcomeDot outcomeSort={r.outcomeSort} />
                        {r.outcomeLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                      {r.shares.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                      {formatPointsShort(r.points)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                      {r.avgPrice.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                      {formatProbability(r.probBefore)} → {formatProbability(r.probAfter)}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2">
                      <Link href={`/markets/${r.marketId}`} className="text-ink hover:underline">
                        {r.marketTitle}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobiele kaarten */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`rounded-lg border border-line bg-surface p-3 text-sm transition-colors duration-1000 motion-reduce:transition-none ${
                  highlightIds.has(r.id) ? "bg-accent/10" : ""
                }`}
              >
                <p className="text-ink">
                  <strong>
                    {r.traderName}
                    {r.isMe && " (jij)"}
                  </strong>{" "}
                  <SideLabel side={r.side} /> {r.shares.toFixed(2)} × {r.outcomeLabel} voor{" "}
                  {formatPointsShort(r.points)} pnt
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatProbability(r.probBefore)} → {formatProbability(r.probAfter)} ·{" "}
                  <Link href={`/markets/${r.marketId}`} className="underline">
                    {r.marketTitle}
                  </Link>
                </p>
                <p className="mt-1 text-xs text-muted">
                  <time dateTime={r.createdAt}>{tradeTime(r)}</time>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {showLoadMore ? (
        hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="self-center rounded-md border border-line px-4 py-2 text-sm hover:border-ink disabled:opacity-50"
          >
            {loadingMore ? "Bezig..." : "Meer laden"}
          </button>
        )
      ) : (
        moreHref && (
          <Link href={moreHref} className="self-center text-sm text-accent hover:underline">
            Alles in het logboek
          </Link>
        )
      )}
    </div>
  );
}
