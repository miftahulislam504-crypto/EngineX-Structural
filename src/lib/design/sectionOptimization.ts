/**
 * Section Optimization — Real Search Engine
 * Phase 9b — RC Beam/Column ও Steel Beam/Column-এর জন্য exhaustive
 * search: rebar bar-size/count combination (RC) বা W-shape catalog
 * (Steel) sweep করে, প্রতিটা candidate কে Phase 6a/6b/6c এর
 * already-verified design module (runRcBeamDesign, runRcColumnDesign,
 * runSteelBeamDesign, runSteelColumnDesign) দিয়ে সরাসরি চালিয়ে
 * feasibility চেক করা হয়, এবং feasible candidate-গুলোর মধ্যে থেকে
 * সর্বনিম্ন material quantity (RC: rebar area × length approximation
 * হিসেবে totalAsMm2; Steel: section self-weight অনুপাতে areaMm2)
 * বেছে নেওয়া হয়। এখানে কোনো নতুন structural physics নেই — শুধু
 * search automation, foundationOptimization.ts (Phase 9a) এর একই
 * প্যাটার্ন অনুসরণ করে।
 *
 * Steel section catalog নোট: codebase-এ কোনো standard W-shape
 * database এখনো নেই (lib/types/section.ts এ "standard-database"
 * source ট্যাগ আছে কিন্তু কোনো seeded তালিকা নেই — সব section এখন
 * পর্যন্ত ইঞ্জিনিয়ার library store-এ user-defined হিসেবে যোগ করেন)।
 * তাই এই মডিউলে একটা ছোট, honest, সাধারণভাবে ব্যবহৃত metric W-shape
 * catalog নিচে সংজ্ঞায়িত করা হলো (approximate AISC-এর মতো dimension
 * pattern metric এ রূপান্তরিত) — এটা একটা curated starter set,
 * সম্পূর্ণ AISC manual না। ভবিষ্যতে সম্পূর্ণ ডাটাবেস প্রয়োজন হলে এই
 * catalog প্রতিস্থাপনযোগ্য।
 */

import { runRcBeamDesign, type RcBeamDesignInput, type RcBeamDesignReport } from "@/lib/design/rcBeamDesign";
import { runRcColumnDesign, type RcColumnDesignInput, type RcColumnDesignReport } from "@/lib/design/rcColumnDesign";
import {
  runSteelBeamDesign,
  type SteelBeamDesignInput,
  type SteelBeamDesignReport,
} from "@/lib/design/steelBeamDesign";
import {
  runSteelColumnDesign,
  type SteelColumnDesignInput,
  type SteelColumnDesignReport,
} from "@/lib/design/steelColumnDesign";
import { REBAR_SIZES, totalRebarArea } from "@/lib/design/rebarSizes";
import { computeSteelWShapeDesignProperties } from "@/lib/design/steelSectionProperties";
import type { BeamSupportCondition } from "@/lib/design/rcBeamDeflection";
import type { WShapeSection } from "@/lib/types/section";

export type SectionType = "rc-beam" | "rc-column" | "steel-beam" | "steel-column";

/**
 * Starter metric W-shape catalog — dimension pattern AISC W-shape
 * geometry অনুসরণ করে (metric রূপান্তরিত), কিন্তু এটা সম্পূর্ণ AISC
 * manual প্রতিস্থাপন করে না। নাম কনভেনশন: "W" + nominal depth(mm)
 * + "x" + approximate mass (kg/m, area থেকে derive)। সবচেয়ে ছোট
 * থেকে সবচেয়ে বড় ক্রমে, common preliminary-design range কভার করে।
 */
export interface CatalogWShape {
  designation: string;
  depth: number; // mm
  flangeWidth: number; // mm
  flangeThickness: number; // mm
  webThickness: number; // mm
}

export const STEEL_W_SHAPE_CATALOG: CatalogWShape[] = [
  { designation: "W150x14", depth: 150, flangeWidth: 100, flangeThickness: 7, webThickness: 5 },
  { designation: "W150x22", depth: 152, flangeWidth: 152, flangeThickness: 11, webThickness: 6 },
  { designation: "W200x22", depth: 206, flangeWidth: 102, flangeThickness: 8, webThickness: 6 },
  { designation: "W200x36", depth: 201, flangeWidth: 165, flangeThickness: 10, webThickness: 6 },
  { designation: "W250x33", depth: 258, flangeWidth: 102, flangeThickness: 9, webThickness: 6 },
  { designation: "W250x49", depth: 247, flangeWidth: 202, flangeThickness: 11, webThickness: 7 },
  { designation: "W250x67", depth: 257, flangeWidth: 204, flangeThickness: 16, webThickness: 9 },
  { designation: "W310x39", depth: 310, flangeWidth: 165, flangeThickness: 10, webThickness: 6 },
  { designation: "W310x60", depth: 302, flangeWidth: 203, flangeThickness: 13, webThickness: 8 },
  { designation: "W310x86", depth: 310, flangeWidth: 254, flangeThickness: 16, webThickness: 9 },
  { designation: "W360x51", depth: 355, flangeWidth: 171, flangeThickness: 11, webThickness: 7 },
  { designation: "W360x79", depth: 354, flangeWidth: 205, flangeThickness: 17, webThickness: 9 },
  { designation: "W360x110", depth: 360, flangeWidth: 256, flangeThickness: 20, webThickness: 12 },
  { designation: "W410x60", depth: 407, flangeWidth: 178, flangeThickness: 13, webThickness: 8 },
  { designation: "W410x100", depth: 415, flangeWidth: 260, flangeThickness: 19, webThickness: 11 },
  { designation: "W460x74", depth: 457, flangeWidth: 190, flangeThickness: 15, webThickness: 9 },
  { designation: "W460x113", depth: 463, flangeWidth: 280, flangeThickness: 19, webThickness: 11 },
  { designation: "W530x92", depth: 533, flangeWidth: 209, flangeThickness: 15, webThickness: 10 },
  { designation: "W530x150", depth: 543, flangeWidth: 312, flangeThickness: 24, webThickness: 13 },
  { designation: "W610x125", depth: 612, flangeWidth: 229, flangeThickness: 19, webThickness: 12 },
];

function toWShapeSection(c: CatalogWShape): WShapeSection {
  const now = new Date().toISOString();
  return {
    sectionId: `catalog-${c.designation}`,
    name: c.designation,
    shape: "w-shape",
    source: "standard-database",
    depth: c.depth,
    flangeWidth: c.flangeWidth,
    flangeThickness: c.flangeThickness,
    webThickness: c.webThickness,
    designation: c.designation,
    createdAt: now,
    updatedAt: now,
  };
}

export interface SectionOptimizationCandidate {
  description: string; // মানুষের পড়ার জন্য candidate summary
  variableValues: Record<string, number | string>;
  quantityMetric: number; // objective — RC: totalAsMm2 (rebar cross-section, প্রক্সি হিসেবে rebar weight/length), Steel: section areaMm2 (প্রক্সি হিসেবে self-weight/length)
  quantityLabel: string;
  feasible: boolean;
  overallStatus: "ok" | "warning" | "error";
  failureReasons: string[];
}

export interface SectionOptimizationResult {
  implemented: true;
  sectionType: SectionType;
  candidatesEvaluated: number;
  feasibleCandidatesFound: number;
  best: SectionOptimizationCandidate | null;
  bestReport: RcBeamDesignReport | RcColumnDesignReport | SteelBeamDesignReport | SteelColumnDesignReport | null;
  message: string;
}

// ---------------------------------------------------------------------------
// RC Beam — sweep bar diameter × bar count (main tension steel); width/
// depth/span/shear demand fixed (ইঞ্জিনিয়ার-দেওয়া, এগুলো সাধারণত
// architectural/framing constraint থেকে আসে, optimization variable না)।
// ---------------------------------------------------------------------------
export interface RcBeamOptimizationBase {
  elementLabel: string;
  spanMm: number;
  widthMm: number;
  totalDepthMm: number;
  effectiveCoverMm: number;
  clearCoverMm: number;
  fcMPa: number;
  fyMPa: number;
  stirrupDiameterMm: number;
  supportCondition: BeamSupportCondition;
  factoredMomentKNm: number;
  factoredShearKN: number;
  barDiameterOptionsMm?: number[]; // না দিলে REBAR_SIZES পুরোটা ব্যবহৃত হবে
  minBarCount?: number; // ডিফল্ট ২
  maxBarCount?: number; // ডিফল্ট ৮
}

function optimizeRcBeam(base: RcBeamOptimizationBase): SectionOptimizationResult {
  const barDiameters = base.barDiameterOptionsMm ?? REBAR_SIZES.map((r) => r.diameterMm);
  const minCount = base.minBarCount ?? 2;
  const maxCount = base.maxBarCount ?? 8;

  let best: SectionOptimizationCandidate | null = null;
  let bestReport: RcBeamDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const barDiameterMm of barDiameters) {
    for (let barCount = minCount; barCount <= maxCount; barCount++) {
      evaluated++;
      const providedAsMm2 = totalRebarArea(barDiameterMm, barCount);

      const input: RcBeamDesignInput = {
        elementLabel: base.elementLabel,
        spanMm: base.spanMm,
        widthMm: base.widthMm,
        totalDepthMm: base.totalDepthMm,
        effectiveCoverMm: base.effectiveCoverMm,
        clearCoverMm: base.clearCoverMm,
        fcMPa: base.fcMPa,
        fyMPa: base.fyMPa,
        stirrupDiameterMm: base.stirrupDiameterMm,
        supportCondition: base.supportCondition,
        factoredMomentKNm: base.factoredMomentKNm,
        factoredShearKN: base.factoredShearKN,
        providedAsMm2,
      };
      const report = runRcBeamDesign(input);
      const feasible = report.overallStatus !== "error";
      if (feasible) feasibleCount++;

      const candidate: SectionOptimizationCandidate = {
        description: `${barCount}-${barDiameterMm}mm bars`,
        variableValues: { barDiameterMm, barCount, providedAsMm2 },
        quantityMetric: providedAsMm2,
        quantityLabel: "mm² (tension steel area)",
        feasible,
        overallStatus: report.overallStatus,
        failureReasons: feasible ? [] : report.allWarnings,
      };

      if (feasible && (!best || providedAsMm2 < best.quantityMetric)) {
        best = candidate;
        bestReport = report;
      }
    }
  }

  return {
    implemented: true,
    sectionType: "rc-beam",
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি bar-size×count candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন rebar area: ${best.description} (As = ${best.quantityMetric.toFixed(0)} mm²)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — bar count range বাড়িয়ে বা beam depth/width বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// RC Column — sweep bar diameter × bar count (total longitudinal steel);
// width/depth/length/load demand fixed।
// ---------------------------------------------------------------------------
export interface RcColumnOptimizationBase {
  elementLabel: string;
  widthMm: number;
  totalDepthMm: number;
  unsupportedLengthMm: number;
  effectiveLengthFactor: number;
  isSwayFrame: boolean;
  coverToBarCentroidMm: number;
  fcMPa: number;
  fyMPa: number;
  tieDiameterMm: number;
  factoredAxialLoadKN: number;
  m1KNm: number;
  m2KNm: number;
  isSingleCurvature: boolean;
  criticalBucklingLoadKN: number;
  barDiameterOptionsMm?: number[];
  minBarCount?: number; // ডিফল্ট ৪
  maxBarCount?: number; // ডিফল্ট ১৬
}

function optimizeRcColumn(base: RcColumnOptimizationBase): SectionOptimizationResult {
  const barDiameters = base.barDiameterOptionsMm ?? REBAR_SIZES.map((r) => r.diameterMm);
  const minCount = base.minBarCount ?? 4;
  const maxCount = base.maxBarCount ?? 16;

  let best: SectionOptimizationCandidate | null = null;
  let bestReport: RcColumnDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const barDiameterMm of barDiameters) {
    for (let barCount = minCount; barCount <= maxCount; barCount++) {
      evaluated++;
      const totalAsMm2 = totalRebarArea(barDiameterMm, barCount);

      const input: RcColumnDesignInput = {
        elementLabel: base.elementLabel,
        widthMm: base.widthMm,
        totalDepthMm: base.totalDepthMm,
        unsupportedLengthMm: base.unsupportedLengthMm,
        effectiveLengthFactor: base.effectiveLengthFactor,
        isSwayFrame: base.isSwayFrame,
        coverToBarCentroidMm: base.coverToBarCentroidMm,
        fcMPa: base.fcMPa,
        fyMPa: base.fyMPa,
        totalAsMm2,
        longitudinalBarDiameterMm: barDiameterMm,
        tieDiameterMm: base.tieDiameterMm,
        factoredAxialLoadKN: base.factoredAxialLoadKN,
        m1KNm: base.m1KNm,
        m2KNm: base.m2KNm,
        isSingleCurvature: base.isSingleCurvature,
        criticalBucklingLoadKN: base.criticalBucklingLoadKN,
      };
      const report = runRcColumnDesign(input);
      const feasible = report.overallStatus !== "error";
      if (feasible) feasibleCount++;

      const candidate: SectionOptimizationCandidate = {
        description: `${barCount}-${barDiameterMm}mm bars`,
        variableValues: { barDiameterMm, barCount, totalAsMm2 },
        quantityMetric: totalAsMm2,
        quantityLabel: "mm² (longitudinal steel area)",
        feasible,
        overallStatus: report.overallStatus,
        failureReasons: feasible ? [] : report.allWarnings,
      };

      if (feasible && (!best || totalAsMm2 < best.quantityMetric)) {
        best = candidate;
        bestReport = report;
      }
    }
  }

  return {
    implemented: true,
    sectionType: "rc-column",
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি bar-size×count candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন longitudinal steel: ${best.description} (As = ${best.quantityMetric.toFixed(0)} mm²)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — bar count range বা column dimension বাড়িয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Steel Beam — sweep W-shape catalog; unbraced length/demand fixed।
// ---------------------------------------------------------------------------
export interface SteelBeamOptimizationBase {
  elementLabel: string;
  fyMPa: number;
  esMPa: number;
  unbracedLengthMm: number;
  cb?: number;
  factoredMomentKNm: number;
  factoredShearKN: number;
  catalog?: CatalogWShape[]; // না দিলে STEEL_W_SHAPE_CATALOG পুরোটা ব্যবহৃত হবে
}

function optimizeSteelBeam(base: SteelBeamOptimizationBase): SectionOptimizationResult {
  const catalog = base.catalog ?? STEEL_W_SHAPE_CATALOG;

  let best: SectionOptimizationCandidate | null = null;
  let bestReport: SteelBeamDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const shape of catalog) {
    evaluated++;
    const section = toWShapeSection(shape);
    const properties = computeSteelWShapeDesignProperties(section);

    const input: SteelBeamDesignInput = {
      elementLabel: base.elementLabel,
      section,
      fyMPa: base.fyMPa,
      esMPa: base.esMPa,
      unbracedLengthMm: base.unbracedLengthMm,
      cb: base.cb,
      factoredMomentKNm: base.factoredMomentKNm,
      factoredShearKN: base.factoredShearKN,
    };
    const report = runSteelBeamDesign(input);
    const feasible = report.overallStatus !== "error";
    if (feasible) feasibleCount++;

    const candidate: SectionOptimizationCandidate = {
      description: shape.designation,
      variableValues: { designation: shape.designation, areaMm2: properties.areaMm2 },
      quantityMetric: properties.areaMm2,
      quantityLabel: "mm² (cross-section area, self-weight proxy)",
      feasible,
      overallStatus: report.overallStatus,
      failureReasons: feasible ? [] : report.allWarnings,
    };

    if (feasible && (!best || properties.areaMm2 < best.quantityMetric)) {
      best = candidate;
      bestReport = report;
    }
  }

  return {
    implemented: true,
    sectionType: "steel-beam",
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি W-shape candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন section area: ${best.description} (A = ${best.quantityMetric.toFixed(0)} mm²)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — catalog range বাড়িয়ে বা unbraced length কমিয়ে আবার চেষ্টা করুন।`,
  };
}

// ---------------------------------------------------------------------------
// Steel Column — sweep W-shape catalog; unbraced length/demand fixed।
// ---------------------------------------------------------------------------
export interface SteelColumnOptimizationBase {
  elementLabel: string;
  fyMPa: number;
  esMPa: number;
  unbracedLengthMm: number;
  cb?: number;
  factoredAxialLoadKN: number;
  factoredMomentKNm: number;
  catalog?: CatalogWShape[];
}

function optimizeSteelColumn(base: SteelColumnOptimizationBase): SectionOptimizationResult {
  const catalog = base.catalog ?? STEEL_W_SHAPE_CATALOG;

  let best: SectionOptimizationCandidate | null = null;
  let bestReport: SteelColumnDesignReport | null = null;
  let feasibleCount = 0;
  let evaluated = 0;

  for (const shape of catalog) {
    evaluated++;
    const section = toWShapeSection(shape);
    const properties = computeSteelWShapeDesignProperties(section);

    const input: SteelColumnDesignInput = {
      elementLabel: base.elementLabel,
      section,
      fyMPa: base.fyMPa,
      esMPa: base.esMPa,
      unbracedLengthMm: base.unbracedLengthMm,
      cb: base.cb,
      factoredAxialLoadKN: base.factoredAxialLoadKN,
      factoredMomentKNm: base.factoredMomentKNm,
    };
    const report = runSteelColumnDesign(input);
    const feasible = report.overallStatus !== "error";
    if (feasible) feasibleCount++;

    const candidate: SectionOptimizationCandidate = {
      description: shape.designation,
      variableValues: { designation: shape.designation, areaMm2: properties.areaMm2 },
      quantityMetric: properties.areaMm2,
      quantityLabel: "mm² (cross-section area, self-weight proxy)",
      feasible,
      overallStatus: report.overallStatus,
      failureReasons: feasible ? [] : report.allWarnings,
    };

    if (feasible && (!best || properties.areaMm2 < best.quantityMetric)) {
      best = candidate;
      bestReport = report;
    }
  }

  return {
    implemented: true,
    sectionType: "steel-column",
    candidatesEvaluated: evaluated,
    feasibleCandidatesFound: feasibleCount,
    best,
    bestReport,
    message: best
      ? `${evaluated}টি W-shape candidate পরীক্ষা করা হয়েছে, ${feasibleCount}টি feasible। সর্বনিম্ন section area: ${best.description} (A = ${best.quantityMetric.toFixed(0)} mm²)।`
      : `${evaluated}টি candidate-এর একটাও feasible হয়নি — catalog range বাড়িয়ে বা unbraced length কমিয়ে আবার চেষ্টা করুন।`,
  };
}

export function runSectionOptimization(
  sectionType: SectionType,
  base: RcBeamOptimizationBase | RcColumnOptimizationBase | SteelBeamOptimizationBase | SteelColumnOptimizationBase
): SectionOptimizationResult {
  switch (sectionType) {
    case "rc-beam":
      return optimizeRcBeam(base as RcBeamOptimizationBase);
    case "rc-column":
      return optimizeRcColumn(base as RcColumnOptimizationBase);
    case "steel-beam":
      return optimizeSteelBeam(base as SteelBeamOptimizationBase);
    case "steel-column":
      return optimizeSteelColumn(base as SteelColumnOptimizationBase);
  }
}
