/**
 * Combined Footing — Sizing (Resultant-Centroid Method)
 * Phase 7a — ACI 318-19 Chapter 13। দুটো কলামের rectangular combined
 * footing। লক্ষ্য: soil pressure যতটা সম্ভব uniform রাখা, যা ঘটে
 * তখনই যখন footing-এর plan centroid দুই কলামের সম্মিলিত লোডের
 * resultant-এর সাথে align করে (eccentricity শূন্য)। এই মেথড classical
 * "resultant-centroid" বা "rigid footing, uniform pressure" পদ্ধতি —
 * geotechnical settlement analysis বা flexible-footing (beam-on-
 * elastic-foundation) মডেল না।
 *
 * Column A ও Column B এক সরলরেখায় (collinear, একই axis বরাবর) ধরা
 * হয়েছে — বাস্তবে বেশিরভাগ combined footing এভাবেই হয় (property
 * line-এর কাছে থাকা দুই কলাম একই grid line-এ)। Column offset
 * perpendicular দিকে থাকলে (non-collinear) এই সরলীকৃত মডেল প্রযোজ্য
 * না — সেটা এই মডিউলের scope-এর বাইরে।
 */

export interface CombinedFootingSizingInput {
  columnASpacingFromLeftEdgeAllowanceMm?: number; // Column A-এর পাশে footing edge পর্যন্ত projection, না দিলে নিচের overhang heuristic ব্যবহার হয়
  servicePointLoadAKN: number; // Pa (unfactored), Column A axial reaction
  servicePointLoadBKN: number; // Pa (unfactored), Column B axial reaction
  columnToColumnSpacingMm: number; // Column A থেকে Column B কেন্দ্র পর্যন্ত দূরত্ব
  columnAWidthMm: number; // spacing-এর দিকে column A dimension
  columnBWidthMm: number; // spacing-এর দিকে column B dimension
  perpendicularWidthMm: number; // footing-এর width (spacing-এর লম্ব দিকে) — সাধারণত ইঞ্জিনিয়ার বেছে দেন, বা columnWidth+allowance
  allowableBearingPressureKPa: number; // qa, geotechnical report থেকে
  footingSelfWeightAllowanceKPa?: number; // না দিলে qa এর 10% ধরা হয়
}

export interface CombinedFootingSizingResult {
  totalServiceLoadKN: number;
  resultantDistanceFromColumnAMm: number; // Column A কেন্দ্র থেকে resultant load-এর দূরত্ব
  requiredAreaM2: number;
  footingLengthMm: number; // spacing-এর দিকে (resultant footing centroid-এ align করে determine করা)
  footingWidthMm: number; // perpendicularWidthMm থেকে সরাসরি
  overhangBeyondColumnAMm: number; // Column A কেন্দ্র থেকে footing near-edge পর্যন্ত
  overhangBeyondColumnBMm: number; // Column B কেন্দ্র থেকে footing far-edge পর্যন্ত
  netAllowablePressureKPa: number;
  uniformPressureKPa: number; // sizing অনুযায়ী actual uniform pressure (qa এর কাছাকাছি হওয়া উচিত)
  warnings: string[];
}

export function sizeCombinedFooting(input: CombinedFootingSizingInput): CombinedFootingSizingResult {
  const {
    servicePointLoadAKN,
    servicePointLoadBKN,
    columnToColumnSpacingMm,
    columnAWidthMm,
    columnBWidthMm,
    perpendicularWidthMm,
    allowableBearingPressureKPa,
    footingSelfWeightAllowanceKPa,
  } = input;
  const warnings: string[] = [];

  const totalLoad = servicePointLoadAKN + servicePointLoadBKN;

  if (totalLoad <= 0) {
    warnings.push("Combined service load is zero or negative — check column reaction inputs.");
    return {
      totalServiceLoadKN: totalLoad,
      resultantDistanceFromColumnAMm: 0,
      requiredAreaM2: 0,
      footingLengthMm: 0,
      footingWidthMm: 0,
      overhangBeyondColumnAMm: 0,
      overhangBeyondColumnBMm: 0,
      netAllowablePressureKPa: 0,
      uniformPressureKPa: 0,
      warnings,
    };
  }

  // Resultant-এর অবস্থান, Column A কেন্দ্র থেকে (moments নেওয়া Column A এর চারপাশে)
  const resultantDistanceFromA = (servicePointLoadBKN * columnToColumnSpacingMm) / totalLoad;

  const selfWeightAllowance = footingSelfWeightAllowanceKPa ?? allowableBearingPressureKPa * 0.1;
  const netAllowablePressure = allowableBearingPressureKPa - selfWeightAllowance;

  if (netAllowablePressure <= 0) {
    warnings.push(
      "Self-weight allowance exceeds the allowable bearing pressure — cannot size this footing; verify the allowable bearing pressure input."
    );
    return {
      totalServiceLoadKN: totalLoad,
      resultantDistanceFromColumnAMm: resultantDistanceFromA,
      requiredAreaM2: 0,
      footingLengthMm: 0,
      footingWidthMm: perpendicularWidthMm,
      overhangBeyondColumnAMm: 0,
      overhangBeyondColumnBMm: 0,
      netAllowablePressureKPa: netAllowablePressure,
      uniformPressureKPa: 0,
      warnings,
    };
  }

  if (perpendicularWidthMm <= 0) {
    warnings.push("Perpendicular footing width must be positive — provide a footing width.");
  }

  const requiredArea = totalLoad / netAllowablePressure; // m²
  const widthM = perpendicularWidthMm / 1000;
  const requiredLengthM = widthM > 0 ? requiredArea / widthM : 0;

  // Uniform pressure ধরে রাখতে, footing centroid = resultant-এর অবস্থান
  // হতে হবে। তাই footing-এর length টা resultant-কে কেন্দ্র করে দুই
  // দিকে ভাগ হয়: overhangA (Column A এর দিকে) এবং বাকিটা Column B এর
  // দিকে।
  const roundUpTo50 = (v: number) => Math.ceil((v * 1000) / 50) * 50;
  const footingLengthMm = roundUpTo50(requiredLengthM);

  // Footing centroid resultant-এ align করতে: overhangA = footingLength/2 - resultantDistanceFromA-এর বিপরীত পাশ থেকে গণনা।
  // centroid Column A থেকে distance = footingLengthMm/2 (footing মাঝ বিন্দু থেকে যদি resultant-ই কেন্দ্র হয়)
  // তাই: overhangBeyondA = footingLengthMm/2 - resultantDistanceFromA + (resultantDistanceFromA - footingLengthMm/2) ... সরল করে:
  // footing near-edge (Column A-এর পাশে) থেকে resultant পর্যন্ত দূরত্ব = footingLengthMm/2
  const overhangBeyondColumnAMm = footingLengthMm / 2 - resultantDistanceFromA;
  const overhangBeyondColumnBMm = footingLengthMm / 2 - (columnToColumnSpacingMm - resultantDistanceFromA);

  if (overhangBeyondColumnAMm < 0 || overhangBeyondColumnBMm < 0) {
    warnings.push(
      "Resultant load position falls outside the sized footing length at one end — footing length may need to be increased manually, or column loads/spacing re-checked. Uniform-pressure assumption may not hold with the rounded dimension."
    );
  }

  // Column faces footing edge-এর মধ্যেই থাকা উচিত (sanity check)
  const columnAOuterFaceFromEdge = overhangBeyondColumnAMm - columnAWidthMm / 2;
  const columnBOuterFaceFromEdge = overhangBeyondColumnBMm - columnBWidthMm / 2;
  if (columnAOuterFaceFromEdge < 0) {
    warnings.push("Column A extends beyond the footing edge — increase footing length or check column A width.");
  }
  if (columnBOuterFaceFromEdge < 0) {
    warnings.push("Column B extends beyond the footing edge — increase footing length or check column B width.");
  }

  const actualAreaM2 = (footingLengthMm / 1000) * widthM;
  const uniformPressure = actualAreaM2 > 0 ? totalLoad / actualAreaM2 : 0;

  if (uniformPressure > allowableBearingPressureKPa) {
    warnings.push(
      `Rounded footing dimensions give a gross pressure (${uniformPressure.toFixed(1)} kPa) exceeding the allowable bearing pressure (${allowableBearingPressureKPa.toFixed(1)} kPa) — increase footing width or length.`
    );
  }

  return {
    totalServiceLoadKN: totalLoad,
    resultantDistanceFromColumnAMm: resultantDistanceFromA,
    requiredAreaM2: requiredArea,
    footingLengthMm,
    footingWidthMm: perpendicularWidthMm,
    overhangBeyondColumnAMm,
    overhangBeyondColumnBMm,
    netAllowablePressureKPa: netAllowablePressure,
    uniformPressureKPa: uniformPressure,
    warnings,
  };
}
