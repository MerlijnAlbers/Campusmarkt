"use client";

import { useState } from "react";
import { formatPointsShort } from "@/lib/format";

export interface TotalRow {
  isMe: boolean;
  displayName: string;
  balance: number;
  openValue: number;
  total: number;
}

export interface MonthRow {
  isMe: boolean;
  displayName: string;
  amount: number;
}

export function LeaderboardTabs({
  totalRows,
  monthRows,
}: {
  totalRows: TotalRow[];
  monthRows: MonthRow[];
}) {
  const [tab, setTab] = useState<"total" | "month">("total");

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div role="tablist" className="flex gap-1.5">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "total"}
          onClick={() => setTab("total")}
          className="rounded-md border border-line px-3 py-1.5 text-sm aria-selected:border-2 aria-selected:border-accent aria-selected:font-semibold"
        >
          Totaal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "month"}
          onClick={() => setTab("month")}
          className="rounded-md border border-line px-3 py-1.5 text-sm aria-selected:border-2 aria-selected:border-accent aria-selected:font-semibold"
        >
          Deze maand
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        {tab === "total" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-semibold"></th>
                <th className="py-1.5 pr-2 font-semibold">Speler</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Op zak</th>
                <th className="py-1.5 text-right font-semibold">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {totalRows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-line last:border-none ${
                    r.isMe ? "font-semibold" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 font-mono text-muted">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {r.displayName}
                    {r.isMe && <span className="ml-1 text-xs text-muted">(jij)</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatPointsShort(r.balance)}
                  </td>
                  <td className="py-1.5 text-right font-mono">{formatPointsShort(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-semibold"></th>
                <th className="py-1.5 pr-2 font-semibold">Speler</th>
                <th className="py-1.5 text-right font-semibold">Deze maand</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-line last:border-none ${
                    r.isMe ? "font-semibold" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 font-mono text-muted">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {r.displayName}
                    {r.isMe && <span className="ml-1 text-xs text-muted">(jij)</span>}
                  </td>
                  <td
                    className={`py-1.5 text-right font-mono ${
                      r.amount >= 0 ? "text-good" : "text-bad"
                    }`}
                  >
                    {r.amount >= 0.05 ? "+" : ""}
                    {formatPointsShort(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Totaal = punten op zak + waarde van open posities tegen de huidige kans. &quot;Deze
        maand&quot; telt alle puntenmutaties sinds de 1e van deze maand.
      </p>
    </section>
  );
}
