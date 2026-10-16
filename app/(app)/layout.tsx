import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPoints } from "@/lib/format";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_LINKS = [
  { href: "/", label: "Markten" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Klassement" },
  { href: "/profile", label: "Profiel" },
];

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
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display text-xl font-bold text-ink">
            Campusmarkt
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted hover:text-ink">
                {link.label}
              </Link>
            ))}
            {profile?.role === "admin" && (
              <Link href="/admin" className="text-muted hover:text-ink">
                Beheer
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-ink">
            {profile?.display_name ?? user.email}
          </span>
          <span className="rounded-full bg-sunk px-3 py-1 font-mono text-sm text-ink">
            {formatPoints(profile?.balance ?? 0)}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
