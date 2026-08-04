/**
 * RC Column Design — Top-Level Orchestrator
 * Phase 6b — Slenderness + P-M Interaction + Reinforcement Ratio +
 * Tie Spacing চেক একসাথে চালিয়ে একটা সম্পূর্ণ RcColumnDesignReport
 * বানায়। rectangular section, tied (spiral না), uniaxial bending —
 * v1 এর সুস্পষ্ট সীমাবদ্ধতা (নিচের ফাইলগুলোর হেডার কমেন্টে বিস্তারিত)।
 */

import {
  checkColumnSlenderness,
  approximateRadiusOfGyrationRectangular,
  type SlendernessCheckResult,
} from "@/lib/design/rcColumnSlenderness";
import {
  buildPmInteractionDiagram,
  checkColumnAdequacy,
  type ColumnAdequacyResult,
  type PmInteractionPoint,
} from "@/lib/design/rcColumnPmInteraction";
import {
  checkLongitudinalReinforcementRatio,
  checkTieSpacing,
  type ReinforcementRatioCheckResult,
  type TieSpacingCheckResult,
} from "@/lib/design/rcColumnReinforcement";

export interface RcColumnDesignInput {
  elementLabel: string;
  widthMm: number; // b
  totalDepthMm: number; // h (bending axis বরাবর)
  unsupportedLengthMm: number; // Lu
  effectiveLengthFactor: number; // k
  isSwayFrame: boolean;
  coverToBarCentroidMm: number;
  fcMPa: number;
  fyMPa: number;
  totalAsMm2: number; // মোট longitudinal steel (provided, symmetric ধরা হয়)
  longitudinalBarDiameterMm: number;
  tieDiameterMm: number;
  providedTieSpacingMm?: number;

  // Load demand — factored (design envelope থেকে, magnitude)
  factoredAxialLoadKN: number;
  m1KNm: number; // smaller end moment
  m2KNm: number; // larger end moment
  isSingleCurvature: boolean;
  criticalBucklingLoadKN: number; // Pc — Buckling Analysis (Phase 4) থেকে, বা ইঞ্জিনিয়ার-নির্ধারিত
}

export interface RcColumnDesignReport {
  elementLabel: string;
  slenderness: SlendernessCheckResult;
  interactionDiagram: PmInteractionPoint[];
  adequacy: ColumnAdequacyResult;
  reinforcementRatio: ReinforcementRatioCheckResult;
  tieSpacing: TieSpacingCheckResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runRcColumnDesign(input: RcColumnDesignInput): RcColumnDesignReport {
  const radiusOfGyration = approximateRadiusOfGyrationRectangular(input.totalDepthMm);

  const slenderness = checkColumnSlenderness({
    unsupportedLengthMm: input.unsupportedLengthMm,
    effectiveLengthFactor: input.effectiveLengthFactor,
    radiusOfGyrationMm: radiusOfGyration,
    isSwayFrame: input.isSwayFrame,
    m1KNm: input.m1KNm,
    m2KNm: input.m2KNm,
    isSingleCurvature: input.isSingleCurvature,
    factoredAxialLoadKN: input.factoredAxialLoadKN,
    criticalBucklingLoadKN: input.criticalBucklingLoadKN,
  });

  const interactionDiagram = buildPmInteractionDiagram({
    widthMm: input.widthMm,
    totalDepthMm: input.totalDepthMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    totalAsMm2: input.totalAsMm2,
    numBarLayers: 2,
    coverToBarCentroidMm: input.coverToBarCentroidMm,
  });

  const adequacy = checkColumnAdequacy(interactionDiagram, input.factoredAxialLoadKN, slenderness.magnifiedMomentKNm);

  const grossArea = input.widthMm * input.totalDepthMm;
  const reinforcementRatio = checkLongitudinalReinforcementRatio({
    totalAsMm2: input.totalAsMm2,
    grossAreaMm2: grossArea,
  });

  const minDimension = Math.min(input.widthMm, input.totalDepthMm);
  const tieSpacing = checkTieSpacing({
    longitudinalBarDiameterMm: input.longitudinalBarDiameterMm,
    tieDiameterMm: input.tieDiameterMm,
    minColumnDimensionMm: minDimension,
    providedSpacingMm: input.providedTieSpacingMm,
  });

  const allWarnings = [
    ...slenderness.warnings,
    ...adequacy.warnings,
    ...reinforcementRatio.warnings,
    ...tieSpacing.warnings,
  ];

  const hasHardFailure =
    !adequacy.adequate || !reinforcementRatio.adequate || tieSpacing.adequate === false;

  const overallStatus: RcColumnDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    slenderness,
    interactionDiagram,
    adequacy,
    reinforcementRatio,
    tieSpacing,
    allWarnings,
    overallStatus,
  };
}
