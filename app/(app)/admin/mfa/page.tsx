"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "loading" | "verified" | "need-code" | "enroll";

export default function AdminMfaPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      setStage("verified");
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const existing = factors?.totp?.[0];
    if (existing) {
      setFactorId(existing.id);
      setStage("need-code");
    } else {
      setStage("enroll");
    }
  }

  useEffect(() => {
    // Eenmalige opvraag bij het laden van de pagina (geen extern systeem om op te abonneren).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function startEnroll() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Campusmarkt beheerder",
    });
    setBusy(false);
    if (error || !data) {
      setMessage({ ok: false, text: error?.message ?? "Kon geen QR-code genereren." });
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      setBusy(false);
      setMessage({ ok: false, text: challengeError?.message ?? "Er ging iets mis." });
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setMessage({ ok: false, text: "Onjuiste code. Probeer het opnieuw." });
      return;
    }

    setStage("verified");
    router.push("/admin");
    router.refresh();
  }

  if (stage === "loading") {
    return <p className="text-muted">Bezig met laden...</p>;
  }

  if (stage === "verified") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Tweestapsverificatie actief</h1>
        <p className="text-muted">Je bent geverifieerd. Je kunt nu bij het beheer.</p>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink"
        >
          Naar het beheer
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Tweestapsverificatie</h1>

      {stage === "enroll" && !qrCode && (
        <>
          <p className="text-muted">
            Voor toegang tot het beheer moet je eenmalig tweestapsverificatie instellen met een
            authenticator-app (bijv. Google Authenticator, Microsoft Authenticator of 1Password).
          </p>
          <button
            type="button"
            onClick={startEnroll}
            disabled={busy}
            className="self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Bezig..." : "QR-code genereren"}
          </button>
        </>
      )}

      {stage === "enroll" && qrCode && (
        <>
          <p className="text-muted">Scan deze QR-code met je authenticator-app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="QR-code voor tweestapsverificatie" className="h-48 w-48 self-start" />
          {secret && (
            <p className="text-xs text-muted">
              Kan je niet scannen? Voer deze code handmatig in: <code className="font-mono">{secret}</code>
            </p>
          )}
          <form onSubmit={verifyCode} className="flex flex-col gap-2">
            <label htmlFor="mfa-code" className="text-sm text-muted">
              Vul de 6-cijferige code uit de app in om te bevestigen
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
            >
              {busy ? "Bezig..." : "Bevestigen"}
            </button>
          </form>
        </>
      )}

      {stage === "need-code" && (
        <>
          <p className="text-muted">Voer de 6-cijferige code uit je authenticator-app in.</p>
          <form onSubmit={verifyCode} className="flex flex-col gap-2">
            <label htmlFor="mfa-code" className="text-sm text-muted">
              Code
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-40 rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
            >
              {busy ? "Bezig..." : "Bevestigen"}
            </button>
          </form>
        </>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? "text-good" : "text-bad"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
