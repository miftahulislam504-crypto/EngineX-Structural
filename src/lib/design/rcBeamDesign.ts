/**
 * RC Beam Design — Top-Level Orchestrator
 * Phase 6a — Flexural + Shear + Deflection + Crack Control চেক একসাথে
 * চালিয়ে একটা সম্পূর্ণ RcBeamDesignReport বানায়। এটা Analysis Engine
 * (Phase 4) এর ElementEndForce থেকে সরাসরি envelope moment/shear
 * বের করে নিতে পারে, অথবা ইউজার নিজে মান দিতে পারেন (design panel
 * ছাড়া, standalone check এর জন্যও কাজে লাগবে)।
 */

import {
  designFlexuralReinforcement,
  checkFlexuralAdequacy,
  type FlexuralDesignResult,
} from "@/lib/design/rcBeamFlexure";
import { designShearReinforcement, type ShearDesignResult } from "@/lib/design/rcBeamShear";
import {
  checkDeflectionByMinThickness,
  type DeflectionCheckResult,
  type BeamSupportCondition,
} from "@/lib/design/rcBeamDeflection";
import { checkCrackControlSpacing, type CrackControlCheckResult } from "@/lib/design/rcBeamCrackControl";

export interface RcBeamDesignInput {
  elementLabel: string;
  spanMm: number;
  widthMm: number;
  totalDepthMm: number;
  effectiveCoverMm: number; // extreme tension fiber → main rebar centroid
  clearCoverMm: number; // extreme tension fiber → nearest bar surface (crack control এ ব্যবহৃত)
  fcMPa: number;
  fyMPa: number;
  stirrupDiameterMm: number;
  supportCondition: BeamSupportCondition;
  factoredMomentKNm: number; // Mu (design envelope থেকে, magnitude)
  factoredShearKN: number; // Vu
  // ঐচ্ছিক: ইঞ্জিনিয়ার যদি ইতিমধ্যে rebar বেছে থাকেন, capacity/crack check তার ভিত্তিতে হবে
  providedAsMm2?: number;
  providedBarSpacingMm?: number;
}

export interface RcBeamDesignReport {
  elementLabel: string;
  flexure: FlexuralDesignResult;
  flexuralAdequacy?: { phiMnKNm: number; utilizationRatio: number; adequate: boolean };
  shear: ShearDesignResult;
  deflection: DeflectionCheckResult;
  crackControl?: CrackControlCheckResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runRcBeamDesign(input: RcBeamDesignInput): RcBeamDesignReport {
  const flexure = designFlexuralReinforcement({
    factoredMomentKNm: input.factoredMomentKNm,
    widthMm: input.widthMm,
    totalDepthMm: input.totalDepthMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const shear = designShearReinforcement({
    factoredShearKN: input.factoredShearKN,
    widthMm: input.widthMm,
    effectiveDepthMm: flexure.effectiveDepthMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
    stirrupDiameterMm: input.stirrupDiameterMm,
  });

  const deflection = checkDeflectionByMinThickness({
    spanMm: input.spanMm,
    totalDepthMm: input.totalDepthMm,
    supportCondition: input.supportCondition,
    fyMPa: input.fyMPa,
  });

  let flexuralAdequacy: RcBeamDesignReport["flexuralAdequacy"];
  let crackControl: CrackControlCheckResult | undefined;

  if (input.providedAsMm2 !== undefined) {
    flexuralAdequacy = checkFlexuralAdequacy(input.factoredMomentKNm, {
      providedAsMm2: input.providedAsMm2,
      widthMm: input.widthMm,
      effectiveDepthMm: flexure.effectiveDepthMm,
      fcMPa: input.fcMPa,
      fyMPa: input.fyMPa,
    });
  }

  if (input.providedBarSpacingMm !== undefined) {
    crackControl = checkCrackControlSpacing({
      barSpacingMm: input.providedBarSpacingMm,
      clearCoverMm: input.clearCoverMm,
      fyMPa: input.fyMPa,
    });
  }

  const allWarnings = [
    ...flexure.warnings,
    ...shear.warnings,
    ...deflection.warnings,
    ...(crackControl?.warnings ?? []),
  ];

  const hasHardFailure =
    flexure.isDoublyReinforced ||
    (flexuralAdequacy !== undefined && !flexuralAdequacy.adequate) ||
    (crackControl !== undefined && !crackControl.adequate);

  const overallStatus: RcBeamDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    flexure,
    flexuralAdequacy,
    shear,
    deflection,
    crackControl,
    allWarnings,
    overallStatus,
  };
}

export type { BeamSupportCondition } from "@/lib/design/rcBeamDeflection";
