/**
 * RC Slab — Minimum Thickness & Minimum Reinforcement
 * Phase 6d — ACI 318-19 Table 8.3.1.1 (two-way slab deflection control,
 * without interior beams) ও §7.6.1.1/§8.6.1.1 (shrinkage/temperature
 * reinforcement)।
 */

export type SlabEdgeCondition = "interior-panel" | "edge-panel" | "corner-panel" | "one-way";

/**
 * ACI 318-19 Table 8.3.1.1 — two-way slab without interior beams,
 * minimum thickness = ln/ratio (ln = clear span, longer direction)।
 * fy=420 MPa বেসলাইন ধরে ratio দেওয়া হয়েছে (without drop panel);
 * fy ভিন্ন হলে §8.3.1.1 অনুযায়ী সমন্বয় প্রয়োজন — এই v1-এ 420 MPa
 * fixed ধরা হয়েছে (rebar fy সাধারণত 414-420 MPa রেঞ্জে থাকে, তাই
 * পার্থক্য সামান্য; ভবিষ্যতে fy-সমন্বিত interpolation যোগ করা যাবে)।
 */
const TWO_WAY_THICKNESS_RATIO: Record<Exclude<SlabEdgeCondition, "one-way">, number> = {
  "interior-panel": 33,
  "edge-panel": 30,
  "corner-panel": 30, // corner panel edge-panel এর মতোই রক্ষণশীল ধরা হয়েছে (ACI টেবিলে discontinuous-edge কেস)
};

export interface SlabMinThicknessInput {
  edgeCondition: SlabEdgeCondition;
  clearSpanLongDirectionMm: number; // ln, longer clear span
  oneWaySpanMm?: number; // one-way slab এর জন্য (ACI §7.3.1.1: simply-supported L/20, one-end-cont L/24, both-end-cont L/28, cantilever L/10)
  oneWaySupportCondition?: "simply-supported" | "one-end-continuous" | "both-ends-continuous" | "cantilever";
}

export interface SlabMinThicknessResult {
  minThicknessMm: number;
}

const ONE_WAY_SLAB_RATIO: Record<NonNullable<SlabMinThicknessInput["oneWaySupportCondition"]>, number> = {
  "simply-supported": 20,
  "one-end-continuous": 24,
  "both-ends-continuous": 28,
  cantilever: 10,
};

export function computeSlabMinThickness(input: SlabMinThicknessInput): SlabMinThicknessResult {
  const { edgeCondition, clearSpanLongDirectionMm, oneWaySpanMm, oneWaySupportCondition } = input;

  if (edgeCondition === "one-way") {
    const ratio = ONE_WAY_SLAB_RATIO[oneWaySupportCondition ?? "simply-supported"];
    const span = oneWaySpanMm ?? clearSpanLongDirectionMm;
    return { minThicknessMm: span / ratio };
  }

  const ratio = TWO_WAY_THICKNESS_RATIO[edgeCondition];
  return { minThicknessMm: clearSpanLongDirectionMm / ratio };
}

export interface SlabMinReinforcementInput {
  thicknessMm: number;
  fyMPa: number;
}

export interface SlabMinReinforcementResult {
  minAsPerMeterMm2: number; // shrinkage/temperature — প্রতি দিকেই প্রযোজ্য (both directions)
}

/**
 * ACI 318-19 §7.6.1.1 — shrinkage/temperature reinforcement ratio:
 *   fy < 420 MPa: ρ = 0.0020
 *   fy ≥ 420 MPa: ρ = 0.0018 × (420/fy), সর্বনিম্ন 0.0014
 */
export function computeSlabMinReinforcement(input: SlabMinReinforcementInput): SlabMinReinforcementResult {
  const { thicknessMm, fyMPa } = input;

  let rho: number;
  if (fyMPa < 420) {
    rho = 0.002;
  } else {
    rho = Math.max(0.0018 * (420 / fyMPa), 0.0014);
  }

  const STRIP_WIDTH_MM = 1000;
  return { minAsPerMeterMm2: rho * STRIP_WIDTH_MM * thicknessMm };
}
