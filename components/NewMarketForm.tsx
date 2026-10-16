"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPointsShort, formatProbability } from "@/lib/format";
import { P, tcost } from "@/lib/lmsr";
import { createClient } from "@/lib/supabase/client";

function defaultClosesAt(): string {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function NewMarketForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [source, setSource] = useState("");
  const [b, setB] = useState("150");
  const [outcomesText, setOutcomesText] = useState("Ja\nNee");
  const [closesAt, setClosesAt] = useState(defaultClosesAt());
  const [openNow, setOpenNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const outcomes = useMemo(
    () => [...new Set(outcomesText.split(/\n|,/).map((s) => s.trim()).filter(Boolean))],
    [outcomesText],
  );
  const bNum = Number(b);

  const hint = useMemo(() => {
    const n = Math.max(2, outcomes.length);
    if (!(bNum >= 10)) return "Kies een liquiditeit b van minimaal 10.";
    const market = { q: Array(n).fill(0), b: bNum };
    const cost = tcost(market, 0, 100);
    const newProb = P([100, ...Array(n - 1).fill(0)], bNum)[0];
    return `De pot verliest maximaal ${formatPointsShort(bNum * Math.log(n))} pnt. 100 aandelen ${
      outcomes[0] ?? "van uitkomst 1"
    } kopen kost bij de start ${formatPointsShort(cost)} pnt en zet de kans van ${formatProbability(
      1 / n,
    )} op ${formatProbability(newProb)}.`;
  }, [outcomes, bNum]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ ok: false, text: "Vul een stelling in." });
      return;
    }
    if (outcomes.length < 2 || outcomes.length > 5) {
      setMessage({ ok: false, text: "Geef 2 tot 5 verschillende uitkomsten op." });
      return;
    }
    if (!(bNum >= 10)) {
      setMessage({ ok: false, text: "Kies een liquiditeit b van minimaal 10." });
      return;
    }
    if (!criteria.trim() || !source.trim()) {
      setMessage({ ok: false, text: "Vul de resolutiecriteria en de bron in." });
      return;
    }
    const closesDate = new Date(closesAt);
    if (!(closesDate.getTime() > Date.now())) {
      setMessage({ ok: false, text: "De sluitdatum moet in de toekomst liggen." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_market", {
      p_title: title.trim(),
      p_description: description.trim(),
      p_criteria: criteria.trim(),
      p_source: source.trim(),
      p_b: bNum,
      p_outcomes: outcomes,
      p_opens_at: new Date().toISOString(),
      p_closes_at: closesDate.toISOString(),
      p_open: openNow,
    });
    setSubmitting(false);

    if (error) {
      setMessage({ ok: false, text: error.message || "Er ging iets mis bij het aanmaken." });
      return;
    }

    router.push(`/admin/markets/${data}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm text-muted">
          Stelling of vraag
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijv. Komt er voor de kerst een koffieautomaat in gebouw B?"
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm text-muted">
          Toelichting (optioneel)
        </label>
        <textarea
          id="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="criteria" className="text-sm text-muted">
          Resolutiecriteria
        </label>
        <textarea
          id="criteria"
          rows={2}
          required
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder="Wanneer resolveert dit naar welke uitkomst?"
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="source" className="text-sm text-muted">
          Bron
        </label>
        <input
          id="source"
          type="text"
          required
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Waar wordt de uitkomst mee vastgesteld?"
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="outcomes" className="text-sm text-muted">
          Uitkomsten (één per regel, 2 tot 5)
        </label>
        <textarea
          id="outcomes"
          rows={3}
          value={outcomesText}
          onChange={(e) => setOutcomesText(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="b" className="text-sm text-muted">
          Liquiditeit b
        </label>
        <input
          id="b"
          type="number"
          min="10"
          step="10"
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="w-32 rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
        <p className="text-sm text-muted">{hint}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="closes-at" className="text-sm text-muted">
          Sluitdatum
        </label>
        <input
          id="closes-at"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          className="w-64 rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={openNow}
          onChange={(e) => setOpenNow(e.target.checked)}
        />
        Direct openen voor studenten (anders blijft de markt een concept)
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
      >
        {submitting ? "Bezig..." : "Stelling aanmaken"}
      </button>

      {message && (
        <p className={`text-sm ${message.ok ? "text-good" : "text-bad"}`} role="status">
          {message.text}
        </p>
      )}
    </form>
  );
}
