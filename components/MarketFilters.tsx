"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Gesloten" },
  { value: "resolved", label: "Uitbetaald" },
  { value: "all", label: "Alles" },
];

const SORT_OPTIONS = [
  { value: "popular", label: "Populair" },
  { value: "new", label: "Nieuw" },
  { value: "closing", label: "Sluit binnenkort" },
  { value: "movers", label: "Grootste beweging" },
];

export function MarketFilters({
  status,
  sort,
  query,
}: {
  status: string;
  sort: string;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(query);

  function navigate(next: { status?: string; sort?: string; q?: string }) {
    const merged = { status, sort, q, ...next };
    const params = new URLSearchParams();
    params.set("status", merged.status);
    params.set("sort", merged.sort);
    if (merged.q) params.set("q", merged.q);
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== query) navigate({ q });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="market-search" className="text-xs text-muted">
          Zoeken
        </label>
        <input
          id="market-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op titel..."
          className="w-56 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="market-status" className="text-xs text-muted">
          Status
        </label>
        <select
          id="market-status"
          value={status}
          onChange={(e) => navigate({ status: e.target.value })}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="market-sort" className="text-xs text-muted">
          Sorteren op
        </label>
        <select
          id="market-sort"
          value={sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
