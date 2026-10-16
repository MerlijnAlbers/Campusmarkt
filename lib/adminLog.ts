import { STATUS_LABELS } from "@/lib/constants";
import { formatPointsShort } from "@/lib/format";

export interface AdminActionRow {
  id: number;
  admin_id: string;
  admin_name: string | null;
  action: string;
  market_id: string | null;
  market_title: string | null;
  target_user: string | null;
  target_name: string | null;
  details: unknown;
  created_at: string;
}

function asRecord(details: unknown): Record<string, unknown> {
  return typeof details === "object" && details !== null ? (details as Record<string, unknown>) : {};
}

/** Vertaalt één rij uit admin_list_actions() naar een leesbare Nederlandse zin. */
export function describeAdminAction(row: AdminActionRow): string {
  const d = asRecord(row.details);
  const market = row.market_title ? `'${row.market_title}'` : "een markt";
  const target = row.target_name ?? "een speler";

  switch (row.action) {
    case "create_market":
      return `Markt '${String(d.title ?? row.market_title ?? "?")}' aangemaakt (${
        d.open ? "direct open" : "als concept"
      }).`;
    case "set_status":
      return `Markt ${market}: status gewijzigd van ${STATUS_LABELS[String(d.from)] ?? d.from} naar ${
        STATUS_LABELS[String(d.to)] ?? d.to
      }.`;
    case "resolve_market":
      return `Markt ${market} afgewikkeld: ${Number(d.winners ?? 0)} ${
        Number(d.winners ?? 0) === 1 ? "speler kreeg" : "spelers kregen"
      } in totaal ${formatPointsShort(Number(d.total_payout ?? 0))} punten uitbetaald.`;
    case "cancel_market":
      return `Markt ${market} geannuleerd: ${Number(d.refunded_users ?? 0)} ${
        Number(d.refunded_users ?? 0) === 1 ? "speler kreeg" : "spelers kregen"
      } in totaal ${formatPointsShort(Number(d.total_refund ?? 0))} punten terug.`;
    case "delete_market":
      return `Markt '${String(d.title ?? "?")}' verwijderd.`;
    case "exclude":
      return `${target} uitgesloten van markt ${market}${d.reason ? `: ${String(d.reason)}` : "."}`;
    case "unexclude":
      return `Uitsluiting van ${target} in markt ${market} opgeheven.`;
    case "block":
      return `${target} geblokkeerd${d.reason ? `: ${String(d.reason)}` : "."}`;
    case "unblock":
      return `${target} gedeblokkeerd.`;
    case "adjust_points": {
      const amount = Number(d.amount ?? 0);
      const sign = amount > 0 ? "+" : "";
      return `Punten van ${target} aangepast met ${sign}${formatPointsShort(amount)}: ${String(d.reason ?? "")}`;
    }
    default:
      return row.action;
  }
}
