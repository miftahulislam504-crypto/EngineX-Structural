/**
 * Strip/Continuous Footing — Sizing (Soil Bearing Capacity)
 * Phase 7b — ACI 318-19 Chapter 13, isolated footing sizing
 * (footingSizing.ts) এর একই নীতি কিন্তু per-meter-run ভিত্তিতে: wall
 * বা কলাম-সারি থেকে আসা লোড একটা লিনিয়ার লোড (kN/m) হিসেবে ধরা হয়
 * (একটা single point load না)। Aspect ratio প্রযোজ্য না — strip
 * footing দৈর্ঘ্যে wall/line length বরাবর চলে, শুধু width নির্ণয়
 * করতে হয়।
 */

export interface StripFootingSizingInput {
  serviceLinearLoadKNPerM: number; // wa (unfactored), wall বা কলাম-সারির প্রতি মিটার লোড
  allowableBearingPressureKPa: number; // qa, geotechnical report থেকে
  footingSelfWeightAllowanceKPa?: number; // না দিলে qa এর 10% ধরা হয়
}

export interface StripFootingSizingResult {
  requiredWidthMm: number;
  netAllowablePressureKPa: number;
  warnings: string[];
}

export function sizeStripFootingForBearing(input: StripFootingSizingInput): StripFootingSizingResult {
  const { serviceLinearLoadKNPerM, allowableBearingPressureKPa, footingSelfWeightAllowanceKPa } = input;
  const warnings: string[] = [];

  const selfWeightAllowance = footingSelfWeightAllowanceKPa ?? allowableBearingPressureKPa * 0.1;
  const netAllowablePressure = allowableBearingPressureKPa - selfWeightAllowance;

  if (netAllowablePressure <= 0) {
    warnings.push(
      "Self-weight allowance exceeds the allowable bearing pressure — cannot size this footing; verify the allowable bearing pressure input."
    );
    return { requiredWidthMm: 0, netAllowablePressureKPa: netAllowablePressure, warnings };
  }

  if (serviceLinearLoadKNPerM <= 0) {
    warnings.push("Service linear load must be positive — check the wall/line load input.");
    return { requiredWidthMm: 0, netAllowablePressureKPa: netAllowablePressure, warnings };
  }

  // requiredWidthM × 1m run = requiredArea per meter run
  const requiredWidthM = serviceLinearLoadKNPerM / netAllowablePressure;

  const roundUpTo50 = (v: number) => Math.ceil((v * 1000) / 50) * 50;

  return {
    requiredWidthMm: roundUpTo50(requiredWidthM),
    netAllowablePressureKPa: netAllowablePressure,
    warnings,
  };
}
