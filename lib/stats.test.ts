import { describe, expect, it } from "vitest";
import {
  changeDirection,
  closesWithin24h,
  formatChangeMagnitude,
  formatChangeWithArrow,
  formatClosesIn,
} from "./stats";

describe("changeDirection", () => {
  it("herkent stijging, daling en vlak (met kleine afrondingsmarge)", () => {
    expect(changeDirection(0.042)).toBe("up");
    expect(changeDirection(-0.018)).toBe("down");
    expect(changeDirection(0)).toBe("flat");
    expect(changeDirection(0.0001)).toBe("flat");
  });
});

describe("formatChangeMagnitude en formatChangeWithArrow", () => {
  it("toont de absolute waarde met 1 decimaal, zonder teken", () => {
    expect(formatChangeMagnitude(0.042)).toBe("4,2 pt");
    expect(formatChangeMagnitude(-0.018)).toBe("1,8 pt");
    expect(formatChangeMagnitude(0)).toBe("0,0 pt");
  });

  it("zet de juiste pijl ervoor, zoals op de markttegel", () => {
    expect(formatChangeWithArrow(0.042)).toBe("▲ 4,2 pt");
    expect(formatChangeWithArrow(-0.018)).toBe("▼ 1,8 pt");
    expect(formatChangeWithArrow(0)).toBe("= 0,0 pt");
  });

  it("komt overeen met de controlewaarde uit de bouwprompt (+12,25 pt afgerond op 1 decimaal)", () => {
    expect(formatChangeWithArrow(0.1225)).toBe("▲ 12,3 pt");
  });
});

describe("formatClosesIn", () => {
  const now = new Date("2026-01-10T12:00:00");

  it("toont de exacte tijd als de markt vandaag sluit", () => {
    expect(formatClosesIn(new Date("2026-01-10T17:00:00"), now)).toBe("Sluit vandaag 17:00");
  });

  it("toont het aantal dagen als de markt op een latere dag sluit", () => {
    expect(formatClosesIn(new Date("2026-01-13T09:00:00"), now)).toBe("Sluit over 3 d");
  });

  it("toont 'Gesloten' als de sluitdatum al voorbij is", () => {
    expect(formatClosesIn(new Date("2026-01-10T09:00:00"), now)).toBe("Gesloten");
  });
});

describe("closesWithin24h", () => {
  const now = new Date("2026-01-10T12:00:00");

  it("is waar binnen 24 uur en onwaar daarbuiten of in het verleden", () => {
    expect(closesWithin24h(new Date("2026-01-11T11:00:00"), now)).toBe(true);
    expect(closesWithin24h(new Date("2026-01-12T00:00:00"), now)).toBe(false);
    expect(closesWithin24h(new Date("2026-01-10T09:00:00"), now)).toBe(false);
  });
});
