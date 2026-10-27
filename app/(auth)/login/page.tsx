import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-bold text-ink">Campusmarkt</h1>
        <p className="mt-1 text-sm text-muted">
          Inloggen wordt momenteel vernieuwd (activatiecode of inloggen met Google). Deze pagina
          komt binnenkort terug.
        </p>

        <p className="mt-5 text-center text-xs text-muted">
          Nog geen account? Neem contact op via{" "}
          <a href="mailto:m.albers@my.nyenrode.nl" className="hover:text-ink">
            m.albers@my.nyenrode.nl
          </a>
        </p>

        <p className="mt-5 text-center text-xs text-muted">
          <Link href="/regels" className="hover:text-ink">
            Spelregels
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}
