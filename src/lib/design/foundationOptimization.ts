/**
 * Foundation Optimization — Real Search Engine
 * Phase 9a — Phase 7f-এর placeholder (runFoundationOptimization stub)
 * এর জায়গায় বাস্তব exhaustive/grid-search অ্যালগরিদম। প্রতিটা
 * candidate dimension-set কে Phase 6e/7a-7d এর already-verified design
 * module (footingDesign, combinedFootingDesign, stripFootingDesign,
 * matFoundationDesign, pileCapGroupDesign) দিয়ে সরাসরি চালিয়ে
 * feasibility চেক করা হয় — কোনো নতুন structural physics এখানে যোগ
 * হয়নি, শুধু search automation।
 *
 * গুরুত্বপূর্ণ সংশোধন (Phase 7f template থেকে): isolated/combined/strip
 * /mat foundation-এর plan dimension (width/length) engineer-input না —
 * সেগুলো bearing pressure থেকে sizing module নিজেই derive করে (দেখুন
 * footingSizing.ts, combinedFootingSizing.ts, stripFootingSizing.ts,
 * matFoundationSizing.ts)। তাই সেগুলোকে স্বাধীন search variable ধরে
 * sweep করা ভুল — Phase 7f এর টেমপ্লেটে widthMm/lengthMm কে variable
 * হিসেবে দেখানো হয়েছিল, যেটা বাস্তব sizing architecture-এর সাথে না
 * মেলায় এখানে সংশোধন করা হলো। এই চার ধরনের জন্য প্রকৃত স্বাধীন
 * variable শুধু thicknessMm (এবং combined footing-এ perpendicularWidthMm,
 * যেটা sizing module নিজেই bearing-derived length থেকে আলাদা ইঞ্জিনিয়ার-
 * ইনপুট হিসেবে নেয়)। একমাত্র Pile Cap-এ widthMm/lengthMm/thicknessMm/
 * pileSpacingCenterToCenterMm সবগুলোই সত্যিকারের স্বাধীন geometry input
 * (runPileCapDesign সরাসরি এগুলো নেয়, কোনো auto-sizing নেই) — তাই
 * Pile Cap-ই একমাত্র type যেখানে Phase 7f-এর multi-variable template
 * হুবহু প্রযোজ্য।
 */

import { runFootingDesign, type FootingDesignInput, type FootingDesignReport } from "@/lib/design/footingDesign";
import {
  runCombinedFootingDesign,
  type CombinedFootingDesignInput,
  type CombinedFootingDesignReport,
} from "@/lib/design/combinedFootingDesign";
import {
  runStripFootingDesign,
  type StripFootingDesignInput,
  type StripFootingDesignReport,
} from "@/lib/design/stripFootingDesign";
import {
  runMatFoundationDesign,
  type MatFoundationDesignInput,
  type MatFoundationDesignReport,
} from "@/lib/design/matFoundationDesign";
import { runPileCapDesign, type PileCapDesignInput, type PileCapDesignReport } from "@/lib/design/pileCapGroupDesign";

export type FoundationOptimizationObjective = "minimize-concrete-volume" | "minimize-steel-weight" | "minimize-total-cost";

export type FoundationType = "isolated-footing" | "combined-footing" | "strip-footing" | "mat-foundation" | "pile-cap";

export interface FoundationOptimizationVariable {
  name: string;
  minValue: number;
  maxValue: number;
  stepSize?: number; // discrete step — না দিলে continuous ধরা হবে, কিন্তু grid search-এর জন্য stepSize আবশ্যক (না থাকলে ৫০mm ডিফল্ট ধরা হয়)
}

export interface FoundationOptimizationConstraint {
  name: string;
  description: string;
}

export interface FoundationOptimizationProblem {
  foundationType: FoundationType;
  objective: FoundationOptimizationObjective;
  variables: FoundationOptimizationVariable[];
  constraints: FoundationOptimizationConstraint[];
}

/** একটা candidate dimension-set এর পরীক্ষার ফলাফল — গৃহীত হোক বা না হোক। */
export interface FoundationOptimizationCandidate {
  variableValues: Record<string, number>;
  concreteVolumeM3: number;
  feasible: boolean;
  overallStatus: "ok" | "warning" | "error";
  failureReasons: string[];
}

export interface FoundationOptimizationResult {
  implemented: true;
  foundationType: FoundationType;
  objective: FoundationOptimizationObjective;
  candidatesEvaluated: number;
  feasibleCandidatesFound: number;
  best: FoundationOptimizationCandidate | null;
  bestReport:
    | FootingDesignReport
    | CombinedFootingDesignReport
    | StripFootingDesignReport
    | MatFoundationDesignReport
    | PileCapDesignReport
    | null;
  message: string;
}

/** thicknessMm-এর মতো একক-variable sweep-এর জন্য ছোট হেল্পার — min থেকে max পর্যন্ত step অনুযায়ী candidate তালিকা। */
function buildRange(v: FoundationOptimizationVariable): number[] {
  const step = v.stepSize && v.stepSize > 0 ? v.stepSize : 50;
  const values: number[] = [];
  for (let x = v.minValue; x <= v.maxValue + 1e-6; x += step) {
    values.push(Math.round(x * 100) / 100);
  }
  if (values.length === 0) values.push(v.minValue);
  return values;
}

function getVar(problem: FoundationOptimizationProblem, name: string): FoundationOptimizationVariable | undefined {
  return problem.variables.find((v) => v.name === name);
}

// ---------------------------------------------------------------------------
// Isolated Footing — sweep thicknessMm only; sizing (width/length) plan
// dimension bearing pressure থেকেই derive হয়, তাই সেটা optimizer variable
// না। Concrete volume = plan area (sizing থেকে) × thickness।
// ---------------------------------------------------------------------------
export interface IsolatedFootingOptimizationInput {
  elementLabel: string;
  servicePointLoadKN: number;
  factoredPointLoadKN: number;
  allowableBearingPressureKPa: number;
  isSquareFooting: boolean;
  aspectRatio?: number;
  columnWidthMm: number;
  columnDepthMm: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

function optimizeIsolatedFooting(
  problem: FoundationOptimizationProblem,
  base: IsolatedFootingOptimizationInput
): FoundationOptimizationResult {
  const thicknessVar = getVar(problem, "thicknessMm");
  const thicknesses = thicknessVar ? buildRange(thicknessVar) : buildRange({ name: "thicknessMm", minValue: 300, maxValue: 1200, stepSize: 50 });

  let best: FoundationOptimizationCandidate | null = null;
  let bestReport: FootingDesignReport | null = null;
  let feasibleCount = 0;

  for (const thicknessMm of thicknesses) {
    const input: FootingDesignInput = { ...base, thicknessMm };
    const report = runFootingDesign(input);
    const areaM2 = (report.sizing.widthMm / 1000) * (report.sizing.lengthMm / 1000);
    const volumeM3 = areaM2 * (thicknessMm / 1000);
    const feasible = report.overallStatus !== "error";
    if (feasible) feasibleCount++;

    const candidate: FoundationOptimizationCandidate = {
      variableValues: { thicknessMm, widthMm: report.sizing.widthMm, lengthMm: report.sizing.lengthMm },
      concreteVolumeM3: volumeM3,
      feasible,
      overallStatus: report.overallStatus,
      failureReasons: feasible ? [] : report.allWarnings,
    };

    if (feasible && (!best || volumeM3 < best.concreteVolumeM3)) {
      best = candidate;
      bestReport = report;
    }
  }

  return {
    implemented: true,
    foundationType: "isolated-footing",
    objective: problem.objective,
    candidatesEvaluated: thicknesses.length,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${thicknesses.length}টি thickness candidate পরীক্ষা করা হয়েছে (${thicknesses[0]}mm–${thicknesses[thicknesses.length - 1]}mm), ${feasibleCount}টি feasible। সর্বনিম্ন concrete volume: ${best.concreteVolumeM3.toFixed(2)} m³ (thickness ${best.variableValues.thicknessMm}mm, plan ${best.variableValues.widthMm}×${best.variableValues.lengthMm}mm)।`
      : `${thicknesses.length}টি thickness candidate-এর একটাও feasible হয়নি — thickness range বাড়িয়ে আবার চেষ্টা করুন, অথবা allowable bearing pressure/load ইনপুট যাচাই করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Combined Footing — sweep thicknessMm × perpendicularWidthMm (দুটোই সত্যিকার
// স্বাধীন ইনপুট; footingLengthMm resultant-centroid থেকে sizing module নিজে
// derive করে)।
// ---------------------------------------------------------------------------
export interface CombinedFootingOptimizationInput {
  elementLabel: string;
  servicePointLoadAKN: number;
  servicePointLoadBKN: number;
  factoredPointLoadAKN: number;
  factoredPointLoadBKN: number;
  columnToColumnSpacingMm: number;
  columnAWidthMm: number;
  columnADepthMm: number;
  columnBWidthMm: number;
  columnBDepthMm: number;
  allowableBearingPressureKPa: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

function optimizeCombinedFooting(
  problem: FoundationOptimizationProblem,
  base: CombinedFootingOptimizationInput
): FoundationOptimizationResult {
  const thicknessVar = getVar(problem, "thicknessMm");
  const widthVar = getVar(problem, "perpendicularWidthMm");
  const thicknesses = thicknessVar ? buildRange(thicknessVar) : buildRange({ name: "thicknessMm", minValue: 400, maxValue: 1500, stepSize: 50 });
  const widths = widthVar ? buildRange(widthVar) : buildRange({ name: "perpendicularWidthMm", minValue: 1000, maxValue: 4000, stepSize: 50 });

  let best: FoundationOptimizationCandidate | null = null;
  let bestReport: CombinedFootingDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const perpendicularWidthMm of widths) {
    for (const thicknessMm of thicknesses) {
      evaluated++;
      const input: CombinedFootingDesignInput = { ...base, perpendicularWidthMm, thicknessMm };
      const report = runCombinedFootingDesign(input);
      const volumeM3 =
        (report.sizing.footingLengthMm / 1000) * (report.sizing.footingWidthMm / 1000) * (thicknessMm / 1000);
      const feasible = report.overallStatus !== "error";
      if (feasible) feasibleCount++;

      const candidate: FoundationOptimizationCandidate = {
        variableValues: { thicknessMm, perpendicularWidthMm, footingLengthMm: report.sizing.footingLengthMm },
        concreteVolumeM3: volumeM3,
        feasible,
        overallStatus: report.overallStatus,
        failureReasons: feasible ? [] : report.allWarnings,
      };

      if (feasible && (!best || volumeM3 < best.concreteVolumeM3)) {
        best = candidate;
        bestReport = report;
      }
    }
  }

  return {
    implemented: true,
    foundationType: "combined-footing",
    objective: problem.objective,
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি (width × thickness) candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন concrete volume: ${best.concreteVolumeM3.toFixed(2)} m³ (perpendicular width ${best.variableValues.perpendicularWidthMm}mm, thickness ${best.variableValues.thicknessMm}mm, derived length ${best.variableValues.footingLengthMm}mm)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — variable range বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Strip Footing — sweep footingWidthMm × thicknessMm সরাসরি runStripFootingDesign
// (design-check layer, sizing layer না) এর মাধ্যমে — এই orchestrator উভয় dimension
// কেই direct input হিসেবে নেয়, তাই দুটোই সত্যিকার স্বাধীন variable।
// ---------------------------------------------------------------------------
export interface StripFootingOptimizationInput {
  elementLabel: string;
  supportWidthMm: number;
  effectiveCoverMm: number;
  factoredLinearLoadKNPerM: number;
  fcMPa: number;
  fyMPa: number;
}

function optimizeStripFooting(
  problem: FoundationOptimizationProblem,
  base: StripFootingOptimizationInput
): FoundationOptimizationResult {
  const widthVar = getVar(problem, "widthMm");
  const thicknessVar = getVar(problem, "thicknessMm");
  const widths = widthVar ? buildRange(widthVar) : buildRange({ name: "widthMm", minValue: 400, maxValue: 3000, stepSize: 50 });
  const thicknesses = thicknessVar ? buildRange(thicknessVar) : buildRange({ name: "thicknessMm", minValue: 300, maxValue: 900, stepSize: 50 });

  let best: FoundationOptimizationCandidate | null = null;
  let bestReport: StripFootingDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const footingWidthMm of widths) {
    for (const thicknessMm of thicknesses) {
      evaluated++;
      const effectiveDepthMm = thicknessMm - base.effectiveCoverMm;
      const input: StripFootingDesignInput & { elementLabel: string } = {
        elementLabel: base.elementLabel,
        footingWidthMm,
        supportWidthMm: base.supportWidthMm,
        effectiveDepthMm,
        thicknessMm,
        effectiveCoverMm: base.effectiveCoverMm,
        factoredLinearLoadKNPerM: base.factoredLinearLoadKNPerM,
        fcMPa: base.fcMPa,
        fyMPa: base.fyMPa,
      };
      const report = runStripFootingDesign(input);
      // per-meter-run volume (m³ per m length)
      const volumeM3PerM = (footingWidthMm / 1000) * (thicknessMm / 1000);
      const feasible = report.overallStatus !== "error";
      if (feasible) feasibleCount++;

      const candidate: FoundationOptimizationCandidate = {
        variableValues: { widthMm: footingWidthMm, thicknessMm },
        concreteVolumeM3: volumeM3PerM,
        feasible,
        overallStatus: report.overallStatus,
        failureReasons: feasible ? [] : report.allWarnings,
      };

      if (feasible && (!best || volumeM3PerM < best.concreteVolumeM3)) {
        best = candidate;
        bestReport = report;
      }
    }
  }

  return {
    implemented: true,
    foundationType: "strip-footing",
    objective: problem.objective,
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি (width × thickness) candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন concrete volume: ${best.concreteVolumeM3.toFixed(3)} m³ প্রতি মিটার দৈর্ঘ্যে (width ${best.variableValues.widthMm}mm, thickness ${best.variableValues.thicknessMm}mm)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — variable range বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Mat Foundation — sweep thicknessMm only; plan shape (vertices) ইঞ্জিনিয়ার-
// দেওয়া polygon, optimizer variable না।
// ---------------------------------------------------------------------------
export interface MatFoundationOptimizationInput {
  elementLabel: string;
  vertices: { xM: number; zM: number }[];
  columns: MatFoundationDesignInput["columns"];
  allowableBearingPressureKPa: number;
  effectiveCoverMm: number;
  fcMPa: number;
  fyMPa: number;
}

function computePolygonAreaM2(vertices: { xM: number; zM: number }[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.xM * b.zM - b.xM * a.zM;
  }
  return Math.abs(area) / 2;
}

function optimizeMatFoundation(
  problem: FoundationOptimizationProblem,
  base: MatFoundationOptimizationInput
): FoundationOptimizationResult {
  const thicknessVar = getVar(problem, "thicknessMm");
  const thicknesses = thicknessVar ? buildRange(thicknessVar) : buildRange({ name: "thicknessMm", minValue: 400, maxValue: 2000, stepSize: 50 });
  const planAreaM2 = computePolygonAreaM2(base.vertices);

  let best: FoundationOptimizationCandidate | null = null;
  let bestReport: MatFoundationDesignReport | null = null;
  let feasibleCount = 0;

  for (const thicknessMm of thicknesses) {
    const input: MatFoundationDesignInput = { ...base, thicknessMm };
    const report = runMatFoundationDesign(input);
    const volumeM3 = planAreaM2 * (thicknessMm / 1000);
    const feasible = report.overallStatus !== "error";
    if (feasible) feasibleCount++;

    const candidate: FoundationOptimizationCandidate = {
      variableValues: { thicknessMm },
      concreteVolumeM3: volumeM3,
      feasible,
      overallStatus: report.overallStatus,
      failureReasons: feasible ? [] : report.allWarnings,
    };

    if (feasible && (!best || volumeM3 < best.concreteVolumeM3)) {
      best = candidate;
      bestReport = report;
    }
  }

  return {
    implemented: true,
    foundationType: "mat-foundation",
    objective: problem.objective,
    candidatesEvaluated: thicknesses.length,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${thicknesses.length}টি thickness candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন concrete volume: ${best.concreteVolumeM3.toFixed(2)} m³ (thickness ${best.variableValues.thicknessMm}mm, plan area ${planAreaM2.toFixed(2)} m² অপরিবর্তিত)।`
      : `${thicknesses.length}টি thickness candidate-এর একটাও feasible হয়নি — thickness range বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Pile Cap — sweep widthMm × lengthMm × thicknessMm × pileSpacingCenterToCenterMm;
// একমাত্র type যেখানে সবকয়টা geometry variable সত্যিকার স্বাধীন ইনপুট।
// ---------------------------------------------------------------------------
export interface PileCapOptimizationInput {
  elementLabel: string;
  pileGroup: Omit<PileCapDesignInput["pileGroup"], "pileSpacingCenterToCenterMm">;
  effectiveCoverMm: number;
  column: PileCapDesignInput["column"];
  fcMPa: number;
  fyMPa: number;
}

function optimizePileCap(
  problem: FoundationOptimizationProblem,
  base: PileCapOptimizationInput
): FoundationOptimizationResult {
  const widthVar = getVar(problem, "widthMm");
  const lengthVar = getVar(problem, "lengthMm");
  const thicknessVar = getVar(problem, "thicknessMm");
  const spacingVar = getVar(problem, "pileSpacingCenterToCenterMm");

  const widths = widthVar ? buildRange(widthVar) : buildRange({ name: "widthMm", minValue: 1000, maxValue: 6000, stepSize: 100 });
  const lengths = lengthVar ? buildRange(lengthVar) : buildRange({ name: "lengthMm", minValue: 1000, maxValue: 6000, stepSize: 100 });
  const thicknesses = thicknessVar ? buildRange(thicknessVar) : buildRange({ name: "thicknessMm", minValue: 600, maxValue: 2000, stepSize: 50 });
  const spacings = spacingVar
    ? buildRange(spacingVar)
    : buildRange({ name: "pileSpacingCenterToCenterMm", minValue: 750, maxValue: 3000, stepSize: 50 });

  let best: FoundationOptimizationCandidate | null = null;
  let bestReport: PileCapDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  // ৪-ডাইমেনশনাল grid দ্রুত বড় হয়ে যায় (widths×lengths×thicknesses×spacings)।
  // Full-precision grid search-এর বদলে candidate সংখ্যা যুক্তিসঙ্গত রাখতে
  // এখানে spacing ও thickness-কে coarser sub-sample-এ নেওয়া হলো যদি
  // মোট candidate সংখ্যা একটা ব্যবহারিক cap (২০০০) ছাড়িয়ে যায়।
  const MAX_CANDIDATES = 2000;
  let effectiveThicknesses = thicknesses;
  let effectiveSpacings = spacings;
  while (widths.length * lengths.length * effectiveThicknesses.length * effectiveSpacings.length > MAX_CANDIDATES) {
    if (effectiveThicknesses.length > 3) {
      effectiveThicknesses = effectiveThicknesses.filter((_, i) => i % 2 === 0);
    } else if (effectiveSpacings.length > 3) {
      effectiveSpacings = effectiveSpacings.filter((_, i) => i % 2 === 0);
    } else {
      break;
    }
  }

  for (const widthMm of widths) {
    for (const lengthMm of lengths) {
      for (const thicknessMm of effectiveThicknesses) {
        for (const pileSpacingCenterToCenterMm of effectiveSpacings) {
          evaluated++;
          const input: PileCapDesignInput = {
            elementLabel: base.elementLabel,
            pileGroup: { ...base.pileGroup, pileSpacingCenterToCenterMm },
            cap: { widthMm, lengthMm, thicknessMm, effectiveCoverMm: base.effectiveCoverMm },
            column: base.column,
            fcMPa: base.fcMPa,
            fyMPa: base.fyMPa,
          };
          const report = runPileCapDesign(input);
          const volumeM3 = (widthMm / 1000) * (lengthMm / 1000) * (thicknessMm / 1000);
          const allPilesAdequate = report.piles.every((p) => p.adequate);
          const feasible = report.overallStatus !== "error" && allPilesAdequate;
          if (feasible) feasibleCount++;

          const candidate: FoundationOptimizationCandidate = {
            variableValues: { widthMm, lengthMm, thicknessMm, pileSpacingCenterToCenterMm },
            concreteVolumeM3: volumeM3,
            feasible,
            overallStatus: report.overallStatus,
            failureReasons: feasible
              ? []
              : [...report.allWarnings, ...(allPilesAdequate ? [] : ["এক বা একাধিক pile overload/uplift অবস্থায় আছে।"])],
          };

          if (feasible && (!best || volumeM3 < best.concreteVolumeM3)) {
            best = candidate;
            bestReport = report;
          }
        }
      }
    }
  }

  const coarsened = effectiveThicknesses.length < thicknesses.length || effectiveSpacings.length < spacings.length;

  return {
    implemented: true,
    foundationType: "pile-cap",
    objective: problem.objective,
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি (width × length × thickness × spacing) candidate পরীক্ষা করা হয়েছে${coarsened ? " (৪-ডাইমেনশনাল grid বড় হওয়ায় thickness/spacing sub-sample করা হয়েছে)" : ""}, ${feasibleCount}টি feasible। সর্বনিম্ন concrete volume: ${best.concreteVolumeM3.toFixed(2)} m³ (width ${best.variableValues.widthMm}mm, length ${best.variableValues.lengthMm}mm, thickness ${best.variableValues.thicknessMm}mm, pile spacing ${best.variableValues.pileSpacingCenterToCenterMm}mm)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — variable range বাড়িয়ে বা pile capacity/count বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

/**
 * প্রতিটা supported foundation type-এর জন্য একটা default/example
 * problem template — Phase 7f থেকে ক্যারি-ওভার করা, কিন্তু isolated/
 * combined/strip/mat-এর variable list সংশোধন করা হয়েছে যাতে সেগুলো
 * প্রকৃতপক্ষে স্বাধীন ইনপুট-ই তালিকাভুক্ত করে (উপরের মডিউল-হেডার নোট
 * দেখুন)। Pile Cap অপরিবর্তিত (Phase 7f-এর টেমপ্লেট এখানে সঠিক ছিল)।
 */
export const FOUNDATION_OPTIMIZATION_TEMPLATES: Record<FoundationType, FoundationOptimizationProblem> = {
  "isolated-footing": {
    foundationType: "isolated-footing",
    objective: "minimize-concrete-volume",
    variables: [{ name: "thicknessMm", minValue: 300, maxValue: 1200, stepSize: 50 }],
    constraints: [
      { name: "bearing-pressure", description: "Gross soil pressure must not exceed the allowable bearing pressure." },
      { name: "one-way-shear", description: "Vu must not exceed φVc (wide-beam shear)." },
      { name: "punching-shear", description: "Vu must not exceed φVc (two-way/punching shear)." },
      { name: "flexure", description: "Required As must not exceed what a singly-reinforced section can provide." },
    ],
  },
  "combined-footing": {
    foundationType: "combined-footing",
    objective: "minimize-concrete-volume",
    variables: [
      { name: "perpendicularWidthMm", minValue: 1000, maxValue: 4000, stepSize: 50 },
      { name: "thicknessMm", minValue: 400, maxValue: 1500, stepSize: 50 },
    ],
    constraints: [
      { name: "uniform-pressure", description: "Resultant load should align with the footing centroid to keep pressure uniform." },
      { name: "one-way-shear", description: "Transverse one-way shear at each column must be adequate." },
      { name: "punching-shear", description: "Punching shear at each column must be adequate." },
      { name: "flexure", description: "Both top (hogging) and bottom (sagging) longitudinal reinforcement must be within singly-reinforced limits." },
    ],
  },
  "strip-footing": {
    foundationType: "strip-footing",
    objective: "minimize-concrete-volume",
    variables: [
      { name: "widthMm", minValue: 400, maxValue: 3000, stepSize: 50 },
      { name: "thicknessMm", minValue: 300, maxValue: 900, stepSize: 50 },
    ],
    constraints: [
      { name: "bearing-pressure", description: "Gross soil pressure per meter run must not exceed the allowable bearing pressure." },
      { name: "one-way-shear", description: "Vu must not exceed φVc (wide-beam shear)." },
      { name: "flexure", description: "Required As must not exceed what a singly-reinforced section can provide." },
    ],
  },
  "mat-foundation": {
    foundationType: "mat-foundation",
    objective: "minimize-concrete-volume",
    variables: [{ name: "thicknessMm", minValue: 400, maxValue: 2000, stepSize: 50 }],
    constraints: [
      { name: "bearing-pressure", description: "Maximum computed pressure (rigid-method) must not exceed the allowable bearing pressure." },
      { name: "no-uplift", description: "Minimum computed pressure must remain non-negative (no uplift)." },
      { name: "punching-shear", description: "Punching shear at every column must be adequate." },
    ],
  },
  "pile-cap": {
    foundationType: "pile-cap",
    objective: "minimize-concrete-volume",
    variables: [
      { name: "widthMm", minValue: 1000, maxValue: 6000, stepSize: 100 },
      { name: "lengthMm", minValue: 1000, maxValue: 6000, stepSize: 100 },
      { name: "thicknessMm", minValue: 600, maxValue: 2000, stepSize: 50 },
      { name: "pileSpacingCenterToCenterMm", minValue: 750, maxValue: 3000, stepSize: 50 },
    ],
    constraints: [
      { name: "pile-capacity", description: "No pile's service reaction may exceed its allowable (group-efficiency-reduced) capacity." },
      { name: "no-uplift", description: "No pile may show a negative (tension) reaction under the rigid-cap distribution." },
      { name: "one-way-shear", description: "Cap one-way shear in both directions must be adequate." },
      { name: "punching-shear", description: "Cap punching shear around the column must be adequate." },
    ],
  },
};

/**
 * Dispatcher — foundation type অনুযায়ী সঠিক optimizer ফাংশনে পাঠায়।
 * base input-এ engineer-supplied fixed parameters (loads, column
 * dimensions, material properties ইত্যাদি) থাকে; problem.variables থেকে
 * search range নেওয়া হয়।
 */
export function runFoundationOptimization(
  problem: FoundationOptimizationProblem,
  base:
    | IsolatedFootingOptimizationInput
    | CombinedFootingOptimizationInput
    | StripFootingOptimizationInput
    | MatFoundationOptimizationInput
    | PileCapOptimizationInput
): FoundationOptimizationResult {
  switch (problem.foundationType) {
    case "isolated-footing":
      return optimizeIsolatedFooting(problem, base as IsolatedFootingOptimizationInput);
    case "combined-footing":
      return optimizeCombinedFooting(problem, base as CombinedFootingOptimizationInput);
    case "strip-footing":
      return optimizeStripFooting(problem, base as StripFootingOptimizationInput);
    case "mat-foundation":
      return optimizeMatFoundation(problem, base as MatFoundationOptimizationInput);
    case "pile-cap":
      return optimizePileCap(problem, base as PileCapOptimizationInput);
  }
}
