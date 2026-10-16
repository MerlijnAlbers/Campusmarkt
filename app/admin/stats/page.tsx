import { createClient } from "@/lib/supabase/server";
import { P } from "@/lib/lmsr";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: trades }, { data: markets }, { data: outcomes }] =
    await Promise.all([
      supabase.from("profiles").select("id, role, created_at"),
      supabase.from("trades").select("id, user_id, created_at"),
      supabase.from("markets").select("id, status, winning_outcome_id, b"),
      supabase.from("outcomes").select("id, market_id, label, sort_order, q"),
    ]);

  // Server Component: dit leest bewust de actuele servertijd op verzoekmoment, geen React-render state.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const students = (profiles ?? []).filter((p) => p.role === "student");
  const totalStudents = students.length;

  const tradesByUser = new Map<string, Date[]>();
  for (const t of trades ?? []) {
    const arr = tradesByUser.get(t.user_id) ?? [];
    arr.push(new Date(t.created_at));
    tradesByUser.set(t.user_id, arr);
  }

  const activeStudentIds = students.filter((s) => tradesByUser.has(s.id)).map((s) => s.id);
  const shareWithTrade = totalStudents > 0 ? activeStudentIds.length / totalStudents : null;

  const pilotStart =
    students.length > 0
      ? new Date(Math.min(...students.map((s) => new Date(s.created_at).getTime())))
      : null;

  let tradesPerActiveStudentPerWeek: number | null = null;
  if (pilotStart && activeStudentIds.length > 0) {
    const weeksElapsed = Math.max(1, Math.ceil((nowMs - pilotStart.getTime()) / WEEK_MS));
    const tradesByActive = (trades ?? []).filter((t) => activeStudentIds.includes(t.user_id)).length;
    tradesPerActiveStudentPerWeek = tradesByActive / activeStudentIds.length / weeksElapsed;
  }

  let retentionWeek2: number | null = null;
  if (pilotStart) {
    const week1End = new Date(pilotStart.getTime() + WEEK_MS);
    const week2End = new Date(pilotStart.getTime() + 2 * WEEK_MS);
    const tradedWeek1 = new Set<string>();
    const tradedWeek2 = new Set<string>();
    for (const t of trades ?? []) {
      const d = new Date(t.created_at);
      if (d >= pilotStart && d < week1End) tradedWeek1.add(t.user_id);
      if (d >= week1End && d < week2End) tradedWeek2.add(t.user_id);
    }
    if (tradedWeek1.size > 0 && nowMs >= week2End.getTime()) {
      let returned = 0;
      for (const id of tradedWeek1) if (tradedWeek2.has(id)) returned++;
      retentionWeek2 = returned / tradedWeek1.size;
    }
  }

  const resolvedMarkets = (markets ?? []).filter(
    (m) => m.status === "resolved" && m.winning_outcome_id,
  );
  const brierScores: number[] = [];
  for (const m of resolvedMarkets) {
    const marketOutcomes = (outcomes ?? [])
      .filter((o) => o.market_id === m.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (marketOutcomes.length === 0) continue;
    const probs = P(marketOutcomes.map((o) => Number(o.q)), m.b);
    let score = 0;
    for (let i = 0; i < marketOutcomes.length; i++) {
      const actual = marketOutcomes[i].id === m.winning_outcome_id ? 1 : 0;
      score += (probs[i] - actual) ** 2;
    }
    brierScores.push(score);
  }
  const avgBrier =
    brierScores.length > 0 ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length : null;

  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
  const num = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-ink">Statistieken</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Ingelogde studenten" value={String(totalStudents)} />
        <StatCard
          label="Deel met minstens 1 trade"
          value={pct(shareWithTrade)}
          hint={totalStudents === 0 ? "Nog geen studenten ingelogd" : undefined}
        />
        <StatCard
          label="Trades per actieve student / week"
          value={num(tradesPerActiveStudentPerWeek)}
          hint={activeStudentIds.length === 0 ? "Nog niemand heeft gehandeld" : undefined}
        />
        <StatCard
          label="Terugkeer in week 2"
          value={pct(retentionWeek2)}
          hint={retentionWeek2 === null ? "Nog niet genoeg weken verstreken" : undefined}
        />
        <StatCard
          label="Brier-score (afgesloten markten)"
          value={num(avgBrier, 3)}
          hint={
            avgBrier === null
              ? "Nog geen afgesloten markten"
              : "Lager is beter; 0 = perfecte voorspelling"
          }
        />
      </div>
    </div>
  );
}
