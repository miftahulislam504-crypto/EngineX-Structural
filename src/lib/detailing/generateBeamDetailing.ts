/**
 * Beam Detailing Generator
 * Phase 10 — RcBeamDesignReport (Phase 6a) + section/element geometry
 * থেকে একটা পূর্ণাঙ্গ DetailingResult বানায়: top/bottom longitudinal
 * bars (পুরো span জুড়ে, local x-axis বরাবর) + stirrup loops (uniform
 * spacing, required spacing অনুযায়ী) + Bar Bending Schedule।
 *
 * Local coordinate convention (এই element এর জন্য):
 *   x: 0 → spanMm (বার এর অক্ষ বরাবর)
 *   y: 0 (bottom fiber) → totalDepthMm (top fiber)
 *   z: -widthMm/2 → +widthMm/2 (cross-section width, কেন্দ্র থেকে)
 * (DetailingLayer এই local frame কে element এর startPoint→endPoint
 * ভেক্টর বরাবর world-space এ rotate/translate করে বসাবে, ঠিক
 * ElementsLayer যেভাবে cylinder mesh বসায় সেই একই যুক্তিতে।)
 */

import type { RcBeamDesignReport } from "@/lib/design/rcBeamDesign";
import { selectRebarArrangement } from "@/lib/design/barSelection";
import type { DetailingResult, RebarSegment, RebarLoop, BarScheduleRow } from "@/lib/detailing/types";

export interface BeamDetailingInput {
  elementId: string;
  elementLabel: string;
  spanMm: number;
  widthMm: number;
  totalDepthMm: number;
  effectiveCoverMm: number; // extreme tension fiber → main rebar centroid
  stirrupDiameterMm: number;
  report: RcBeamDesignReport;
}

export function generateBeamDetailing(input: BeamDetailingInput): DetailingResult {
  const { elementId, elementLabel, spanMm, widthMm, totalDepthMm, effectiveCoverMm, stirrupDiameterMm, report } =
    input;

  const warnings: string[] = [];
  const clearCoverAllowance = effectiveCoverMm - stirrupDiameterMm; // মোটামুটি bar centroid থেকে bar edge হিসাব, spacing feasibility এর জন্য
  const availableWidthForBars = Math.max(widthMm - 2 * clearCoverAllowance, 50);

  // ------ Bottom (tension, sagging) longitudinal bars ------
  const bottomSelection = selectRebarArrangement({
    requiredAreaMm2: report.flexure.governingAsMm2,
    availableWidthMm: availableWidthForBars,
    minBars: 2,
  });
  warnings.push(...bottomSelection.warnings);

  // ------ Top bars — doubly-reinforced হলে compression steel, নাহলে nominal hanger bars (২টা, ছোট dia) ------
  const hasCompressionSteel = report.flexure.compressionAsMm2 > 0;
  const topSelection = hasCompressionSteel
    ? selectRebarArrangement({
        requiredAreaMm2: report.flexure.compressionAsMm2,
        availableWidthMm: availableWidthForBars,
        minBars: 2,
      })
    : { barDiameterMm: 12, barCount: 2, providedAreaMm2: 0, utilizationRatio: 1, actualSpacingMm: 0, clearSpacingMm: 0, fits: true, warnings: [] as string[] };
  warnings.push(...topSelection.warnings);

  const yBottom = effectiveCoverMm;
  const yTop = totalDepthMm - effectiveCoverMm;

  const longitudinalBars: RebarSegment[] = [];

  function addLayerBars(count: number, diameterMm: number, yLocal: number, role: RebarSegment["role"], prefix: string) {
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      const zLocal = count === 1 ? 0 : -availableWidthForBars / 2 + (availableWidthForBars * i) / (count - 1);
      longitudinalBars.push({
        id: `${elementId}-${prefix}-${i}`,
        startLocal: [0, yLocal, zLocal],
        endLocal: [spanMm, yLocal, zLocal],
        diameterMm,
        role,
      });
    }
  }

  addLayerBars(bottomSelection.barCount, bottomSelection.barDiameterMm, yBottom, "longitudinal-bottom", "bot");
  addLayerBars(topSelection.barCount, topSelection.barDiameterMm, yTop, "longitudinal-top", "top");

  // ------ Stirrups — uniform spacing পুরো span জুড়ে (required spacing অনুযায়ী, না থাকলে max spacing) ------
  const spacingMm = report.shear.requiredSpacingMm ?? report.shear.maxSpacingMm;
  const safeSpacing = Math.max(spacingMm, 50); // পাগলাটে ছোট spacing থেকে infinite loop রক্ষা
  const stirrupCount = Math.max(2, Math.floor(spanMm / safeSpacing) + 1);

  const transverseBars: RebarLoop[] = [];
  const halfW = availableWidthForBars / 2;
  for (let i = 0; i < stirrupCount; i++) {
    const x = Math.min(i * safeSpacing, spanMm);
    transverseBars.push({
      id: `${elementId}-stirrup-${i}`,
      pointsLocal: [
        [x, yBottom, -halfW],
        [x, yTop, -halfW],
        [x, yTop, halfW],
        [x, yBottom, halfW],
        [x, yBottom, -halfW],
      ],
      diameterMm: stirrupDiameterMm,
      role: "stirrup",
      positionAlongAxisMm: x,
    });
  }

  // ------ Bar Bending Schedule ------
  const schedule: BarScheduleRow[] = [];
  if (bottomSelection.barCount > 0) {
    schedule.push({
      barMark: `${elementLabel}-BOT`,
      diameterMm: bottomSelection.barDiameterMm,
      count: bottomSelection.barCount,
      shape: "straight",
      cutLengthMm: spanMm,
      totalLengthMm: spanMm * bottomSelection.barCount,
    });
  }
  if (topSelection.barCount > 0) {
    schedule.push({
      barMark: `${elementLabel}-TOP`,
      diameterMm: topSelection.barDiameterMm,
      count: topSelection.barCount,
      shape: "straight",
      cutLengthMm: spanMm,
      totalLengthMm: spanMm * topSelection.barCount,
    });
  }
  if (stirrupCount > 0) {
    const stirrupPerimeter = 2 * (availableWidthForBars + (totalDepthMm - 2 * (effectiveCoverMm - stirrupDiameterMm))) + 20 * stirrupDiameterMm; // perimeter + hook allowance (10db প্রতি প্রান্তে, আনুমানিক)
    schedule.push({
      barMark: `${elementLabel}-STIR`,
      diameterMm: stirrupDiameterMm,
      count: stirrupCount,
      shape: "stirrup",
      cutLengthMm: stirrupPerimeter,
      totalLengthMm: stirrupPerimeter * stirrupCount,
    });
  }

  return {
    elementId,
    elementLabel,
    category: "beam",
    generatedAt: new Date().toISOString(),
    sourceDesignStatus: report.overallStatus,
    longitudinalBars,
    transverseBars,
    schedule,
    warnings: [...warnings, ...report.allWarnings],
  };
}
