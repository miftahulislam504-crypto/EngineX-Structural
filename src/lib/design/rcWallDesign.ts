/**
 * RC Wall Design — Top-Level Orchestrator
 * Phase 6d — Empirical axial capacity + minimum reinforcement +
 * (Shear Wall হলে ঐচ্ছিক) in-plane shear check — একসাথে চালিয়ে
 * একটা সম্পূর্ণ RcWallDesignReport বানায়।
 */

import {
  computeWallEmpiricalCapacity,
  computeWallMinReinforcement,
  type WallEmpiricalCapacityResult,
  type WallMinReinforcementResult,
} from "@/lib/design/rcWallEmpirical";
import { checkShearWallCapacity, type ShearWallCapacityResult } from "@/lib/design/rcShearWallShear";

export interface RcWallDesignInput {
  elementLabel: string;
  isShearWall: boolean;
  thicknessMm: number;
  lengthMm: number; // horizontal length (axial capacity strip, বা shear wall এর in-plane length)
  unsupportedHeightMm: number;
  effectiveLengthFactor: number;
  fcMPa: number;
  fyMPa: number;
  barDiameterMm: number;
  factoredAxialLoadKN: number;

  // ঐচ্ছিক — শুধু shear wall এ প্রযোজ্য
  factoredInPlaneShearKN?: number;
}

export interface RcWallDesignReport {
  elementLabel: string;
  axialCapacity: WallEmpiricalCapacityResult;
  minReinforcement: WallMinReinforcementResult;
  shearCapacity: ShearWallCapacityResult | null;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runRcWallDesign(input: RcWallDesignInput): RcWallDesignReport {
  const axialCapacity = computeWallEmpiricalCapacity({
    thicknessMm: input.thicknessMm,
    lengthMm: input.lengthMm,
    unsupportedHeightMm: input.unsupportedHeightMm,
    effectiveLengthFactor: input.effectiveLengthFactor,
    fcMPa: input.fcMPa,
    factoredAxialLoadKN: input.factoredAxialLoadKN,
  });

  const minReinforcement = computeWallMinReinforcement({
    thicknessMm: input.thicknessMm,
    barDiameterMm: input.barDiameterMm,
    fyMPa: input.fyMPa,
  });

  let shearCapacity: ShearWallCapacityResult | null = null;
  if (input.isShearWall && input.factoredInPlaneShearKN !== undefined) {
    shearCapacity = checkShearWallCapacity({
      thicknessMm: input.thicknessMm,
      horizontalLengthMm: input.lengthMm,
      fcMPa: input.fcMPa,
      horizontalReinforcementRatio: minReinforcement.minHorizontalRatio,
      fyMPa: input.fyMPa,
      factoredShearKN: input.factoredInPlaneShearKN,
    });
  }

  const allWarnings = [...axialCapacity.warnings, ...(shearCapacity?.warnings ?? [])];

  const hasHardFailure = !axialCapacity.adequate || (shearCapacity !== null && !shearCapacity.adequate);

  const overallStatus: RcWallDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    axialCapacity,
    minReinforcement,
    shearCapacity,
    allWarnings,
    overallStatus,
  };
}
