/**
 * Pile Cap + Pile Group Design — Top-Level Orchestrator
 * Phase 7d — একটা PileGroupElement এর গ্রিড থেকে pile position জেনারেট
 * → group efficiency ও per-pile allowable capacity → rigid pile-cap
 * load distribution (per-pile factored reaction) → adequacy check
 * (কোনো pile ওভারলোড বা uplift কিনা) → cap flexure ও shear (দুই
 * প্রধান দিকে) → punching shear।
 */

import { computePileAxialCapacity, type PileCapacityInput } from "@/lib/design/pileCapacity";
import {
  computePileGroupEfficiency,
  distributePileCapLoad,
  type PileGroupGeometryInput,
  type PilePosition,
} from "@/lib/design/pileGroupCapacity";
import {
  computePileCapMoment,
  designPileCapFlexuralReinforcement,
  checkPileCapOneWayShear,
  checkPileCapPunchingShear,
  type PileCapPileReaction,
} from "@/lib/design/pileCapDesign";
import type { ColumnPosition } from "@/lib/design/rcSlabPunchingShear";

export interface PileGroupDesignInput {
  pileShape: "circular" | "square";
  pileDiameterOrWidthMm: number;
  embeddedLengthMm: number;
  unitSkinFrictionKPa: number;
  endBearingPressureKPa: number;
  pileFactorOfSafety?: number;
  pileSpacingCenterToCenterMm: number;
  numberOfRows: number;
  numberOfColumns: number;
}

export interface PileCapGeometryInput {
  widthMm: number; // X-direction
  lengthMm: number; // Z-direction
  thicknessMm: number;
  effectiveCoverMm: number;
}

export interface PileCapColumnInput {
  columnWidthMm: number; // X-direction
  columnDepthMm: number; // Z-direction
  columnPosition: ColumnPosition;
  servicePointLoadKN: number;
  factoredPointLoadKN: number;
  momentXKNm?: number;
  momentZKNm?: number;
}

export interface PileCapDesignInput {
  elementLabel: string;
  pileGroup: PileGroupDesignInput;
  cap: PileCapGeometryInput;
  column: PileCapColumnInput;
  fcMPa: number;
  fyMPa: number;
}

export interface PileCapPileSummary {
  label: string;
  xM: number;
  zM: number;
  factoredReactionKN: number;
  serviceReactionKN: number;
  utilizationRatio: number;
  adequate: boolean;
}

export interface PileCapDesignReport {
  elementLabel: string;
  numberOfPiles: number;
  groupEfficiency: number;
  allowableCapacityPerPileKN: number; // group efficiency দিয়ে reduce করার পরে
  piles: PileCapPileSummary[];
  isUplift: boolean;
  flexureX: ReturnType<typeof designPileCapFlexuralReinforcement>;
  flexureZ: ReturnType<typeof designPileCapFlexuralReinforcement>;
  shearX: ReturnType<typeof checkPileCapOneWayShear>;
  shearZ: ReturnType<typeof checkPileCapOneWayShear>;
  punchingShear: ReturnType<typeof checkPileCapPunchingShear>;
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

function generatePilePositions(geometry: PileGroupGeometryInput): PilePosition[] {
  const { numberOfRows, numberOfColumns, pileSpacingCenterToCenterMm } = geometry;
  const spacingM = pileSpacingCenterToCenterMm / 1000;
  const positions: PilePosition[] = [];

  const totalWidthX = (numberOfColumns - 1) * spacingM;
  const totalWidthZ = (numberOfRows - 1) * spacingM;

  let index = 1;
  for (let row = 0; row < numberOfRows; row++) {
    for (let col = 0; col < numberOfColumns; col++) {
      const xM = col * spacingM - totalWidthX / 2;
      const zM = row * spacingM - totalWidthZ / 2;
      positions.push({ label: `P${index}`, xM, zM });
      index++;
    }
  }

  return positions;
}

export function runPileCapDesign(input: PileCapDesignInput): PileCapDesignReport {
  const { elementLabel, pileGroup, cap, column, fcMPa, fyMPa } = input;

  const capacityInput: PileCapacityInput = {
    shape: pileGroup.pileShape,
    diameterOrWidthMm: pileGroup.pileDiameterOrWidthMm,
    embeddedLengthMm: pileGroup.embeddedLengthMm,
    unitSkinFrictionKPa: pileGroup.unitSkinFrictionKPa,
    endBearingPressureKPa: pileGroup.endBearingPressureKPa,
    factorOfSafety: pileGroup.pileFactorOfSafety,
  };
  const singlePileCapacity = computePileAxialCapacity(capacityInput);

  const efficiency = computePileGroupEfficiency({
    pileDiameterOrWidthMm: pileGroup.pileDiameterOrWidthMm,
    pileSpacingCenterToCenterMm: pileGroup.pileSpacingCenterToCenterMm,
    numberOfRows: pileGroup.numberOfRows,
    numberOfColumns: pileGroup.numberOfColumns,
  });

  const allowableCapacityPerPile = singlePileCapacity.allowableCapacityKN * efficiency.efficiencyFactor;

  const positions = generatePilePositions({
    pileDiameterOrWidthMm: pileGroup.pileDiameterOrWidthMm,
    pileSpacingCenterToCenterMm: pileGroup.pileSpacingCenterToCenterMm,
    numberOfRows: pileGroup.numberOfRows,
    numberOfColumns: pileGroup.numberOfColumns,
  });

  const distribution = distributePileCapLoad({
    piles: positions,
    totalFactoredLoadKN: column.factoredPointLoadKN,
    momentXKNm: column.momentXKNm,
    momentZKNm: column.momentZKNm,
  });

  const serviceDistribution = distributePileCapLoad({
    piles: positions,
    totalFactoredLoadKN: column.servicePointLoadKN,
    momentXKNm: column.momentXKNm,
    momentZKNm: column.momentZKNm,
  });

  const piles: PileCapPileSummary[] = positions.map((p, i) => {
    const factoredReaction = distribution.perPileReaction[i]?.reactionKN ?? 0;
    const serviceReaction = serviceDistribution.perPileReaction[i]?.reactionKN ?? 0;
    const ratio =
      allowableCapacityPerPile > 0 ? Math.abs(serviceReaction) / allowableCapacityPerPile : Number.POSITIVE_INFINITY;
    return {
      label: p.label,
      xM: p.xM,
      zM: p.zM,
      factoredReactionKN: factoredReaction,
      serviceReactionKN: serviceReaction,
      utilizationRatio: ratio,
      adequate: Number.isFinite(ratio) && ratio <= 1.0,
    };
  });

  const pileReactionsForCapDesign: PileCapPileReaction[] = positions.map((p, i) => ({
    label: p.label,
    xM: p.xM,
    zM: p.zM,
    factoredReactionKN: distribution.perPileReaction[i]?.reactionKN ?? 0,
  }));

  const effectiveDepth = cap.thicknessMm - cap.effectiveCoverMm;

  const momentX = computePileCapMoment({
    piles: pileReactionsForCapDesign,
    columnWidthMm: column.columnWidthMm,
    columnFaceOffsetMm: column.columnWidthMm / 2,
    direction: "x",
  });
  const momentZ = computePileCapMoment({
    piles: pileReactionsForCapDesign,
    columnWidthMm: column.columnDepthMm,
    columnFaceOffsetMm: column.columnDepthMm / 2,
    direction: "z",
  });

  const flexureX = designPileCapFlexuralReinforcement({
    moment: momentX,
    capWidthMm: cap.lengthMm, // X-দিকের moment cap-এর Z-length জুড়ে distributed
    thicknessMm: cap.thicknessMm,
    effectiveCoverMm: cap.effectiveCoverMm,
    fcMPa,
    fyMPa,
  });
  const flexureZ = designPileCapFlexuralReinforcement({
    moment: momentZ,
    capWidthMm: cap.widthMm,
    thicknessMm: cap.thicknessMm,
    effectiveCoverMm: cap.effectiveCoverMm,
    fcMPa,
    fyMPa,
  });

  const shearX = checkPileCapOneWayShear({
    piles: pileReactionsForCapDesign,
    columnWidthMm: column.columnWidthMm,
    effectiveDepthMm: effectiveDepth,
    direction: "x",
    capWidthMm: cap.lengthMm,
    fcMPa,
  });
  const shearZ = checkPileCapOneWayShear({
    piles: pileReactionsForCapDesign,
    columnWidthMm: column.columnDepthMm,
    effectiveDepthMm: effectiveDepth,
    direction: "z",
    capWidthMm: cap.widthMm,
    fcMPa,
  });

  const punchingShear = checkPileCapPunchingShear({
    columnWidthMm: column.columnWidthMm,
    columnDepthMm: column.columnDepthMm,
    effectiveDepthMm: effectiveDepth,
    fcMPa,
    columnPosition: column.columnPosition,
    totalFactoredColumnLoadKN: column.factoredPointLoadKN,
  });

  const allWarnings = [
    ...singlePileCapacity.warnings,
    ...efficiency.warnings,
    ...distribution.warnings,
    ...momentX.warnings,
    ...momentZ.warnings,
    ...flexureX.warnings,
    ...flexureZ.warnings,
    ...shearX.warnings,
    ...shearZ.warnings,
    ...punchingShear.warnings,
  ];

  const hasHardFailure =
    distribution.isUplift ||
    piles.some((p) => !p.adequate) ||
    flexureX.isDoublyReinforced ||
    flexureZ.isDoublyReinforced ||
    !shearX.adequate ||
    !shearZ.adequate ||
    !punchingShear.adequate;

  const overallStatus: PileCapDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return {
    elementLabel,
    numberOfPiles: positions.length,
    groupEfficiency: efficiency.efficiencyFactor,
    allowableCapacityPerPileKN: allowableCapacityPerPile,
    piles,
    isUplift: distribution.isUplift,
    flexureX,
    flexureZ,
    shearX,
    shearZ,
    punchingShear,
    allWarnings,
    overallStatus,
  };
}
