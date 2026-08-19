/**
 * Media response model.
 *
 * Everything on the dashboard that isn't a directly measured metric is derived
 * here, from a small set of explicitly stated assumptions. Nothing downstream is
 * hardcoded — change an input and the reallocation, the ceiling, the projected
 * impact and the equimarginal check all move together.
 *
 * Response curve: Michaelis-Menten / Hill saturation.
 *
 *     conversions(s) = Cmax · s / (K + s)
 *
 *   Cmax = the most incremental conversions this channel could ever deliver
 *   K    = half-saturation spend (the spend at which you get Cmax/2)
 *
 * Chosen over a power curve (c = a·s^b) because a power curve never saturates —
 * it will happily recommend 20x the current budget. Hill has a real asymptote,
 * which is the whole point of a saturation model.
 *
 * Marginal cost of the next conversion is the reciprocal of the slope:
 *
 *     dc/ds = Cmax·K / (K + s)²      →      m(s) = (K + s)² / (Cmax · K)
 *
 * Note m(0) = K / Cmax > 0: even the first dollar has a cost. If m(0) already
 * exceeds the ceiling, the channel never clears the hurdle at any spend and its
 * optimum is zero — which is a real, and reportable, outcome.
 */

export interface CurveParams {
  /** Half-saturation spend, in dollars. From the lift-test response fit. */
  K: number;
  /** Maximum achievable incremental conversions. From the same fit. */
  Cmax: number;
}

/** Fit (K, Cmax) from the two things we actually observe plus the fitted slope. */
export function fitCurve(spend: number, conversions: number, marginalAtSpend: number): CurveParams {
  // m0 = s(K+s) / (c·K)  →  K = s² / (m0·c − s)
  const denom = marginalAtSpend * conversions - spend;
  if (denom <= 0) throw new Error("marginal cost too low to be consistent with average cost");
  const K = (spend * spend) / denom;
  const Cmax = (conversions * (K + spend)) / spend;
  return { K, Cmax };
}

export const conversionsAt = (p: CurveParams, s: number) => (p.Cmax * s) / (p.K + s);

export const marginalAt = (p: CurveParams, s: number) => ((p.K + s) ** 2) / (p.Cmax * p.K);

/** Cheapest possible next conversion for this channel (its marginal cost at zero spend). */
export const floorCost = (p: CurveParams) => p.K / p.Cmax;

/** Spend at which the next conversion costs exactly `target`. 0 if unreachable. */
export function spendAtMarginal(p: CurveParams, target: number): number {
  if (target <= floorCost(p)) return 0;
  return Math.sqrt(target * p.Cmax * p.K) - p.K;
}

/* ------------------------------------------------------------------ ceiling */

/**
 * There is exactly one ceiling here, and it is the budget.
 *
 * The obvious other one — what a conversion is worth, divided by a required
 * return — needs the advertiser's ticket size and margin. We are not given
 * those, and inventing them would put our assumption on the screen wearing the
 * advertiser's clothes. So the model prices against the only constraint we can
 * see: with a fixed budget, raise the bar until total optimal spend equals it.
 *
 * That bar is the shadow price of the budget. At it, every uncapped channel sits
 * at the same marginal cost — the textbook condition for an optimal allocation,
 * and a statement that needs no margin at all: *wherever* the next conversion is
 * cheaper here than there, money is in the wrong place.
 *
 * If margins ever arrive, the value ceiling goes back in as `Math.min(value,
 * budget)` — the stricter bar binds — and nothing else has to change.
 */

/** Solve for the marginal cost at which total optimal spend equals `budget`. */
export function budgetCeiling(
  curves: CurveParams[],
  budget: number,
  caps: (number | null)[] = []
): number {
  const total = (m: number) =>
    curves.reduce((sum, p, i) => {
      const s = spendAtMarginal(p, m);
      const cap = caps[i];
      return sum + (cap !== null && cap !== undefined ? Math.min(s, cap) : s);
    }, 0);

  let lo = 0.01;
  let hi = 10_000;
  if (total(hi) < budget) return hi; // budget exceeds what the channels can absorb
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < budget) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ------------------------------------------------------------- allocation */

export interface Allocation {
  key: string;
  current: number;
  proposed: number;
  delta: number;
  currentConversions: number;
  proposedConversions: number;
  marginalNow: number;
  marginalProposed: number;
  /** True when a stated real-world limit, not the maths, set this number. */
  cappedBy: string | null;
}

export function allocate(
  channels: { key: string; spend: number; curve: CurveParams; cap?: { value: number; reason: string } }[],
  ceiling: number,
  budget: number
): { rows: Allocation[]; effectiveCeiling: number; equimarginal: boolean } {
  const caps = channels.map((c) => c.cap?.value ?? null);
  const bCeil = budgetCeiling(channels.map((c) => c.curve), budget, caps);
  // `ceiling` is Infinity while we have no margins, so the budget bar governs.
  // Pass a real value ceiling and the stricter of the two binds.
  const effectiveCeiling = Math.min(ceiling, bCeil);

  const rows = channels.map((c, i): Allocation => {
    const raw = spendAtMarginal(c.curve, effectiveCeiling);
    const cap = caps[i];
    const proposed = cap !== null && raw > cap ? cap : raw;
    return {
      key: c.key,
      current: c.spend,
      proposed,
      delta: proposed - c.spend,
      currentConversions: conversionsAt(c.curve, c.spend),
      proposedConversions: conversionsAt(c.curve, proposed),
      marginalNow: marginalAt(c.curve, c.spend),
      marginalProposed: marginalAt(c.curve, proposed),
      cappedBy: cap !== null && raw > cap ? (c.cap?.reason ?? "capped") : null,
    };
  });

  // Equimarginal test: uncapped channels that received budget should all sit at
  // the same marginal cost. A capped channel is legitimately allowed to differ.
  const free = rows.filter((r) => !r.cappedBy && r.proposed > 0).map((r) => r.marginalProposed);
  const equimarginal =
    free.length < 2 || Math.max(...free) - Math.min(...free) < 0.5;

  return { rows, effectiveCeiling, equimarginal };
}
