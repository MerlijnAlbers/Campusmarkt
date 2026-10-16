import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold text-ink">
          Campusmarkt
        </Link>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
