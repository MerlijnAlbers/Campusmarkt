import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, balance, role")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      displayName={profile?.display_name ?? user.email ?? ""}
      balance={Number(profile?.balance ?? 0)}
      isAdmin={profile?.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
