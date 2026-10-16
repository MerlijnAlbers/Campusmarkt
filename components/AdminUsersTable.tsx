"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatPointsShort } from "@/lib/format";

export interface AdminUserRow {
  userId: string;
  displayName: string;
  email: string;
  balance: number;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  lastTradeAt: string | null;
  tradeCount: number;
}

type ActiveAction = { userId: string; kind: "block" | "unblock" | "points" } | null;

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveAction>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function startAction(userId: string, kind: "block" | "unblock" | "points") {
    setActive({ userId, kind });
    setReason("");
    setAmount("");
    setMessage(null);
  }

  function cancelAction() {
    setActive(null);
    setMessage(null);
  }

  async function confirmBlock(blocked: boolean) {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_blocked", {
      p_user: active.userId,
      p_blocked: blocked,
      p_reason: blocked ? reason.trim() : undefined,
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setActive(null);
    router.refresh();
  }

  async function confirmPoints() {
    if (!active) return;
    const parsed = Number(amount);
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_adjust_points", {
      p_user: active.userId,
      p_amount: parsed,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    setActive(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-semibold">Naam</th>
              <th className="px-3 py-2 font-semibold">E-mail</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo</th>
              <th className="px-3 py-2 text-right font-semibold">Transacties</th>
              <th className="px-3 py-2 font-semibold">Laatste transactie</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Acties</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-line last:border-none align-top">
                <td className="px-3 py-2 text-ink">{u.displayName}</td>
                <td className="px-3 py-2 text-muted">{u.email}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">
                  {formatPointsShort(u.balance)}
                </td>
                <td className="px-3 py-2 text-right text-ink">{u.tradeCount}</td>
                <td className="px-3 py-2 text-muted">
                  {u.lastTradeAt ? formatDateTime(u.lastTradeAt) : "—"}
                </td>
                <td className="px-3 py-2">
                  {u.isBlocked ? (
                    <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
                      Geblokkeerd{u.blockedReason ? `: ${u.blockedReason}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Actief</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {u.isBlocked ? (
                      <button
                        type="button"
                        onClick={() => startAction(u.userId, "unblock")}
                        className="rounded-md border border-line px-2 py-1 text-xs hover:border-ink"
                      >
                        Deblokkeren
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startAction(u.userId, "block")}
                        className="rounded-md border border-line px-2 py-1 text-xs text-bad hover:border-bad"
                      >
                        Blokkeren
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startAction(u.userId, "points")}
                      className="rounded-md border border-line px-2 py-1 text-xs hover:border-ink"
                    >
                      Punten aanpassen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="rounded-lg border border-line bg-sunk p-4">
          {(() => {
            const user = users.find((u) => u.userId === active.userId);
            if (!user) return null;

            if (active.kind === "unblock") {
              return (
                <>
                  <p className="text-sm text-ink">
                    {user.displayName} wordt gedeblokkeerd en kan weer handelen.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirmBlock(false)}
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                    >
                      Bevestigen
                    </button>
                    <button
                      type="button"
                      onClick={cancelAction}
                      className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
                    >
                      Terug
                    </button>
                  </div>
                </>
              );
            }

            if (active.kind === "block") {
              return (
                <>
                  <p className="text-sm text-ink">
                    {user.displayName} wordt geblokkeerd en kan niet meer handelen (meekijken blijft
                    mogelijk). Geef een reden op.
                  </p>
                  <label htmlFor="block-reason" className="mt-2 block text-sm text-muted">
                    Reden
                  </label>
                  <input
                    id="block-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-md border border-line bg-surface px-3 py-2 text-ink"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy || reason.trim().length === 0}
                      onClick={() => confirmBlock(true)}
                      className="rounded-md bg-bad px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Blokkeren
                    </button>
                    <button
                      type="button"
                      onClick={cancelAction}
                      className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
                    >
                      Terug
                    </button>
                  </div>
                </>
              );
            }

            const parsedAmount = Number(amount);
            const validAmount =
              amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount !== 0 &&
              parsedAmount >= -1000 && parsedAmount <= 1000;
            const validReason = reason.trim().length >= 10;

            return (
              <>
                <p className="text-sm text-ink">
                  Huidig saldo van {user.displayName}: {formatPointsShort(user.balance)} punten.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="points-amount" className="text-sm text-muted">
                      Aanpassing (tussen -1.000 en 1.000, niet 0)
                    </label>
                    <input
                      id="points-amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-ink"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="points-reason" className="text-sm text-muted">
                      Reden (minstens 10 tekens)
                    </label>
                    <input
                      id="points-reason"
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-64 rounded-md border border-line bg-surface px-3 py-2 text-ink"
                    />
                  </div>
                </div>
                {validAmount && (
                  <p className="mt-2 text-sm text-muted">
                    Saldo gaat van {formatPointsShort(user.balance)} naar{" "}
                    {formatPointsShort(user.balance + parsedAmount)} punten.
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy || !validAmount || !validReason}
                    onClick={confirmPoints}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                  >
                    Bevestigen
                  </button>
                  <button
                    type="button"
                    onClick={cancelAction}
                    className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
                  >
                    Terug
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? "text-good" : "text-bad"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
