import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";

describe("buildCsv", () => {
  it("bouwt een header- en datarij, gescheiden door CRLF", () => {
    const csv = buildCsv(
      [
        { header: "Naam", value: (r: { name: string }) => r.name },
        { header: "Aantal", value: (r: { n: number }) => String(r.n) },
      ],
      [{ name: "Sanne", n: 5 }],
    );
    expect(csv).toBe("Naam,Aantal\r\nSanne,5");
  });

  it("zet velden met komma's, aanhalingstekens of newlines tussen aanhalingstekens", () => {
    const csv = buildCsv(
      [{ header: "Titel", value: (r: { title: string }) => r.title }],
      [{ title: 'Komt er een "koffieautomaat", of niet?' }],
    );
    expect(csv).toBe('Titel\r\n"Komt er een ""koffieautomaat"", of niet?"');
  });
});
