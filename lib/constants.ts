export const OUTCOME_COLORS = [
  "var(--o1)",
  "var(--o2)",
  "var(--o3)",
  "var(--o4)",
  "var(--o5)",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Concept",
  open: "Open",
  closed: "Gesloten",
  resolved: "Uitbetaald",
  cancelled: "Geannuleerd",
};
