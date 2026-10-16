import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  // Saldo staat niet in getViewer() (die is er puur voor rol/blokkade/MFA); apart ophalen.
  const supabase = await createClient();
  const { data: balanceRow } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", viewer.userId)
    .single();

  return (
    <AppShell
      displayName={viewer.displayName}
      balance={Number(balanceRow?.balance ?? 0)}
      isAdmin={viewer.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
