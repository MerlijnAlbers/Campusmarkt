"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const GENERIC_ERROR = "E-mailadres of code klopt niet, of de code is verlopen.";

export default function ActivatePage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleCodeChange(value: string) {
    setCode(value.replace(/\D/g, "").slice(0, 8));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (code.length !== 8) {
      setError("Vul de volledige 8-cijferige code in.");
      return;
    }
    if (password.length < 8) {
      setError("Het wachtwoord moet minstens 8 tekens zijn.");
      return;
    }
    if (password !== confirm) {
      setError("De wachtwoorden komen niet overeen.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const trimmedEmail = email.trim();

    const { data: codeOk, error: checkError } = await supabase.rpc("check_invitation", {
      p_email: trimmedEmail,
      p_code: code,
      p_purpose: "activate",
    });
    if (checkError || !codeOk) {
      setBusy(false);
      setError(GENERIC_ERROR);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { activation_code: code } },
    });
    setBusy(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? "Dit account is al geactiveerd. Log in of vraag een resetcode aan."
          : GENERIC_ERROR,
      );
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
          <Image
            src="/logo-full.png"
            alt="Campusmarkt"
            width={900}
            height={653}
            className="mx-auto h-auto w-40"
            priority
          />
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">Welkom bij Campusmarkt!</h1>
          <p className="mt-2 text-sm text-muted">
            Je account is geactiveerd en je hebt 1.000 startpunten gekregen.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink"
          >
            Naar de Markten
          </Link>
        </div>
      </main>
    );
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
        <p className="mt-3 text-center text-sm text-muted">
          Activeer je account met de code die je van je beheerder hebt gekregen.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
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

          <label htmlFor="code" className="mt-1 text-sm text-muted">
            Activatiecode (8 cijfers)
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              handleCodeChange(e.clipboardData.getData("text"));
            }}
            className="rounded-md border border-line bg-surface px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-ink"
          />

          <label htmlFor="password" className="mt-1 text-sm text-muted">
            Nieuw wachtwoord
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Minimaal 8 tekens"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="rounded-md border border-line px-3 text-sm text-muted hover:border-ink"
            >
              {showPassword ? "Verberg" : "Toon"}
            </button>
          </div>

          <label htmlFor="confirm" className="mt-1 text-sm text-muted">
            Bevestig wachtwoord
          </label>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Herhaal wachtwoord"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          {confirm.length > 0 && confirm !== password && (
            <p className="text-sm text-bad" role="alert">
              De wachtwoorden komen nog niet overeen.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Account activeren"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-bad" role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="text-ink hover:underline">
            Terug naar inloggen
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-muted">
          Nog geen account? Neem contact op via{" "}
          <a href="mailto:m.albers@my.nyenrode.nl" className="hover:text-ink">
            m.albers@my.nyenrode.nl
          </a>
        </p>
      </div>
    </main>
  );
}
