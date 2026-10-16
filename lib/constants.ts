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

export const LEDGER_KIND_LABELS: Record<string, string> = {
  grant: "Startpunten",
  topup: "Wekelijkse aanvulling",
  trade: "Handel",
  payout: "Uitbetaling",
  refund: "Terugstorting",
  adjustment: "Aanpassing",
};

export const METRIC_DESCRIPTIONS: Record<string, string> = {
  marktwaarde: "Waarde van alle uitstaande aandelen tegen de huidige kans.",
  volume: "Totaal verhandelde punten, kopen en verkopen samen.",
  handelaren: "Unieke studenten met minstens één transactie in deze markt.",
  houders: "Studenten die nu aandelen van een uitkomst bezitten.",
  pot: "Netto door spelers ingelegd (wat de pot bij uitbetalen verliest of overhoudt).",
};
