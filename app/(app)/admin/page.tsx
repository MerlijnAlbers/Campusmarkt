import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const STATUS_ORDER = ["draft", "open", "closed", "resolved", "cancelled"];

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const { data: markets } = await supabase
    .from("markets")
    .select("*")
    .order("created_at", { ascending: false });

  const byStatus = new Map<string, typeof markets>();
  for (const m of markets ?? []) {
    const list = byStatus.get(m.status) ?? [];
    list.push(m);
    byStatus.set(m.status, list);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Markten beheren</h1>
        <Link
          href="/admin/markets/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          Nieuwe markt
        </Link>
      </div>

      {STATUS_ORDER.map((status) => {
        const list = byStatus.get(status);
        if (!list || list.length === 0) return null;
        return (
          <div key={status}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {STATUS_LABELS[status] ?? status} ({list.length})
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {list.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/markets/${m.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3 hover:border-ink"
                >
                  <span className="font-medium text-ink">{m.title}</span>
                  <span className="text-xs text-muted">Sluit op {formatDateTime(m.closes_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {(markets ?? []).length === 0 && (
        <p className="text-muted">Nog geen markten. Maak de eerste aan.</p>
      )}
    </section>
  );
}
