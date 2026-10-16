const pointsFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPoints(value: number): string {
  const v = Math.abs(value) < 0.05 ? 0 : value;
  return `${pointsFormatter.format(v)} punten`;
}

export function formatPointsShort(value: number): string {
  const v = Math.abs(value) < 0.05 ? 0 : value;
  return pointsFormatter.format(v);
}

export function formatProbability(probability: number): string {
  return `${percentFormatter.format(probability * 100)}%`;
}

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

/** "Nu" / "2 min geleden" / "3 u geleden" / "5 d geleden". */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 1000));
  if (diffSec < 60) return "Nu";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} u geleden`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} d geleden`;
}
