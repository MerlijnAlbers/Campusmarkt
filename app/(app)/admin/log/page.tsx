import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { describeAdminAction } from "@/lib/adminLog";

export default async function AdminLogPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("admin_list_actions", { p_limit: 200 });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Auditlog</h1>
      <p className="text-sm text-muted">
        Elke beheerhandeling (markten afwikkelen/annuleren/verwijderen, spelers blokkeren of
        punten aanpassen, uitsluitingen) wordt hier automatisch gelogd door de database — dit
        overzicht kan niet worden bewerkt of verwijderd.
      </p>

      {rows && rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
              <span className="text-muted">{formatDateTime(row.created_at)}</span> —{" "}
              <span className="font-medium text-ink">{row.admin_name ?? "Beheerder"}</span>:{" "}
              <span className="text-ink">{describeAdminAction(row)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Nog geen beheeracties.</p>
      )}
    </section>
  );
}
