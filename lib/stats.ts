const pointFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const timeFormatter = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });

const FLAT_EPSILON_POINTS = 0.05;

/** Richting van een verandering in kans (als fractie, bijv. 0,1225 = 12,25 procentpunt). */
export function changeDirection(diffFraction: number): "up" | "down" | "flat" {
  const points = diffFraction * 100;
  if (Math.abs(points) < FLAT_EPSILON_POINTS) return "flat";
  return points > 0 ? "up" : "down";
}

/** Alleen het getal, zonder teken: "4,2 pt". */
export function formatChangeMagnitude(diffFraction: number): string {
  const points = Math.abs(diffFraction * 100);
  const shown = points < FLAT_EPSILON_POINTS ? 0 : points;
  return `${pointFormatter.format(shown)} pt`;
}

/** Pijl + getal, zoals getoond op de markttegel: "▲ 4,2 pt" / "▼ 1,8 pt" / "= 0,0 pt". */
export function formatChangeWithArrow(diffFraction: number): string {
  const direction = changeDirection(diffFraction);
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "=";
  return `${arrow} ${formatChangeMagnitude(diffFraction)}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Sluit over 3 d" / "Sluit vandaag 17:00" / "Gesloten". */
export function formatClosesIn(closesAt: string | Date, now: Date = new Date()): string {
  const closes = new Date(closesAt);
  if (closes.getTime() <= now.getTime()) return "Gesloten";

  const dayDiff = Math.round(
    (startOfDay(closes).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff <= 0) {
    return `Sluit vandaag ${timeFormatter.format(closes)}`;
  }
  return `Sluit over ${dayDiff} d`;
}

/** Of een markt binnen 24 uur sluit (voor de rode nadruk op de tegel). */
export function closesWithin24h(closesAt: string | Date, now: Date = new Date()): boolean {
  const diff = new Date(closesAt).getTime() - now.getTime();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}
