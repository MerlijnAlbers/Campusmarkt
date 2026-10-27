import { createClient } from "@/lib/supabase/server";
import { AdminInvitationsManager } from "@/components/AdminInvitationsManager";

export default async function AdminInvitationsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("admin_list_invitations");

  const invitations = (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    purpose: r.purpose,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Uitnodigingen</h1>
      <p className="text-sm text-muted">
        Een account ontstaat alleen met een geldige uitnodiging. Maak hier een activatiecode of
        resetcode aan en geef die persoonlijk door — er wordt geen e-mail verstuurd.
      </p>
      <AdminInvitationsManager invitations={invitations} />
    </section>
  );
}
