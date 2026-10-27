"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GENERIC_ERROR = "E-mailadres of code klopt niet, of de code is verlopen.";

export default function ResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code, password }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? GENERIC_ERROR);
        return;
      }
      router.push("/login?melding=wachtwoord_gewijzigd");
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-bold text-ink">Wachtwoord vergeten</h1>
        <p className="mt-1 text-sm text-muted">Vraag de beheerder om een resetcode.</p>

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
            Resetcode (8 cijfers)
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
            {busy ? "Bezig..." : "Wachtwoord instellen"}
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
      </div>
    </main>
  );
}
