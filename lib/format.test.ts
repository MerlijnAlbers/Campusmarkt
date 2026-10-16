import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("toont 'Nu' binnen de eerste minuut", () => {
    expect(formatRelativeTime(new Date("2026-01-10T11:59:30Z"), now)).toBe("Nu");
  });

  it("toont minuten geleden", () => {
    expect(formatRelativeTime(new Date("2026-01-10T11:58:00Z"), now)).toBe("2 min geleden");
  });

  it("toont uren geleden", () => {
    expect(formatRelativeTime(new Date("2026-01-10T09:00:00Z"), now)).toBe("3 u geleden");
  });

  it("toont dagen geleden", () => {
    expect(formatRelativeTime(new Date("2026-01-05T12:00:00Z"), now)).toBe("5 d geleden");
  });
});
