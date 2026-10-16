import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { describeAdminAction } from "@/lib/adminLog";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: studentCount }, { count: blockedCount }, { count: openCount }, { count: draftCount }, { data: recentActions }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student")
        .eq("is_blocked", true),
      supabase.from("markets").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("markets").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.rpc("admin_list_actions", { p_limit: 5 }),
    ]);

  const cards = [
    { label: "Spelers", value: studentCount ?? 0, href: "/admin/users" },
    { label: "Open markten", value: openCount ?? 0, href: "/admin/markets" },
    { label: "Concepten", value: draftCount ?? 0, href: "/admin/markets" },
    { label: "Geblokkeerde spelers", value: blockedCount ?? 0, href: "/admin/users" },
  ];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-line bg-surface p-4 hover:border-ink"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/markets/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          Nieuwe markt
        </Link>
        <Link
          href="/admin/markets"
          className="rounded-md border border-line px-4 py-2 text-sm hover:border-ink"
        >
          Markten beheren
        </Link>
        <Link
          href="/admin/users"
          className="rounded-md border border-line px-4 py-2 text-sm hover:border-ink"
        >
          Gebruikers
        </Link>
        <Link
          href="/admin/stats"
          className="rounded-md border border-line px-4 py-2 text-sm hover:border-ink"
        >
          Statistieken
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Laatste beheeracties
          </p>
          <Link href="/admin/log" className="text-sm text-accent hover:underline">
            Volledig auditlog
          </Link>
        </div>
        {recentActions && recentActions.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {recentActions.map((row) => (
              <li key={row.id} className="rounded-md bg-sunk px-3 py-2 text-sm text-ink">
                <span className="text-muted">{formatDateTime(row.created_at)}</span> —{" "}
                {row.admin_name ?? "Beheerder"}: {describeAdminAction(row)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nog geen beheeracties.</p>
        )}
      </div>
    </section>
  );
}
