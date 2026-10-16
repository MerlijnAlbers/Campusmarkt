"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DisplayNameForm({ userId, initialName }: { userId: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage({ ok: false, text: "Vul een bijnaam in." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);
    setSubmitting(false);

    if (error) {
      setMessage({ ok: false, text: "Er ging iets mis bij het opslaan van je bijnaam." });
      return;
    }

    setMessage({ ok: true, text: "Bijnaam opgeslagen." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-sm">
      <label htmlFor="display-name" className="text-sm text-muted">
        Bijnaam
      </label>
      <input
        id="display-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
      />
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 self-start rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
      >
        {submitting ? "Bezig..." : "Opslaan"}
      </button>
      {message && (
        <p className={`text-sm ${message.ok ? "text-good" : "text-bad"}`} role="status">
          {message.text}
        </p>
      )}
    </form>
  );
}
