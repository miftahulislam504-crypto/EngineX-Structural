/**
 * RC Wall — Axial Capacity (Empirical Method) & Minimum Reinforcement
 * Phase 6d — ACI 318-19 §11.5.3 (Empirical Design Method, walls with
 * resultant of all factored loads within the middle third of wall
 * thickness — সাধারণ bearing/partition wall এ প্রযোজ্য, eccentric বা
 * significant lateral load সহ wall এর জন্য নয়, সেক্ষেত্রে §11.5.2 এর
 * P-M interaction পদ্ধতি লাগে, যা এই v1-এ নেই — শুধু axial-dominant
 * empirical check)।
 */

export interface WallEmpiricalCapacityInput {
  thicknessMm: number; // h
  lengthMm: number; // horizontal length of wall segment (per meter strip হিসেবেও ব্যবহারযোগ্য — lengthMm=1000)
  unsupportedHeightMm: number; // lc — vertical unsupported height
  effectiveLengthFactor: number; // k — ACI Table 11.5.3.2 (fixed-fixed=0.8, fixed-pinned=1.0, pinned-pinned=1.0, cantilever=2.0)
  fcMPa: number;
  factoredAxialLoadKN: number; // Pu (per wall segment বা per meter width, lengthMm এর সাথে সামঞ্জস্যপূর্ণ)
}

export interface WallEmpiricalCapacityResult {
  phiPnwKN: number;
  slendernessRatio: number; // klc/h
  utilizationRatio: number;
  adequate: boolean;
  warnings: string[];
}

/**
 * ACI 318-19 Eq. 11.5.3.1:
 *   φPnw = 0.55·φ·f'c·Ag·[1 − (klc/32h)²]
 * φ = 0.65 (compression-controlled, tied — wall বেশিরভাগ ক্ষেত্রে
 * ties/spiral ছাড়া থাকে বলে ACI এই সংখ্যাটাই empirical method এ
 * mandate করে)।
 */
export function computeWallEmpiricalCapacity(input: WallEmpiricalCapacityInput): WallEmpiricalCapacityResult {
  const { thicknessMm, lengthMm, unsupportedHeightMm, effectiveLengthFactor, fcMPa, factoredAxialLoadKN } = input;
  const warnings: string[] = [];
  const phi = 0.65;

  const Ag = thicknessMm * lengthMm;
  const klc = effectiveLengthFactor * unsupportedHeightMm;
  const slendernessRatio = klc / thicknessMm;

  const reductionFactor = 1 - (slendernessRatio / 32) ** 2;
  if (reductionFactor <= 0) {
    warnings.push(
      `Wall is too slender for the empirical method (klc/h=${slendernessRatio.toFixed(1)} makes the capacity reduction factor zero or negative) — use the ACI §11.5.2 P-M interaction (rational) design method instead.`
    );
    return { phiPnwKN: 0, slendernessRatio, utilizationRatio: Number.POSITIVE_INFINITY, adequate: false, warnings };
  }

  const PnwN = 0.55 * fcMPa * Ag * reductionFactor;
  const phiPnw = (phi * PnwN) / 1000; // N → kN

  const Pu = Math.abs(factoredAxialLoadKN);
  const ratio = phiPnw > 0 ? Pu / phiPnw : Number.POSITIVE_INFINITY;
  const adequate = Number.isFinite(ratio) && ratio <= 1.0;

  if (!adequate) {
    warnings.push(
      `Factored axial load Pu (${Pu.toFixed(1)} kN) exceeds the empirical-method wall capacity φPnw (${phiPnw.toFixed(1)} kN) — increase thickness, reduce unsupported height, or use rational P-M design.`
    );
  }

  return { phiPnwKN: phiPnw, slendernessRatio, utilizationRatio: ratio, adequate, warnings };
}

export interface WallMinReinforcementInput {
  thicknessMm: number;
  barDiameterMm: number; // ≤16mm হলে ratio পাল্টায় (ACI §11.6.1)
  fyMPa: number;
}

export interface WallMinReinforcementResult {
  minVerticalRatio: number;
  minHorizontalRatio: number;
  minVerticalAsPerMeterMm2: number;
  minHorizontalAsPerMeterMm2: number;
}

/**
 * ACI 318-19 §11.6.1 — minimum reinforcement ratio (deformed bars,
 * fy ≥ 420 MPa, bar diameter ≤ 16mm ধরে সবচেয়ে প্রচলিত কেস):
 *   Vertical: ρl,min = 0.0012
 *   Horizontal: ρt,min = 0.0020
 * (fy < 420 MPa বা bar dia > 16mm হলে ACI এ ভিন্ন মান আছে — এই v1
 * এ শুধু সবচেয়ে প্রচলিত কেস অটোমেটেড, অন্য কেসে ইঞ্জিনিয়ারকে
 * ম্যানুয়াল ACI টেবিল দেখতে হবে)।
 */
export function computeWallMinReinforcement(input: WallMinReinforcementInput): WallMinReinforcementResult {
  const { thicknessMm, barDiameterMm, fyMPa } = input;

  let minVerticalRatio: number;
  let minHorizontalRatio: number;

  if (fyMPa >= 420 && barDiameterMm <= 16) {
    minVerticalRatio = 0.0012;
    minHorizontalRatio = 0.002;
  } else {
    // conservative fallback — ACI এর slightly higher older-fy ratio
    minVerticalRatio = 0.0015;
    minHorizontalRatio = 0.0025;
  }

  const STRIP_WIDTH_MM = 1000;
  return {
    minVerticalRatio,
    minHorizontalRatio,
    minVerticalAsPerMeterMm2: minVerticalRatio * STRIP_WIDTH_MM * thicknessMm,
    minHorizontalAsPerMeterMm2: minHorizontalRatio * STRIP_WIDTH_MM * thicknessMm,
  };
}
