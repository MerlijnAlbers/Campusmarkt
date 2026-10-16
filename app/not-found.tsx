import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Pagina niet gevonden</h1>
      <p className="text-muted">Deze pagina bestaat niet (meer).</p>
      <Link href="/" className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink">
        Terug naar de markten
      </Link>
    </main>
  );
}
