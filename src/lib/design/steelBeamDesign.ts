/**
 * Steel Beam Design — Top-Level Orchestrator
 * Phase 6c — Flexure (compactness + yielding/LTB) + Shear checks
 * একসাথে চালিয়ে একটা সম্পূর্ণ SteelBeamDesignReport বানায়। শুধু
 * W-shape section সমর্থিত (HSS/built-up পরে যোগ হবে)।
 */

import { computeSteelWShapeDesignProperties, type SteelDesignProperties } from "@/lib/design/steelSectionProperties";
import {
  checkSteelBeamFlexuralCapacity,
  checkSteelBeamFlexuralAdequacy,
  type FlexuralCapacityResult,
  type FlexuralAdequacyResult,
} from "@/lib/design/steelBeamFlexure";
import {
  computeSteelBeamShearCapacity,
  checkSteelBeamShearAdequacy,
  type ShearCapacityResult,
  type ShearAdequacyResult,
} from "@/lib/design/steelBeamShear";
import type { WShapeSection } from "@/lib/types/section";

export interface SteelBeamDesignInput {
  elementLabel: string;
  section: WShapeSection;
  fyMPa: number;
  esMPa: number;
  unbracedLengthMm: number; // Lb
  cb?: number;
  factoredMomentKNm: number; // Mu
  factoredShearKN: number; // Vu
}

export interface SteelBeamDesignReport {
  elementLabel: string;
  properties: SteelDesignProperties;
  flexuralCapacity: FlexuralCapacityResult;
  flexuralAdequacy: FlexuralAdequacyResult;
  shearCapacity: ShearCapacityResult;
  shearAdequacy: ShearAdequacyResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runSteelBeamDesign(input: SteelBeamDesignInput): SteelBeamDesignReport {
  const properties = computeSteelWShapeDesignProperties(input.section);

  const flexuralCapacity = checkSteelBeamFlexuralCapacity({
    properties,
    fyMPa: input.fyMPa,
    esMPa: input.esMPa,
    unbracedLengthMm: input.unbracedLengthMm,
    cb: input.cb,
  });
  const flexuralAdequacy = checkSteelBeamFlexuralAdequacy(input.factoredMomentKNm, flexuralCapacity);

  const shearCapacity = computeSteelBeamShearCapacity({
    properties,
    webThicknessMm: input.section.webThickness,
    overallDepthMm: input.section.depth,
    fyMPa: input.fyMPa,
    esMPa: input.esMPa,
  });
  const shearAdequacy = checkSteelBeamShearAdequacy(input.factoredShearKN, shearCapacity);

  const allWarnings = [...flexuralCapacity.warnings, ...shearCapacity.warnings];

  const hasHardFailure = !flexuralCapacity.isCompact || !flexuralAdequacy.adequate || !shearAdequacy.adequate;

  const overallStatus: SteelBeamDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    properties,
    flexuralCapacity,
    flexuralAdequacy,
    shearCapacity,
    shearAdequacy,
    allWarnings,
    overallStatus,
  };
}
