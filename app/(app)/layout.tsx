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
      <header className="border-b border-line bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="font-display text-xl font-bold text-ink">
            Campusmarkt
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden font-mono text-sm text-ink sm:inline">
              {profile?.display_name ?? user.email}
            </span>
            <span className="whitespace-nowrap rounded-full bg-sunk px-3 py-1 font-mono text-sm text-ink">
              {formatPoints(profile?.balance ?? 0)}
            </span>
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto whitespace-nowrap px-4 pb-2 text-sm sm:px-6">
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
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-line px-4 py-4 text-xs text-muted sm:px-6">
        <Link href="/regels" className="hover:text-ink">
          Spelregels
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
