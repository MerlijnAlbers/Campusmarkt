"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AnonymityToggle({
  userId,
  initialShowName,
}: {
  userId: string;
  initialShowName: boolean;
}) {
  const router = useRouter();
  const [showName, setShowName] = useState(initialShowName);
  const [busy, setBusy] = useState(false);

  async function handleChange(checked: boolean) {
    setShowName(checked);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ show_name_in_feed: checked })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setShowName(!checked);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1 max-w-sm">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={showName}
          disabled={busy}
          onChange={(e) => handleChange(e.target.checked)}
        />
        Toon mijn bijnaam in het logboek
      </label>
      <p className="text-xs text-muted">
        Staat dit uit, dan zien andere studenten je transacties als &quot;Anonieme student&quot;.
        Jij blijft je eigen transacties altijd met je eigen bijnaam zien.
      </p>
    </div>
  );
}
