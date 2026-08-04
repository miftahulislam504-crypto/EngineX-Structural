/**
 * Isolated Footing — Sizing (Soil Bearing Capacity)
 * Phase 6e — ACI 318-19 Chapter 13 (Foundations)। Footing plan
 * dimension নির্ণয় করা হয় allowable soil bearing pressure (qa,
 * geotechnical report থেকে ইঞ্জিনিয়ার সরবরাহ করেন — এই app কোনো
 * geotechnical analysis করে না) এবং service-level (unfactored) load
 * থেকে। Service load ব্যবহার করা হয় কারণ soil bearing check ACI-তে
 * allowable-stress-স্টাইলে করা হয় (§13.3.1.1) — factored load না,
 * যদিও এই app-এর বাকি সব ডিজাইন LRFD-based (factored)। ইঞ্জিনিয়ার
 * তাই এখানে service-level Pa (unfactored axial reaction) সরবরাহ
 * করেন, factored Pu না — এই পার্থক্য UI তে স্পষ্টভাবে লেবেল করা।
 */

export interface FootingSizingInput {
  servicePointLoadKN: number; // Pa (unfactored), column axial reaction
  allowableBearingPressureKPa: number; // qa, geotechnical report থেকে
  footingSelfWeightAllowanceKPa?: number; // footing+backfill নিজস্ব ওজন estimate, না দিলে qa এর 10% ধরা হয় (rough allowance)
  isSquare: boolean; // true হলে square footing, false হলে ইঞ্জিনিয়ার aspect ratio দেন
  aspectRatio?: number; // length/width, শুধু isSquare=false হলে প্রযোজ্য (ডিফল্ট 1.0)
}

export interface FootingSizingResult {
  requiredAreaM2: number;
  widthMm: number;
  lengthMm: number;
  netAllowablePressureKPa: number; // qa থেকে self-weight allowance বাদ দেওয়ার পর
  warnings: string[];
}

export function sizeFootingForBearing(input: FootingSizingInput): FootingSizingResult {
  const { servicePointLoadKN, allowableBearingPressureKPa, footingSelfWeightAllowanceKPa, isSquare, aspectRatio } =
    input;
  const warnings: string[] = [];

  const selfWeightAllowance = footingSelfWeightAllowanceKPa ?? allowableBearingPressureKPa * 0.1;
  const netAllowablePressure = allowableBearingPressureKPa - selfWeightAllowance;

  if (netAllowablePressure <= 0) {
    warnings.push(
      "Self-weight allowance exceeds the allowable bearing pressure — cannot size this footing; verify the allowable bearing pressure input."
    );
    return { requiredAreaM2: 0, widthMm: 0, lengthMm: 0, netAllowablePressureKPa: netAllowablePressure, warnings };
  }

  const requiredArea = servicePointLoadKN / netAllowablePressure; // m²

  let widthM: number;
  let lengthM: number;
  if (isSquare) {
    widthM = Math.sqrt(requiredArea);
    lengthM = widthM;
  } else {
    const ratio = aspectRatio ?? 1.0;
    widthM = Math.sqrt(requiredArea / ratio);
    lengthM = widthM * ratio;
  }

  // 50mm ধাপে round up করা হয়েছে — বাস্তব কনস্ট্রাকশন প্র্যাকটিসে
  // ফুটিং সাধারণত round-number dimension এ কাটা হয়, exact calculated
  // মান না।
  const roundUpTo50 = (v: number) => Math.ceil((v * 1000) / 50) * 50;

  return {
    requiredAreaM2: requiredArea,
    widthMm: roundUpTo50(widthM),
    lengthMm: roundUpTo50(lengthM),
    netAllowablePressureKPa: netAllowablePressure,
    warnings,
  };
}
