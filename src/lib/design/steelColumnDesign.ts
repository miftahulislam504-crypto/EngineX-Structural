/**
 * Steel Column Design — Top-Level Orchestrator
 * Phase 6c — Compression (AISC E3) + Flexure (AISC F2, একই W-shape
 * flexure logic beam এর সাথে শেয়ার করা হয়েছে) + Combined Interaction
 * (AISC H1) — একসাথে চালিয়ে একটা সম্পূর্ণ SteelColumnDesignReport
 * বানায়। শুধু W-shape, uniaxial major-axis bending সমর্থিত।
 */

import { computeSteelWShapeDesignProperties, type SteelDesignProperties } from "@/lib/design/steelSectionProperties";
import {
  computeSteelColumnCompressionCapacity,
  type CompressionCapacityResult,
} from "@/lib/design/steelColumnCompression";
import { checkSteelBeamFlexuralCapacity, type FlexuralCapacityResult } from "@/lib/design/steelBeamFlexure";
import {
  checkAxialFlexureInteraction,
  type AxialFlexureInteractionResult,
} from "@/lib/design/steelAxialFlexureInteraction";
import type { WShapeSection } from "@/lib/types/section";

export interface SteelColumnDesignInput {
  elementLabel: string;
  section: WShapeSection;
  fyMPa: number;
  esMPa: number;
  unbracedLengthMm: number; // KL (effective length ইঞ্জিনিয়ার আগেই প্রয়োগ করে দেন — এই মডিউল আলাদা k factor নেয় না, RC Column panel এর মতো)
  cb?: number;
  factoredAxialLoadKN: number; // Pu
  factoredMomentKNm: number; // Mu, major axis
}

export interface SteelColumnDesignReport {
  elementLabel: string;
  properties: SteelDesignProperties;
  compressionCapacity: CompressionCapacityResult;
  flexuralCapacity: FlexuralCapacityResult;
  interaction: AxialFlexureInteractionResult;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runSteelColumnDesign(input: SteelColumnDesignInput): SteelColumnDesignReport {
  const properties = computeSteelWShapeDesignProperties(input.section);

  const compressionCapacity = computeSteelColumnCompressionCapacity({
    properties,
    unbracedLengthMm: input.unbracedLengthMm,
    fyMPa: input.fyMPa,
    esMPa: input.esMPa,
  });

  const flexuralCapacity = checkSteelBeamFlexuralCapacity({
    properties,
    fyMPa: input.fyMPa,
    esMPa: input.esMPa,
    unbracedLengthMm: input.unbracedLengthMm,
    cb: input.cb,
  });

  const interaction = checkAxialFlexureInteraction({
    factoredAxialKN: input.factoredAxialLoadKN,
    phiPnKN: compressionCapacity.phiPnKN,
    factoredMomentKNm: input.factoredMomentKNm,
    phiMnKNm: flexuralCapacity.phiMnKNm,
  });

  const allWarnings = [...compressionCapacity.warnings, ...flexuralCapacity.warnings];

  const hasHardFailure = !flexuralCapacity.isCompact || !interaction.adequate;

  const overallStatus: SteelColumnDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    properties,
    compressionCapacity,
    flexuralCapacity,
    interaction,
    allWarnings,
    overallStatus,
  };
}
