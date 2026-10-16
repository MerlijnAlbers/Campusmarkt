"use client";

import { useMemo, useState } from "react";
import { OUTCOME_COLORS } from "@/lib/constants";
import { formatPointsShort, formatProbability } from "@/lib/format";
import { P, sharesForBudget, sharesForProceeds, tcost, type Market } from "@/lib/lmsr";
import { createClient } from "@/lib/supabase/client";

export interface TradeTicketOutcome {
  id: string;
  label: string;
  q: number;
}

interface TradeResult {
  outcomeId: string;
  shares: number;
  cost: number;
}

type Side = "buy" | "sell";
type Mode = "shares" | "points";

const nf2 = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function signed(value: number): string {
  const v = Math.abs(value) < 0.05 ? 0 : value;
  return `${v > 0.05 ? "+" : ""}${formatPointsShort(v)}`;
}

export function TradeTicket({
  b,
  outcomes,
  userBalance,
  heldShares,
  onTrade,
}: {
  b: number;
  outcomes: TradeTicketOutcome[];
  userBalance: number;
  heldShares: Record<string, number>;
  onTrade: (result: TradeResult) => void;
}) {
  const [outcomeIdx, setOutcomeIdx] = useState(0);
  const [side, setSide] = useState<Side>("buy");
  const [mode, setMode] = useState<Mode>("shares");
  const [amount, setAmount] = useState("20");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const market: Market = useMemo(() => ({ q: outcomes.map((o) => o.q), b }), [outcomes, b]);
  const probs = useMemo(() => P(market.q, market.b), [market]);
  const outcome = outcomes[outcomeIdx] ?? outcomes[0];
  const held = heldShares[outcome?.id] ?? 0;

  const quote = useMemo(() => {
    const a = Number(amount);
    if (!outcome) return { error: "Onbekende uitkomst." };
    if (!(a > 0)) return { error: "Vul een bedrag groter dan 0 in." };

    let d: number;
    let c: number;
    if (side === "buy") {
      if (mode === "shares") {
        d = a;
        c = tcost(market, outcomeIdx, d);
      } else {
        c = a;
        d = sharesForBudget(market, outcomeIdx, a);
      }
      if (c > userBalance + 1e-9) {
        return { error: `Te weinig punten: dit kost ${formatPointsShort(c)} en je hebt ${formatPointsShort(userBalance)}.` };
      }
    } else {
      if (held <= 1e-9) {
        return { error: `Je hebt geen aandelen ${outcome.label} om te verkopen.` };
      }
      if (mode === "shares") {
        if (a > held + 1e-9) {
          return { error: `Je hebt maar ${nf2.format(held)} aandelen ${outcome.label}.` };
        }
        d = -a;
        c = tcost(market, outcomeIdx, d);
      } else {
        const s = sharesForProceeds(market, outcomeIdx, a, held);
        if (s === null) {
          return {
            error: `Al je aandelen ${outcome.label} samen leveren nu ${formatPointsShort(-tcost(market, outcomeIdx, -held))} pnt op.`,
          };
        }
        d = -s;
        c = -a;
      }
    }

    const q2 = market.q.slice();
    q2[outcomeIdx] += d;
    const newProb = P(q2, market.b)[outcomeIdx];
    return { d, c, p0: probs[outcomeIdx], np: newProb, held, outcomeLabel: outcome.label };
  }, [amount, side, mode, market, outcomeIdx, outcome, held, userBalance, probs]);

  function setQuick(v: number | "max") {
    if (!outcome) return;
    if (v === "max") {
      if (side === "buy") {
        setAmount(
          mode === "points"
            ? (Math.floor(userBalance * 100) / 100).toString()
            : (Math.floor(sharesForBudget(market, outcomeIdx, userBalance) * 100) / 100).toString(),
        );
      } else {
        setAmount(
          mode === "shares"
            ? (Math.round(held * 100) / 100).toString()
            : (Math.floor(-tcost(market, outcomeIdx, -held) * 100) / 100).toString(),
        );
      }
    } else {
      setAmount(String(v));
    }
    setMessage(null);
  }

  async function handleSubmit() {
    if ("error" in quote || !outcome) return;
    setSubmitting(true);
    setMessage(null);

    const d = quote.d!;
    const c = quote.c!;
    const pMaxCost = d > 0 ? c * 1.01 + 0.01 : c + Math.abs(c) * 0.01 + 0.01;

    const supabase = createClient();
    const { error } = await supabase.rpc("place_trade", {
      p_outcome: outcome.id,
      p_shares: d,
      p_max_cost: pMaxCost,
    });

    setSubmitting(false);

    if (error) {
      setMessage({ ok: false, text: error.message || "Er ging iets mis bij het handelen." });
      return;
    }

    setMessage({
      ok: true,
      text: `${d > 0 ? "Gekocht" : "Verkocht"}: ${nf2.format(Math.abs(d))} × ${outcome.label} voor ${formatPointsShort(Math.abs(c))} pnt.`,
    });
    onTrade({ outcomeId: outcome.id, shares: d, cost: c });
  }

  const amountLabel =
    mode === "shares" ? "Aantal aandelen" : side === "buy" ? "Punten die je wilt besteden" : "Punten die je wilt ontvangen";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Handelen</p>

      <div className="flex flex-wrap gap-1.5">
        {outcomes.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setOutcomeIdx(i);
              setMessage(null);
            }}
            aria-pressed={outcomeIdx === i}
            style={{ "--c": OUTCOME_COLORS[i % OUTCOME_COLORS.length] } as React.CSSProperties}
            className="flex min-w-[110px] flex-1 items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium aria-pressed:border-2 aria-pressed:border-[var(--c)]"
          >
            <span>{o.label}</span>
            <span className="font-mono">{formatProbability(probs[i])}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div role="group" aria-label="Kopen of verkopen" className="flex gap-1.5">
          {(["buy", "sell"] as Side[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setSide(v);
                setMessage(null);
              }}
              aria-pressed={side === v}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm aria-pressed:border-2 aria-pressed:border-accent"
            >
              {v === "buy" ? "Kopen" : "Verkopen"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Invoer in" className="flex gap-1.5">
          {(["shares", "points"] as Mode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setMode(v);
                setMessage(null);
              }}
              aria-pressed={mode === v}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm aria-pressed:border-2 aria-pressed:border-accent"
            >
              {v === "shares" ? "In aandelen" : "In punten"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="amt" className="text-sm text-muted">
          {amountLabel}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="amt"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setMessage(null);
            }}
            className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          <div className="flex flex-wrap gap-1.5">
            {[10, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setQuick(v)}
                className="rounded-md border border-line px-2.5 py-1 text-sm hover:border-ink"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuick("max")}
              className="rounded-md border border-line px-2.5 py-1 text-sm hover:border-ink"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 rounded-md bg-sunk px-3.5 py-3 text-sm">
        {"error" in quote ? (
          <div className="col-span-2 text-bad">{quote.error}</div>
        ) : quote.d! > 0 ? (
          <>
            <dt className="text-muted">Aandelen {outcome?.label}</dt>
            <dd className="text-right font-mono">{nf2.format(quote.d!)}</dd>
            <dt className="text-muted">Je betaalt</dt>
            <dd className="text-right font-mono">{formatPointsShort(quote.c!)} pnt</dd>
            <dt className="text-muted">Gemiddelde prijs per aandeel</dt>
            <dd className="text-right font-mono">{nf3.format(quote.c! / quote.d!)}</dd>
            <dt className="text-muted">Kans {outcome?.label}</dt>
            <dd className="text-right font-mono">
              {formatProbability(quote.p0!)} → {formatProbability(quote.np!)}
            </dd>
            <dt className="text-muted">Uitbetaling als {outcome?.label} wint (totaal)</dt>
            <dd className="text-right font-mono">{formatPointsShort(quote.held! + quote.d!)} pnt</dd>
            <dt className="text-muted">Winst op deze aankoop als {outcome?.label} wint</dt>
            <dd className="text-right font-mono text-good">{signed(quote.d! - quote.c!)} pnt</dd>
            <dt className="text-muted">Verlies als {outcome?.label} niet wint</dt>
            <dd className="text-right font-mono text-bad">−{formatPointsShort(quote.c!)} pnt</dd>
          </>
        ) : (
          <>
            <dt className="text-muted">Je verkoopt</dt>
            <dd className="text-right font-mono">{nf2.format(-quote.d!)} aandelen {outcome?.label}</dd>
            <dt className="text-muted">Je ontvangt</dt>
            <dd className="text-right font-mono">{formatPointsShort(-quote.c!)} pnt</dd>
            <dt className="text-muted">Gemiddelde prijs per aandeel</dt>
            <dd className="text-right font-mono">{nf3.format(quote.c! / quote.d!)}</dd>
            <dt className="text-muted">Kans {outcome?.label}</dt>
            <dd className="text-right font-mono">
              {formatProbability(quote.p0!)} → {formatProbability(quote.np!)}
            </dd>
            <dt className="text-muted">Aandelen {outcome?.label} over</dt>
            <dd className="text-right font-mono">{nf2.format(quote.held! + quote.d!)}</dd>
          </>
        )}
      </dl>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={"error" in quote || submitting}
        className="self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-45"
      >
        {submitting
          ? "Bezig..."
          : "error" in quote
            ? "Uitvoeren"
            : quote.d! > 0
              ? `Koop ${nf2.format(quote.d!)} × ${outcome?.label} voor ${formatPointsShort(quote.c!)} pnt`
              : `Verkoop ${nf2.format(-quote.d!)} × ${outcome?.label} voor ${formatPointsShort(-quote.c!)} pnt`}
      </button>

      <p className={`min-h-[1.3em] text-sm ${message ? (message.ok ? "text-good" : "text-bad") : ""}`} role="status">
        {message?.text}
      </p>
    </section>
  );
}
