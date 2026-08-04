/**
 * Mat/Raft Foundation Design — Top-Level Orchestrator
 * Phase 7c — Rigid-method sizing (uniform/eccentric pressure) →
 * per-column local flexure (isolated-footing cantilever-strip pattern,
 * local tributary pressure ব্যবহার করে) → per-column punching shear।
 * One-way (wide-beam) shear mat-এ সাধারণত governing না (ACI প্র্যাকটিসে
 * punching shear-ই critical mode বড় mat-এ), তাই v1-এ শুধু punching
 * শামিল — one-way shear ভবিষ্যতে প্রয়োজনে যোগ করা যাবে।
 */

import { sizeMatFoundation, type MatFoundationSizingResult, type MatColumnLoad } from "@/lib/design/matFoundationSizing";
import { computeFootingMoment, designFootingFlexuralReinforcement } from "@/lib/design/footingFlexure";
import type { FootingMomentResult } from "@/lib/design/footingFlexure";
import type { FlexuralDesignResult } from "@/lib/design/rcBeamFlexure";
import { checkMatColumnPunchingShear } from "@/lib/design/matFoundationPunching";
import type { ColumnPosition, PunchingShearResult } from "@/lib/design/rcSlabPunchingShear";

export interface MatColumnDesignInput {
  label: string;
  xM: number;
  zM: number;
  servicePointLoadKN: number;
  factoredPointLoadKN: number;
  columnWidthMm: number;
  columnDepthMm: number;
  columnPosition: ColumnPosition;
  // স্থানীয় flexure হিসাব করতে, কলামের চারপাশে ধরে নেওয়া tributary
  // cantilever dimension (mat edge/adjacent-column পর্যন্ত অর্ধ-দূরত্ব) —
  // ইঞ্জিনিয়ার সরবরাহ করেন কারণ এই মডিউল automatic tributary-area
  // detection করে না (arbitrary polygon mat, arbitrary column grid)।
  tributaryCantileverMm: number;
}

export interface MatFoundationDesignInput {
  elementLabel: string;
  vertices: { xM: number; zM: number }[];
  columns: MatColumnDesignInput[];
  allowableBearingPressureKPa: number;
  thicknessMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

export interface MatColumnDesignReport {
  label: string;
  servicePressureKPa: number;
  moment: FootingMomentResult;
  flexuralDesign: FlexuralDesignResult;
  punchingShear: PunchingShearResult;
}

export interface MatFoundationDesignReport {
  elementLabel: string;
  sizing: MatFoundationSizingResult;
  perColumn: MatColumnDesignReport[];
  allWarnings: string[];
  overallStatus: "ok" | "warning" | "error";
}

export function runMatFoundationDesign(input: MatFoundationDesignInput): MatFoundationDesignReport {
  const { elementLabel, vertices, columns, allowableBearingPressureKPa, thicknessMm, effectiveCoverMm, fcMPa, fyMPa } =
    input;

  const columnLoads: MatColumnLoad[] = columns.map((c) => ({
    label: c.label,
    xM: c.xM,
    zM: c.zM,
    servicePointLoadKN: c.servicePointLoadKN,
  }));

  const sizing = sizeMatFoundation({
    vertices,
    columnLoads,
    allowableBearingPressureKPa,
  });

  const effectiveDepth = thicknessMm - effectiveCoverMm;

  const perColumn: MatColumnDesignReport[] = columns.map((c) => {
    const pressureEntry = sizing.perColumnPressure.find((p) => p.label === c.label);
    const servicePressure = pressureEntry?.pressureKPa ?? sizing.averagePressureKPa;

    // Factored local pressure — factoredLoad/serviceLoad ratio দিয়ে
    // service pressure স্কেল করা হয় (rigorous factored-pressure রিডিজাইনের
    // বদলে, isolated footing প্যাটার্নের সাথে সঙ্গতিপূর্ণ সরলীকরণ)।
    const loadRatio = c.servicePointLoadKN > 0 ? c.factoredPointLoadKN / c.servicePointLoadKN : 1;
    const factoredPressure = servicePressure * loadRatio;

    const moment = computeFootingMoment({
      footingDimensionMm: c.columnWidthMm + 2 * c.tributaryCantileverMm,
      columnDimensionMm: c.columnWidthMm,
      factoredSoilPressureKPa: factoredPressure,
    });

    const flexuralDesign = designFootingFlexuralReinforcement({
      moment,
      thicknessMm,
      effectiveCoverMm,
      fcMPa,
      fyMPa,
    });

    const punchingShear = checkMatColumnPunchingShear({
      columnWidthMm: c.columnWidthMm,
      columnDepthMm: c.columnDepthMm,
      effectiveDepthMm: effectiveDepth,
      fcMPa,
      columnPosition: c.columnPosition,
      factoredColumnLoadKN: c.factoredPointLoadKN,
    });

    return { label: c.label, servicePressureKPa: servicePressure, moment, flexuralDesign, punchingShear };
  });

  const allWarnings = [
    ...sizing.warnings,
    ...perColumn.flatMap((c) => [...c.flexuralDesign.warnings, ...c.punchingShear.warnings]),
  ];

  const hasHardFailure =
    sizing.isUplift || perColumn.some((c) => c.flexuralDesign.isDoublyReinforced || !c.punchingShear.adequate);

  const overallStatus: MatFoundationDesignReport["overallStatus"] = hasHardFailure
    ? "error"
    : allWarnings.length > 0
      ? "warning"
      : "ok";

  return { elementLabel, sizing, perColumn, allWarnings, overallStatus };
}
