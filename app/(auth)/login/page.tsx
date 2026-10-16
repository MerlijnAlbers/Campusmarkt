"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SCHOOL_DOMAIN = "my.nyenrode.nl";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [azureBusy, setAzureBusy] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail.toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`)) {
      setStatus("error");
      setMessage(`Gebruik je schoolaccount (@${SCHOOL_DOMAIN}).`);
      return;
    }

    setStatus("sending");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(
        error.message.toLowerCase().includes("school")
          ? error.message
          : "Er ging iets mis bij het versturen van de inloglink. Probeer het opnieuw.",
      );
      return;
    }

    setStatus("sent");
    setMessage(`Check je mail: we hebben een inloglink gestuurd naar ${trimmedEmail}.`);
  }

  async function handleAzureLogin() {
    setAzureBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAzureBusy(false);
      setStatus("error");
      setMessage("Inloggen met schoolaccount is nog niet ingesteld. Gebruik de inloglink per e-mail.");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-bold text-ink">Campusmarkt</h1>
        <p className="mt-1 text-sm text-muted">
          Log in met je schoolaccount om te handelen met speelpunten.
        </p>

        <button
          type="button"
          onClick={handleAzureLogin}
          disabled={azureBusy}
          className="mt-6 w-full rounded-md border border-line bg-surface px-4 py-2 font-medium text-ink hover:border-ink disabled:opacity-50"
        >
          Inloggen met schoolaccount (Microsoft)
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          of
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleMagicLink} className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm text-muted">
            Schoolmail
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder={`naam@${SCHOOL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-2 rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {status === "sending" ? "Versturen..." : "Stuur inloglink"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-3 text-sm ${status === "error" ? "text-bad" : "text-good"}`}
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
