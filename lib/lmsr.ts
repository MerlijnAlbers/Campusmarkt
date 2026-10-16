export interface Market {
  q: number[];
  b: number;
}

/** Numeriek stabiele log-sum-exp van q/b. */
export function lse(q: number[], b: number): number {
  const x = q.map((v) => v / b);
  const m = Math.max(...x);
  let s = 0;
  for (const v of x) s += Math.exp(v - m);
  return m + Math.log(s);
}

/** LMSR-kostenfunctie C(q) = b * lse(q/b). */
export function C(q: number[], b: number): number {
  return b * lse(q, b);
}

/** Kansen (= prijzen) per uitkomst. */
export function P(q: number[], b: number): number[] {
  const x = q.map((v) => v / b);
  const m = Math.max(...x);
  const e = x.map((v) => Math.exp(v - m));
  const s = e.reduce((a, c) => a + c, 0);
  return e.map((v) => v / s);
}

/** Kosten van d aandelen van uitkomst i (negatief = opbrengst bij verkopen). */
export function tcost(m: Market, i: number, d: number): number {
  const q2 = m.q.slice();
  q2[i] += d;
  return C(q2, m.b) - C(m.q, m.b);
}

/** Hoeveel aandelen van uitkomst i je kunt kopen voor budget B. */
export function sharesForBudget(m: Market, i: number, budget: number): number {
  let hi = Math.max(1, budget);
  let n = 0;
  while (tcost(m, i, hi) < budget && n++ < 60) hi *= 2;
  let lo = 0;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (tcost(m, i, mid) <= budget) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Hoeveel aandelen van uitkomst i (van de `held` die je hebt) je moet verkopen voor opbrengst R. */
export function sharesForProceeds(
  m: Market,
  i: number,
  proceeds: number,
  held: number,
): number | null {
  const pr = (d: number) => -tcost(m, i, -d);
  if (pr(held) < proceeds - 1e-9) return null;
  let lo = 0;
  let hi = held;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (pr(mid) >= proceeds) hi = mid;
    else lo = mid;
  }
  return hi;
}
