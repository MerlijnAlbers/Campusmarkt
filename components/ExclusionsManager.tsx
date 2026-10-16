"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Exclusion {
  userId: string;
  displayName: string;
  reason: string | null;
}

interface Student {
  id: string;
  displayName: string;
  email: string;
}

export function ExclusionsManager({
  marketId,
  exclusions,
  students,
}: {
  marketId: string;
  exclusions: Exclusion[];
  students: Student[];
}) {
  const router = useRouter();
  const excludedIds = new Set(exclusions.map((e) => e.userId));
  const available = students.filter((s) => !excludedIds.has(s.id));

  const [selected, setSelected] = useState(available[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_add_exclusion", {
      p_market: marketId,
      p_user: selected,
      p_reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setReason("");
    router.refresh();
  }

  async function handleRemove(userId: string) {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_remove_exclusion", {
      p_market: marketId,
      p_user: userId,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Uitsluitingen</p>

      {exclusions.length === 0 ? (
        <p className="text-sm text-muted">Niemand is uitgesloten van deze markt.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {exclusions.map((ex) => (
            <li
              key={ex.userId}
              className="flex items-center justify-between gap-2 rounded-md bg-sunk px-3 py-1.5 text-sm"
            >
              <span>
                {ex.displayName}
                {ex.reason && <span className="text-muted"> — {ex.reason}</span>}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRemove(ex.userId)}
                className="text-bad hover:underline disabled:opacity-50"
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="excl-student" className="text-sm text-muted">
              Student uitsluiten
            </label>
            <select
              id="excl-student"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            >
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="excl-reason" className="text-sm text-muted">
              Reden (optioneel)
            </label>
            <input
              id="excl-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-line px-3 py-2 text-sm hover:border-ink disabled:opacity-50"
          >
            Toevoegen
          </button>
        </form>
      )}

      {message && <p className="text-sm text-bad">{message}</p>}
    </section>
  );
}
