import { createClient } from "@/lib/supabase/server";
import { DisplayNameForm } from "@/components/DisplayNameForm";
import { AnonymityToggle } from "@/components/AnonymityToggle";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, show_name_in_feed")
    .eq("id", user.id)
    .single();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-ink">Profiel</h1>
      <p className="text-sm text-muted">Schoolmail: {profile?.email}</p>
      <DisplayNameForm userId={user.id} initialName={profile?.display_name ?? ""} />
      <AnonymityToggle userId={user.id} initialShowName={profile?.show_name_in_feed ?? true} />
    </section>
  );
}
