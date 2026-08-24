/**
 * Calc Sheet Detail Types — Phase 11e
 *
 * DesignResult.detail (design/firestore.ts) ইচ্ছাকৃতভাবে
 * Record<string, unknown> — কারণ persist হওয়া উচিত ঠিক সেই আসল
 * design engine input+output জোড়া, কিন্তু element-category অনুযায়ী
 * শেপ ভিন্ন বলে একটা কমন Firestore field টাইপ করা যায় না।
 *
 * গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত (Phase 11e তে ধরা পড়েছে, এই ফাইলেই
 * ঠিক করা হলো): RcBeamDesignReport/RcColumnDesignReport/RcSlabDesignReport/
 * FootingDesignReport — এই চারটা রিপোর্ট টাইপ শুধু আউটপুট রাখে (As
 * required, utilization ratio, ইত্যাদি), ইনপুট (span, Mu, Vu, fc, fy)
 * প্রতিধ্বনিত করে না। কিন্তু Calc Sheet এর "A. Input Data" সেকশন
 * (প্লানের চাহিদা) কে ঠিক সেই ইনপুট মানগুলো দেখাতে হবে। StructuralElement
 * (elementId দিয়ে) থেকে জ্যামিতি/ম্যাটেরিয়াল ফিরে পাওয়া যায়, কিন্তু
 * factoredMomentKNm/factoredShearKN/Pu — এগুলো কোনো element field না,
 * এগুলো নির্দিষ্ট load combination এর বিপরীতে চালানো design check এর
 * ইনপুট, যা elementId থেকে reconstruct করা অসম্ভব।
 *
 * তাই detail এর প্রত্যাশিত শেপ হলো `{ input: <RcXDesignInput>, report:
 * <RcXDesignReport> }` — persistDesignResult() (design/firestore.ts,
 * এখনো কোনো design panel থেকে কল হয় না, Phase 11a এর নোট করা gap)
 * যখন বাস্তবে wire হবে, তখন design panel কে অবশ্যই এই { input, report }
 * জোড়া detail এ বসাতে হবে — শুধু report রাখলে Calc Sheet এর Input
 * Data সেকশন অসম্পূর্ণ থাকবে।
 */

import type { RcBeamDesignInput, RcBeamDesignReport } from "@/lib/design/rcBeamDesign";
import type { RcColumnDesignInput, RcColumnDesignReport } from "@/lib/design/rcColumnDesign";
import type { RcSlabDesignInput, RcSlabDesignReport } from "@/lib/design/rcSlabDesign";
import type { FootingDesignInput, FootingDesignReport } from "@/lib/design/footingDesign";
import type { RcWallDesignInput, RcWallDesignReport } from "@/lib/design/rcWallDesign";
import type { StairDesignInput, StairDesignReport } from "@/lib/design/stairDesign";

function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((k) => k in value);
}

export interface BeamCalcDetail {
  input: RcBeamDesignInput;
  report: RcBeamDesignReport;
}
export interface ColumnCalcDetail {
  input: RcColumnDesignInput;
  report: RcColumnDesignReport;
}
export interface SlabCalcDetail {
  input: RcSlabDesignInput;
  report: RcSlabDesignReport;
}
export interface FootingCalcDetail {
  input: FootingDesignInput;
  report: FootingDesignReport;
}

/** detail যদি আসলে { input, report } আকারে একটা BeamCalcDetail হয়ে থাকে, টাইপ-সেফভাবে ফেরত দেয় — নাহলে null। */
export function asBeamDetail(detail: Record<string, unknown>): BeamCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["flexure", "shear", "deflection", "overallStatus"])
    ? (detail as unknown as BeamCalcDetail)
    : null;
}

export function asColumnDetail(detail: Record<string, unknown>): ColumnCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["slenderness", "interactionDiagram", "adequacy", "overallStatus"])
    ? (detail as unknown as ColumnCalcDetail)
    : null;
}

export function asSlabDetail(detail: Record<string, unknown>): SlabCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["moments", "flexuralDesign", "minThickness", "overallStatus"])
    ? (detail as unknown as SlabCalcDetail)
    : null;
}

export function asFootingDetail(detail: Record<string, unknown>): FootingCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["sizing", "momentX", "momentZ", "punchingShear", "overallStatus"])
    ? (detail as unknown as FootingCalcDetail)
    : null;
}

export interface WallCalcDetail {
  input: RcWallDesignInput;
  report: RcWallDesignReport;
}

/** Report-Audit Phase B1 (2026-08-20) — WallCalcSheet.tsx এর জন্য, Slab/Footing এর একই { input, report } persist প্যাটার্ন। */
export function asWallDetail(detail: Record<string, unknown>): WallCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["axialCapacity", "minReinforcement", "shearCapacity", "overallStatus"])
    ? (detail as unknown as WallCalcDetail)
    : null;
}

export interface StairCalcDetail {
  input: StairDesignInput;
  report: StairDesignReport;
}

/** Stair implementation Phase 4 (২০২৬-০৮) — StairDesignPanel.tsx এর { input, report } persist প্যাটার্ন, S-18 sheet এর schedule টেবিলে input.effectiveCoverMm/factoredLoadKPa দেখাতে লাগে। */
export function asStairDetail(detail: Record<string, unknown>): StairCalcDetail | null {
  if (!hasKeys(detail, ["input", "report"])) return null;
  const report = detail.report as Record<string, unknown>;
  return hasKeys(report, ["geometry", "moments", "flexuralDesign", "minThickness", "overallStatus"])
    ? (detail as unknown as StairCalcDetail)
    : null;
}
