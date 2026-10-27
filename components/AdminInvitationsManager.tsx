"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";

type Purpose = "activate" | "reset";

export interface InvitationRow {
  id: string;
  email: string;
  purpose: Purpose;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface RevealedCode {
  email: string;
  purpose: Purpose;
  code: string;
  expiresAt: string;
}

const PURPOSE_LABELS: Record<Purpose, string> = {
  activate: "Activatie",
  reset: "Wachtwoordreset",
};

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-good/15 text-good",
  Gebruikt: "bg-sunk text-muted",
  Verlopen: "bg-sunk text-muted",
  Ingetrokken: "bg-bad/15 text-bad",
  "Geblokkeerd na 5 pogingen": "bg-bad/15 text-bad",
};

function formatCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

function buildMessage(code: string, expiresAt: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `Je activatiecode voor Campusmarkt is ${code}. Ga naar ${origin}/activate. De code is geldig tot ${formatDateTime(expiresAt)}.`;
}

function downloadCsv(filename: string, rows: RevealedCode[]) {
  const header = "email,code,geldig_tot";
  const lines = rows.map(
    (r) => `"${r.email}","${r.code}","${formatDateTime(r.expiresAt)}"`,
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminInvitationsManager({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();

  // ===== Eén uitnodiging =====
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("activate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedCode | null>(null);
  const [copied, setCopied] = useState<"code" | "message" | null>(null);

  async function createOne(e: React.FormEvent) {
    e.preventDefault();
    await createInvitation(email.trim(), purpose);
  }

  async function createInvitation(targetEmail: string, targetPurpose: Purpose) {
    setBusy(true);
    setError(null);
    setRevealed(null);
    const supabase = createClient();
    const { data: code, error: rpcError } = await supabase.rpc("admin_create_invitation", {
      p_email: targetEmail,
      p_purpose: targetPurpose,
    });
    setBusy(false);
    if (rpcError || !code) {
      setError(rpcError?.message ?? "Er ging iets mis bij het aanmaken van de code.");
      return;
    }
    const expiresAt = new Date(
      Date.now() + (targetPurpose === "activate" ? 48 : 2) * 60 * 60 * 1000,
    ).toISOString();
    setRevealed({ email: targetEmail, purpose: targetPurpose, code, expiresAt });
    setEmail("");
    router.refresh();
  }

  async function copy(text: string, kind: "code" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Klembord niet beschikbaar (bv. geen HTTPS): de code staat gewoon op het scherm.
    }
  }

  // ===== Meerdere tegelijk =====
  const [bulkText, setBulkText] = useState("");
  const [bulkPurpose, setBulkPurpose] = useState<Purpose>("activate");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<(RevealedCode | { email: string; error: string })[] | null>(null);

  async function createBulk(e: React.FormEvent) {
    e.preventDefault();
    const emails = Array.from(
      new Set(
        bulkText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      ),
    );
    if (emails.length === 0) return;

    setBulkBusy(true);
    setBulkResults(null);
    const supabase = createClient();
    const results: (RevealedCode | { email: string; error: string })[] = [];

    for (const targetEmail of emails) {
      const { data: code, error: rpcError } = await supabase.rpc("admin_create_invitation", {
        p_email: targetEmail,
        p_purpose: bulkPurpose,
      });
      if (rpcError || !code) {
        results.push({ email: targetEmail, error: rpcError?.message ?? "Onbekende fout" });
      } else {
        results.push({
          email: targetEmail,
          purpose: bulkPurpose,
          code,
          expiresAt: new Date(
            Date.now() + (bulkPurpose === "activate" ? 48 : 2) * 60 * 60 * 1000,
          ).toISOString(),
        });
      }
    }

    setBulkBusy(false);
    setBulkResults(results);
    setBulkText("");
    router.refresh();
  }

  // ===== Overzicht =====
  const [statusFilter, setStatusFilter] = useState("alle");
  const [purposeFilter, setPurposeFilter] = useState<"alle" | Purpose>("alle");
  const [search, setSearch] = useState("");
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [newCodeConfirm, setNewCodeConfirm] = useState<InvitationRow | null>(null);
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const statuses = useMemo(
    () => Array.from(new Set(invitations.map((i) => i.status))).sort(),
    [invitations],
  );

  const filtered = invitations.filter((i) => {
    if (statusFilter !== "alle" && i.status !== statusFilter) return false;
    if (purposeFilter !== "alle" && i.purpose !== purposeFilter) return false;
    if (search.trim() && !i.email.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  async function revoke(id: string) {
    setOverviewBusy(true);
    setOverviewError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_revoke_invitation", { p_id: id });
    setOverviewBusy(false);
    setRevokeConfirm(null);
    if (rpcError) {
      setOverviewError(rpcError.message);
      return;
    }
    router.refresh();
  }

  async function confirmNewCode() {
    if (!newCodeConfirm) return;
    setNewCodeConfirm(null);
    await createInvitation(newCodeConfirm.email, newCodeConfirm.purpose);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ===== Eén uitnodiging ===== */}
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Eén uitnodiging
        </h2>
        <form onSubmit={createOne} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-email" className="text-sm text-muted">
              E-mailadres
            </label>
            <input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="inv-purpose" className="text-sm text-muted">
              Doel
            </label>
            <select
              id="inv-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as Purpose)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="activate">Activatie</option>
              <option value="reset">Wachtwoordreset</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Bezig..." : "Code aanmaken"}
          </button>
        </form>
        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        {revealed && (
          <div className="mt-2 rounded-lg border border-accent/40 bg-sunk p-4">
            <p className="text-sm text-muted">
              {revealed.email} · {PURPOSE_LABELS[revealed.purpose]}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-ink">
              {formatCode(revealed.code)}
            </p>
            <p className="mt-1 text-sm text-muted">
              Geldig tot {formatDateTime(revealed.expiresAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(revealed.code, "code")}
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                {copied === "code" ? "Gekopieerd!" : "Kopieer code"}
              </button>
              <button
                type="button"
                onClick={() => copy(buildMessage(revealed.code, revealed.expiresAt), "message")}
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                {copied === "message" ? "Gekopieerd!" : "Kopieer bericht"}
              </button>
              <button
                type="button"
                onClick={() => setRevealed(null)}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Sluiten
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Deze code wordt niet opnieuw getoond. Geef hem persoonlijk door, bijvoorbeeld via
              WhatsApp of Teams.
            </p>
          </div>
        )}
      </section>

      {/* ===== Meerdere tegelijk ===== */}
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Meerdere tegelijk
        </h2>
        <form onSubmit={createBulk} className="flex flex-col gap-2">
          <label htmlFor="inv-bulk" className="text-sm text-muted">
            E-mailadressen (één per regel)
          </label>
          <textarea
            id="inv-bulk"
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="inv-bulk-purpose" className="text-sm text-muted">
                Doel
              </label>
              <select
                id="inv-bulk-purpose"
                value={bulkPurpose}
                onChange={(e) => setBulkPurpose(e.target.value as Purpose)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
              >
                <option value="activate">Activatie</option>
                <option value="reset">Wachtwoordreset</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={bulkBusy || bulkText.trim().length === 0}
              className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
            >
              {bulkBusy ? "Bezig..." : "Codes aanmaken"}
            </button>
          </div>
        </form>

        {bulkResults && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-2 font-semibold">E-mail</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Code</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Geldig tot</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r) => (
                    <tr key={r.email} className="border-b border-line last:border-none">
                      <td className="px-3 py-2 text-ink">{r.email}</td>
                      {"error" in r ? (
                        <td className="px-3 py-2 text-bad" colSpan={2}>
                          {r.error}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono text-ink">{formatCode(r.code)}</td>
                          <td className="px-3 py-2 text-muted">{formatDateTime(r.expiresAt)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    "campusmarkt-uitnodigingen.csv",
                    bulkResults.filter((r): r is RevealedCode => !("error" in r)),
                  )
                }
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                Exporteer als CSV
              </button>
              <button
                type="button"
                onClick={() => setBulkResults(null)}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Sluiten
              </button>
            </div>
            <p className="text-xs text-muted">
              Deze codes worden niet opnieuw getoond. Exporteer of kopieer ze nu.
            </p>
          </div>
        )}
      </section>

      {/* ===== Overzicht ===== */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Overzicht</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-sm text-muted">
              Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="alle">Alle</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-purpose" className="text-sm text-muted">
              Doel
            </label>
            <select
              id="filter-purpose"
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value as "alle" | Purpose)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="alle">Alle</option>
              <option value="activate">Activatie</option>
              <option value="reset">Wachtwoordreset</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-search" className="text-sm text-muted">
              Zoeken op e-mailadres
            </label>
            <input
              id="filter-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
            />
          </div>
        </div>

        {overviewError && (
          <p className="text-sm text-bad" role="alert">
            {overviewError}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-2 font-semibold">E-mail</th>
                <th scope="col" className="px-3 py-2 font-semibold">Doel</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Verloopt op</th>
                <th scope="col" className="px-3 py-2 font-semibold">Aangemaakt op</th>
                <th scope="col" className="px-3 py-2 font-semibold">Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-line last:border-none align-top">
                  <td className="px-3 py-2 text-ink">{inv.email}</td>
                  <td className="px-3 py-2 text-muted">{PURPOSE_LABELS[inv.purpose]}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[inv.status] ?? "bg-sunk text-muted"}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{formatDateTime(inv.expiresAt)}</td>
                  <td className="px-3 py-2 text-muted">{formatDateTime(inv.createdAt)}</td>
                  <td className="px-3 py-2">
                    {inv.status === "Open" ? (
                      revokeConfirm === inv.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted">Zeker weten?</span>
                          <button
                            type="button"
                            disabled={overviewBusy}
                            onClick={() => revoke(inv.id)}
                            className="rounded-md bg-bad px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Intrekken
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokeConfirm(null)}
                            className="rounded-md border border-line px-2 py-1 text-xs hover:border-ink"
                          >
                            Terug
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevokeConfirm(inv.id)}
                          className="rounded-md border border-line px-2 py-1 text-xs text-bad hover:border-bad"
                        >
                          Intrekken
                        </button>
                      )
                    ) : newCodeConfirm?.id === inv.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Nieuwe code aanmaken?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={confirmNewCode}
                          className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-ink disabled:opacity-50"
                        >
                          Bevestigen
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewCodeConfirm(null)}
                          className="rounded-md border border-line px-2 py-1 text-xs hover:border-ink"
                        >
                          Terug
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNewCodeConfirm(inv)}
                        className="rounded-md border border-line px-2 py-1 text-xs hover:border-ink"
                      >
                        Nieuwe code
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted">
                    Geen uitnodigingen gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
