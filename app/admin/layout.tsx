import Link from "next/link";

const ADMIN_NAV = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/markets/new", label: "Nieuwe markt" },
  { href: "/admin/stats", label: "Statistieken" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 overflow-x-auto whitespace-nowrap border-b border-line bg-surface px-4 py-2 text-sm sm:px-6">
        {ADMIN_NAV.map((link) => (
          <Link key={link.href} href={link.href} className="text-muted hover:text-ink">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
