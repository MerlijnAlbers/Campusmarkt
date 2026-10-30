"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const FOUT_MELDINGEN: Record<string, string> = {
  google: "Inloggen met Google is niet gelukt. Heeft dit Google-account al een uitnodiging? Vraag de beheerder om er een voor je e-mailadres te maken.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const foutParam = searchParams.get("fout");
  const meldingParam = searchParams.get("melding");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    foutParam ? FOUT_MELDINGEN[foutParam] ?? "Inloggen is niet gelukt. Probeer het opnieuw." : null,
  );

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError("E-mailadres of wachtwoord klopt niet.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleBusy(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setGoogleBusy(false);
      setError("Inloggen met Google is nog niet beschikbaar.");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <Image
          src="/logo-full.png"
          alt="Campusmarkt"
          width={900}
          height={653}
          className="mx-auto h-auto w-48"
          priority
        />
        <p className="mt-3 text-center text-sm text-muted">Log in om te handelen met speelpunten.</p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleBusy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2 font-medium text-ink hover:border-ink disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3C29.4 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5C9.6 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.7 4.8-5 6.2l6.5 5.3C40.8 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Inloggen met Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          of
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handlePasswordLogin} className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm text-muted">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          <label htmlFor="password" className="mt-1 text-sm text-muted">
            Wachtwoord
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Inloggen"}
          </button>
        </form>

        <div className="mt-3 flex justify-between text-sm">
          <Link href="/activate" className="text-ink hover:underline">
            Account activeren
          </Link>
          <Link href="/reset" className="text-ink hover:underline">
            Wachtwoord vergeten?
          </Link>
        </div>

        {(error || meldingParam) && (
          <p className={`mt-3 text-sm ${error ? "text-bad" : "text-good"}`} role="status">
            {error ?? "Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord."}
          </p>
        )}

        <p className="mt-5 text-center text-xs text-muted">
          Nog geen account? Neem contact op via{" "}
          <a href="mailto:m.albers@my.nyenrode.nl" className="hover:text-ink">
            m.albers@my.nyenrode.nl
          </a>
        </p>

        <p className="mt-3 text-center text-xs text-muted">
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
