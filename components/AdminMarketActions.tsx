"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPointsShort } from "@/lib/format";

interface Outcome {
  id: string;
  label: string;
}

interface OutcomeImpact {
  holders: number;
  payout: number;
}

interface CancelImpact {
  holders: number;
  total: number;
}

export function AdminMarketActions({
  marketId,
  status,
  outcomes,
  tradeCount,
  outcomeImpact,
  cancelImpact,
}: {
  marketId: string;
  status: string;
  outcomes: Outcome[];
  tradeCount: number;
  outcomeImpact: Record<string, OutcomeImpact>;
  cancelImpact: CancelImpact;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | "void" | "delete" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function setStatus(next: "open" | "closed") {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_market_status", {
      p_market: marketId,
      p_status: next,
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    router.refresh();
  }

  async function confirmPending() {
    if (pending === null) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    if (pending === "delete") {
      const { error } = await supabase.rpc("delete_market", { p_market: marketId });
      setBusy(false);
      setPending(null);
      if (error) {
        setMessage({ ok: false, text: error.message });
        return;
      }
      router.push("/admin/markets");
      return;
    }

    const { error } =
      pending === "void"
        ? await supabase.rpc("cancel_market", { p_market: marketId })
        : await supabase.rpc("resolve_market", { p_market: marketId, p_winner: pending });
    setBusy(false);
    setPending(null);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    router.refresh();
  }

  const canToggleStatus = status === "draft" || status === "open" || status === "closed";
  const canResolve = status === "open" || status === "closed";
  const canCancel = status === "draft" || status === "open" || status === "closed";
  const canDelete = tradeCount === 0 && (status === "draft" || status === "open" || status === "closed");

  if (!canToggleStatus && !canResolve && !canCancel && !canDelete) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Beheer</p>

      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("open")}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Openen voor studenten
          </button>
        )}
        {status === "open" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("closed")}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50"
          >
            Sluiten
          </button>
        )}
        {status === "closed" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("open")}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50"
          >
            Heropenen
          </button>
        )}
      </div>

      {(canResolve || canCancel || canDelete) && (
        <div>
          <p className="text-sm text-muted">
            In de echte app doet alleen een beheerder dit, op basis van een vooraf afgesproken
            bron.
          </p>
          {pending === null ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {canResolve &&
                outcomes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setPending(o.id)}
                    className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
                  >
                    {o.label} wint
                  </button>
                ))}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setPending("void")}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-bad hover:border-bad"
                >
                  Annuleren
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setPending("delete")}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-bad hover:border-bad"
                >
                  Verwijderen
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-sunk p-3">
              <p className="text-sm text-ink">
                {pending === "void"
                  ? cancelImpact.holders === 0
                    ? "De markt wordt geannuleerd. Niemand heeft nog ingelegd, er wordt niets teruggestort."
                    : `De markt wordt geannuleerd. ${cancelImpact.holders} ${
                        cancelImpact.holders === 1 ? "speler krijgt" : "spelers krijgen"
                      } in totaal ca. ${formatPointsShort(cancelImpact.total)} punten netto inleg terug.`
                  : pending === "delete"
                    ? "De markt wordt permanent verwijderd. Dit kan niet ongedaan worden gemaakt."
                    : (() => {
                        const outcome = outcomes.find((o) => o.id === pending);
                        const impact = outcomeImpact[pending] ?? { holders: 0, payout: 0 };
                        return impact.holders === 0
                          ? `${outcome?.label} wint. Niemand heeft aandelen in deze uitkomst, er wordt niets uitbetaald.`
                          : `${outcome?.label} wint. ${impact.holders} ${
                              impact.holders === 1 ? "speler deelt" : "spelers delen"
                            } in totaal ${formatPointsShort(impact.payout)} punten; de rest wordt 0.`;
                      })()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmPending}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                >
                  Bevestigen
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPending(null)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
                >
                  Terug
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? "text-good" : "text-bad"}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
