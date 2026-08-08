/**
 * elementLabel helper — Phase 11h
 *
 * StructuralElement এ elementLabel field এই আপলোডে কোথাও কনফার্ম হয়নি
 * (শুধু elementId — SectionG_DesignSummary.tsx থেকে)। DetailingResult ও
 * DesignResult দুটোতেই elementLabel কনফার্ম আছে (projectBbs.ts,
 * BeamCalcSheet.tsx ইত্যাদি) — সেই দুই জায়গা থেকে elementId মিলিয়ে
 * label বের করা হয়, কোনোটাতেই না পেলে elementId নিজেই fallback হিসেবে
 * দেখানো হয়। এই একই লজিক ColumnLayoutPlanSheet/FootingLayoutPlanSheet/
 * GradeBeamLayoutPlanSheet/TypicalFloorBeamLayoutPlanSheet/
 * RoofFloorBeamLayoutPlanSheet — সবগুলোতে লাগে, তাই এখানে একবার।
 *
 * DetailingResult.elementId নিজেও এই আপলোডে সরাসরি কনফার্ম হয়নি (শুধু
 * elementLabel/category/schedule — detailing/firestore.ts docblock এ) —
 * তাই সেই lookup defensively `as unknown as {elementId?}` cast দিয়ে,
 * field না থাকলে চুপচাপ skip করে (crash না করে)।
 */

import type { ReportContext } from "@/lib/documentation/reportContext";

export function resolveElementLabel(context: ReportContext, elementId: string): string {
  const fromDetailing = context.detailingResults.find(
    (d) => (d as unknown as { elementId?: string }).elementId === elementId
  )?.elementLabel;
  if (fromDetailing) return fromDetailing;

  const fromDesign = context.designResults.find((r) => r.elementId === elementId)?.elementLabel;
  if (fromDesign) return fromDesign;

  return elementId;
}

export function findDetailingResult(context: ReportContext, elementId: string) {
  return context.detailingResults.find(
    (d) => (d as unknown as { elementId?: string }).elementId === elementId
  );
}
