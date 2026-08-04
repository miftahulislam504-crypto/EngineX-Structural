/**
 * Combined Footing Design — Top-Level Orchestrator
 * Phase 7a — Sizing (resultant-centroid, uniform pressure) →
 * Longitudinal flexure (inverted-beam idealization, top+bottom
 * steel) → Transverse flexure + one-way shear (per column, cantilever
 * strip, isolated-footing pattern পুনঃব্যবহার) → Punching shear (per
 * column) — একসাথে চালিয়ে CombinedFootingDesignReport বানায়।
 */

import { sizeCombinedFooting, type CombinedFootingSizingResult } from "@/lib/design/combinedFootingSizing";
import {
  computeCombinedFootingLongitudinalMoments,
  designCombinedFootingLongitudinalReinforcement,
  type CombinedFootingLongitudinalResult,
  type CombinedFootingLongitudinalDesignResult,
} from "@/lib/design/combinedFootingFlexure";
import {
  checkCombinedFootingTransverse,
  type CombinedFootingTransverseResult,
} from "@/lib/design/combinedFootingTransverse";

export interface CombinedFootingDesignInput {
  elementLabel: string;
  servicePointLoadAKN: number;
  servicePointLoadBKN: number;
  factoredPointLoadAKN: number;
  factoredPointLoadBKN: number;
  columnToColumnSpacingMm: number;
  columnAWidthMm: number; // spacing-দিকে
  columnADepthMm: number; // perpendicular-দিকে
  columnBWidthMm: number; // spacing-দিকে
  columnBDepthMm: number; // perpendicular-দিকে
  perpendicularWidthMm: number;
  allowableBearingPressureKPa: number;
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface CombinedFootingDesignReport {
  elementLabel: string;
  sizing: CombinedFootingSizingResult;
  longitudinalMoments: CombinedFootingLongitudinalResult;
  longitudinalDesign: CombinedFootingLongitudinalDesignResult;
  transverseAtColumnA: CombinedFootingTransverseResult;
  transverseAtColumnB: CombinedFootingTransverseResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runCombinedFootingDesign(input: CombinedFootingDesignInput): CombinedFootingDesignReport {
  const effectiveDepth = input.thicknessMm - input.effectiveCoverMm;

  const sizing = sizeCombinedFooting({
    servicePointLoadAKN: input.servicePointLoadAKN,
    servicePointLoadBKN: input.servicePointLoadBKN,
    columnToColumnSpacingMm: input.columnToColumnSpacingMm,
    columnAWidthMm: input.columnAWidthMm,
    columnBWidthMm: input.columnBWidthMm,
    perpendicularWidthMm: input.perpendicularWidthMm,
    allowableBearingPressureKPa: input.allowableBearingPressureKPa,
  });

  const longitudinalMoments = computeCombinedFootingLongitudinalMoments({
    footingLengthMm: sizing.footingLengthMm,
    footingWidthMm: sizing.footingWidthMm,
    overhangBeyondColumnAMm: sizing.overhangBeyondColumnAMm,
    overhangBeyondColumnBMm: sizing.overhangBeyondColumnBMm,
    columnToColumnSpacingMm: input.columnToColumnSpacingMm,
    factoredPointLoadAKN: input.factoredPointLoadAKN,
    factoredPointLoadBKN: input.factoredPointLoadBKN,
  });

  const longitudinalDesign = designCombinedFootingLongitudinalReinforcement({
    moments: longitudinalMoments,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    footingWidthMm: sizing.footingWidthMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const transverseAtColumnA = checkCombinedFootingTransverse({
    footingWidthMm: sizing.footingWidthMm,
    columnWidthMm: input.columnADepthMm,
    columnDepthMm: input.columnAWidthMm,
    effectiveDepthMm: effectiveDepth,
    factoredUniformPressureKNPerM: longitudinalMoments.factoredUniformPressureKNPerM,
    factoredColumnLoadKN: input.factoredPointLoadAKN,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
  });

  const transverseAtColumnB = checkCombinedFootingTransverse({
    footingWidthMm: sizing.footingWidthMm,
    columnWidthMm: input.columnBDepthMm,
    columnDepthMm: input.columnBWidthMm,
    effectiveDepthMm: effectiveDepth,
    factoredUniformPressureKNPerM: longitudinalMoments.factoredUniformPressureKNPerM,
    factoredColumnLoadKN: input.factoredPointLoadBKN,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
  });

  const allWarnings = [
    ...sizing.warnings,
    ...longitudinalDesign.warnings,
    ...transverseAtColumnA.warnings,
    ...transverseAtColumnB.warnings,
  ];

  const hasHardFailure =
    longitudinalDesign.topReinforcement.isDoublyReinforced ||
    longitudinalDesign.bottomReinforcement.isDoublyReinforced ||
    !transverseAtColumnA.oneWayShear.adequate ||
    !transverseAtColumnB.oneWayShear.adequate ||
    !transverseAtColumnA.punchingShear.adequate ||
    !transverseAtColumnB.punchingShear.adequate;

  const overallStatus: CombinedFootingDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    sizing,
    longitudinalMoments,
    longitudinalDesign,
    transverseAtColumnA,
    transverseAtColumnB,
    allWarnings,
    overallStatus,
  };
}
