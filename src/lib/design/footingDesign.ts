/**
 * Isolated Footing Design — Top-Level Orchestrator
 * Phase 6e — Sizing (soil bearing) → Flexure (both directions,
 * square/rectangular footing symmetric ধরে) → One-way shear (both
 * directions) → Punching shear — একসাথে চালিয়ে একটা সম্পূর্ণ
 * FootingDesignReport বানায়।
 */

import { sizeFootingForBearing, type FootingSizingResult } from "@/lib/design/footingSizing";
import {
  computeFootingMoment,
  designFootingFlexuralReinforcement,
  type FootingMomentResult,
} from "@/lib/design/footingFlexure";
import {
  checkFootingOneWayShear,
  checkFootingPunchingShear,
  type FootingOneWayShearResult,
} from "@/lib/design/footingShear";
import type { FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";
import type { PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface FootingDesignInput {
  elementLabel: string;
  servicePointLoadKN: number; // Pa (unfactored) — sizing এর জন্য
  factoredPointLoadKN: number; // Pu (factored) — flexure/shear এর জন্য
  allowableBearingPressureKPa: number;
  isSquareFooting: boolean;
  aspectRatio?: number;
  columnWidthMm: number;
  columnDepthMm: number;
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface FootingDesignReport {
  elementLabel: string;
  sizing: FootingSizingResult;
  momentX: FootingMomentResult; // footing widthMm দিকে (column widthMm এর বিপরীতে moment)
  momentZ: FootingMomentResult; // footing lengthMm দিকে
  flexuralDesignX: FlexuralDesignResult;
  flexuralDesignZ: FlexuralDesignResult;
  oneWayShearX: FootingOneWayShearResult;
  oneWayShearZ: FootingOneWayShearResult;
  punchingShear: PunchingShearResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runFootingDesign(input: FootingDesignInput): FootingDesignReport {
  const effectiveDepth = input.thicknessMm - input.effectiveCoverMm;

  const sizing = sizeFootingForBearing({
    servicePointLoadKN: input.servicePointLoadKN,
    allowableBearingPressureKPa: input.allowableBearingPressureKPa,
    isSquare: input.isSquareFooting,
    aspectRatio: input.aspectRatio,
  });

  // Factored net upward soil pressure — sizing এ ব্যবহৃত plan area
  // (sizing.widthMm × sizing.lengthMm) এর উপর factored load ছড়িয়ে
  // qu হিসাব করা হয় (allowable pressure না — qu শুধু flexure/shear
  // এর জন্য, sizing এর জন্য না)।
  const areaM2 = (sizing.widthMm / 1000) * (sizing.lengthMm / 1000);
  const quKPa = areaM2 > 0 ? input.factoredPointLoadKN / areaM2 : 0;

  const momentX = computeFootingMoment({
    footingDimensionMm: sizing.widthMm,
    columnDimensionMm: input.columnWidthMm,
    factoredSoilPressureKPa: quKPa,
  });
  const momentZ = computeFootingMoment({
    footingDimensionMm: sizing.lengthMm,
    columnDimensionMm: input.columnDepthMm,
    factoredSoilPressureKPa: quKPa,
  });

  const flexuralDesignX = designFootingFlexuralReinforcement({
    moment: momentX,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });
  const flexuralDesignZ = designFootingFlexuralReinforcement({
    moment: momentZ,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const oneWayShearX = checkFootingOneWayShear({
    footingDimensionMm: sizing.widthMm,
    columnDimensionMm: input.columnWidthMm,
    effectiveDepthMm: effectiveDepth,
    factoredSoilPressureKPa: quKPa,
    fcMPa: input.fcMPa,
  });
  const oneWayShearZ = checkFootingOneWayShear({
    footingDimensionMm: sizing.lengthMm,
    columnDimensionMm: input.columnDepthMm,
    effectiveDepthMm: effectiveDepth,
    factoredSoilPressureKPa: quKPa,
    fcMPa: input.fcMPa,
  });

  const punchingShear = checkFootingPunchingShear({
    columnWidthMm: input.columnWidthMm,
    columnDepthMm: input.columnDepthMm,
    effectiveDepthMm: effectiveDepth,
    fcMPa: input.fcMPa,
    columnPosition: "interior",
    factoredColumnLoadKN: input.factoredPointLoadKN,
  });

  const allWarnings = [
    ...sizing.warnings,
    ...flexuralDesignX.warnings,
    ...flexuralDesignZ.warnings,
    ...oneWayShearX.warnings,
    ...oneWayShearZ.warnings,
    ...punchingShear.warnings,
  ];

  const hasHardFailure =
    flexuralDesignX.isDoublyReinforced ||
    flexuralDesignZ.isDoublyReinforced ||
    !oneWayShearX.adequate ||
    !oneWayShearZ.adequate ||
    !punchingShear.adequate;

  const overallStatus: FootingDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    sizing,
    momentX,
    momentZ,
    flexuralDesignX,
    flexuralDesignZ,
    oneWayShearX,
    oneWayShearZ,
    punchingShear,
    allWarnings,
    overallStatus,
  };
}
