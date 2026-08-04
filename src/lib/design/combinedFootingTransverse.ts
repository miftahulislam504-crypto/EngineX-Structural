/**
 * Combined Footing — Transverse Flexure, One-Way Shear & Punching
 * Phase 7a — Perpendicular (transverse) দিকে, প্রতিটা কলামের নিচে
 * একটা স্থানীয় cantilever strip ধরা হয় — ঠিক isolated footing-এর
 * মতোই (footingFlexure.ts/footingShear.ts প্যাটার্ন পুনঃব্যবহার),
 * কারণ transverse দিকে প্রতিটা কলাম তার নিজের স্থানীয় tributary
 * width-এ soil pressure resist করে বলে ধরা যুক্তিসঙ্গত (এটাই প্রচলিত
 * combined-footing হ্যান্ড-ক্যালকুলেশন প্র্যাকটিস)। Punching shear
 * প্রতিটা কলামের জন্য আলাদাভাবে চেক করা হয় (rcSlabPunchingShear.ts
 * পুনঃব্যবহার, isolated footing-এর মতোই)।
 */

import { computeFootingMoment, designFootingFlexuralReinforcement, type FootingMomentResult } from "@/lib/design/footingFlexure";
import { checkFootingOneWayShear, checkFootingPunchingShear, type FootingOneWayShearResult } from "@/lib/design/footingShear";
import type { FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";
import type { PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface CombinedFootingTransverseInput {
  footingWidthMm: number; // perpendicular দিকে overall footing dimension
  columnWidthMm: number; // ঐ কলামের perpendicular দিকের dimension
  columnDepthMm: number; // ঐ কলামের spacing-দিকের dimension (punching shear b0 এর জন্য)
  effectiveDepthMm: number;
  factoredUniformPressureKNPerM: number; // qu per meter length — এখান থেকে per-m² pressure বের করা হয় (÷ footingWidthMm)
  factoredColumnLoadKN: number;
  fcMPa: number;
  fyMPa: number;
  thicknessMm: number;
  effectiveCoverMm: number;
}

export interface CombinedFootingTransverseResult {
  moment: FootingMomentResult;
  flexuralDesign: FlexuralDesignResult;
  oneWayShear: FootingOneWayShearResult;
  punchingShear: PunchingShearResult;
  warnings: string[];
}

/**
 * একটা কলামের জন্য transverse চেক — computeFootingMoment ও
 * checkFootingOneWayShear সরাসরি পুনঃব্যবহার (isolated footing এর
 * ফাংশন, transverse dimension = footingWidthMm, cantilever রেফারেন্স
 * = columnWidthMm), শুধু soil pressure (কলামের local tributary
 * pressure, qu per m² = quPerM/footingWidthM) হিসাব করে পাস করা হয়।
 */
export function checkCombinedFootingTransverse(input: CombinedFootingTransverseInput): CombinedFootingTransverseResult {
  const {
    footingWidthMm,
    columnWidthMm,
    columnDepthMm,
    effectiveDepthMm,
    factoredUniformPressureKNPerM,
    factoredColumnLoadKN,
    fcMPa,
    fyMPa,
    thicknessMm,
    effectiveCoverMm,
  } = input;

  const footingWidthM = footingWidthMm / 1000;
  const quKPa = footingWidthM > 0 ? factoredUniformPressureKNPerM / footingWidthM : 0;

  const moment = computeFootingMoment({
    footingDimensionMm: footingWidthMm,
    columnDimensionMm: columnWidthMm,
    factoredSoilPressureKPa: quKPa,
  });

  const flexuralDesign = designFootingFlexuralReinforcement({
    moment,
    thicknessMm,
    effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  const oneWayShear = checkFootingOneWayShear({
    footingDimensionMm: footingWidthMm,
    columnDimensionMm: columnWidthMm,
    effectiveDepthMm,
    factoredSoilPressureKPa: quKPa,
    fcMPa,
  });

  const punchingShear = checkFootingPunchingShear({
    columnWidthMm,
    columnDepthMm,
    effectiveDepthMm,
    fcMPa,
    columnPosition: "interior",
    factoredColumnLoadKN,
  });

  const warnings = [...flexuralDesign.warnings, ...oneWayShear.warnings, ...punchingShear.warnings];

  return { moment, flexuralDesign, oneWayShear, punchingShear, warnings };
}
