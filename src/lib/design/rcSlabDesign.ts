/**
 * RC Slab Design — Top-Level Orchestrator
 * Phase 6d — Moment (coefficient method) → Flexural Reinforcement →
 * Min Thickness/Reinforcement → (ঐচ্ছিক) Punching Shear — একসাথে
 * চালিয়ে একটা সম্পূর্ণ RcSlabDesignReport বানায়।
 */

import {
  computeSlabDesignMoments,
  designSlabFlexuralReinforcement,
  type SlabPanelType,
  type SlabMomentResult,
  type SlabFlexuralDesignResult,
} from "@/lib/design/rcSlabFlexure";
import {
  computeSlabMinThickness,
  computeSlabMinReinforcement,
  type SlabEdgeCondition,
  type SlabMinThicknessResult,
  type SlabMinReinforcementResult,
} from "@/lib/design/rcSlabThickness";
import {
  checkPunchingShear,
  type ColumnPosition,
  type PunchingShearResult,
} from "@/lib/design/rcSlabPunchingShear";

export interface RcSlabDesignInput {
  elementLabel: string;
  panelType: SlabPanelType;
  shortSpanMm: number;
  longSpanMm?: number;
  clearSpanLongDirectionMm: number; // min-thickness check এর জন্য
  isOneWayContinuous?: boolean;
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
  factoredLoadKPa: number; // wu

  // ঐচ্ছিক punching shear check (শুধু column-supported slab এ প্রযোজ্য — flat slab/flat plate)
  punchingCheck?: {
    columnWidthMm: number;
    columnDepthMm: number;
    columnPosition: ColumnPosition;
    factoredColumnShearKN: number;
  };
}

export interface RcSlabDesignReport {
  elementLabel: string;
  moments: SlabMomentResult;
  flexuralDesign: SlabFlexuralDesignResult;
  minThickness: SlabMinThicknessResult;
  minReinforcement: SlabMinReinforcementResult;
  thicknessAdequate: boolean;
  punchingShear: PunchingShearResult | null;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runRcSlabDesign(input: RcSlabDesignInput): RcSlabDesignReport {
  const edgeCondition: SlabEdgeCondition =
    input.panelType === "one-way"
      ? "one-way"
      : input.panelType === "two-way-interior"
        ? "interior-panel"
        : input.panelType === "two-way-edge"
          ? "edge-panel"
          : "corner-panel";

  const moments = computeSlabDesignMoments({
    panelType: input.panelType,
    shortSpanMm: input.shortSpanMm,
    longSpanMm: input.longSpanMm,
    factoredLoadKPa: input.factoredLoadKPa,
    isOneWayContinuous: input.isOneWayContinuous,
  });

  const flexuralDesign = designSlabFlexuralReinforcement({
    moments,
    thicknessMm: input.thicknessMm,
    effectiveCoverMm: input.effectiveCoverMm,
    fcMPa: input.fcMPa,
    fyMPa: input.fyMPa,
  });

  const minThickness = computeSlabMinThickness({
    edgeCondition,
    clearSpanLongDirectionMm: input.clearSpanLongDirectionMm,
    oneWaySpanMm: input.panelType === "one-way" ? input.shortSpanMm : undefined,
    oneWaySupportCondition: input.isOneWayContinuous ? "one-end-continuous" : "simply-supported",
  });

  const minReinforcement = computeSlabMinReinforcement({
    thicknessMm: input.thicknessMm,
    fyMPa: input.fyMPa,
  });

  const thicknessAdequate = input.thicknessMm >= minThickness.minThicknessMm;

  let punchingShear: PunchingShearResult | null = null;
  if (input.punchingCheck) {
    punchingShear = checkPunchingShear({
      columnWidthMm: input.punchingCheck.columnWidthMm,
      columnDepthMm: input.punchingCheck.columnDepthMm,
      slabEffectiveDepthMm: input.thicknessMm - input.effectiveCoverMm,
      fcMPa: input.fcMPa,
      columnPosition: input.punchingCheck.columnPosition,
      factoredShearKN: input.punchingCheck.factoredColumnShearKN,
    });
  }

  const allWarnings = [
    ...flexuralDesign.positiveDesign.warnings,
    ...(flexuralDesign.negativeDesign?.warnings ?? []),
    ...(punchingShear?.warnings ?? []),
  ];

  if (!thicknessAdequate) {
    allWarnings.push(
      `Provided thickness (${input.thicknessMm.toFixed(0)}mm) is below the ACI deflection-control minimum (${minThickness.minThicknessMm.toFixed(0)}mm) — increase thickness or perform a detailed deflection calculation.`
    );
  }

  const hasHardFailure =
    flexuralDesign.positiveDesign.isDoublyReinforced ||
    (flexuralDesign.negativeDesign?.isDoublyReinforced ?? false) ||
    (punchingShear !== null && !punchingShear.adequate);

  const overallStatus: RcSlabDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : !thicknessAdequate || allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel: input.elementLabel,
    moments,
    flexuralDesign,
    minThickness,
    minReinforcement,
    thicknessAdequate,
    punchingShear,
    allWarnings,
    overallStatus,
  };
}
