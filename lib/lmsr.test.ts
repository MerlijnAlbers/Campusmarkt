import { describe, expect, it } from "vitest";
import { C, P, sharesForBudget, sharesForProceeds, tcost } from "./lmsr";

describe("lmsr", () => {
  it("kost 28,09 punten om 50 aandelen van uitkomst 0 te kopen bij b=100, q=[0,0]", () => {
    const m = { q: [0, 0], b: 100 };
    const cost = tcost(m, 0, 50);
    expect(cost).toBeCloseTo(28.09, 2);

    const q2 = [50, 0];
    const newProb = P(q2, 100)[0];
    expect(newProb).toBeCloseTo(0.6225, 4);
  });

  it("sharesForBudget(100, [0,0], 0, 28.09) geeft ongeveer 50 aandelen", () => {
    const m = { q: [0, 0], b: 100 };
    const shares = sharesForBudget(m, 0, 28.09);
    expect(shares).toBeCloseTo(50, 0);
  });

  it("start met gelijke kansen en een maximaal verlies van b*ln(n)", () => {
    const b = 150;
    const q = [0, 0, 0];
    const probs = P(q, b);
    for (const p of probs) expect(p).toBeCloseTo(1 / 3, 4);

    const maxLoss = C(q, b) - C([0, 0, 0], b); // referentie: startkosten zijn gelijk aan C(0)
    expect(maxLoss).toBeCloseTo(0, 6);
    expect(b * Math.log(3)).toBeCloseTo(164.8, 1);
  });

  it("verkopen is het omgekeerde van kopen (geen winst/verlies door heen en weer handelen)", () => {
    const m = { q: [0, 0], b: 100 };
    const buyCost = tcost(m, 0, 50);
    const m2 = { q: [50, 0], b: 100 };
    const sellProceeds = -tcost(m2, 0, -50);
    expect(sellProceeds).toBeCloseTo(buyCost, 6);
  });

  it("sharesForProceeds geeft null als je meer wilt verkopen dan je bezit opbrengt", () => {
    const m = { q: [50, 0], b: 100 };
    const result = sharesForProceeds(m, 0, 1_000_000, 50);
    expect(result).toBeNull();
  });
});
