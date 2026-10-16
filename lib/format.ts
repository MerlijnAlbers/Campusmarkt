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
