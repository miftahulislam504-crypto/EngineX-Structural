/**
 * slabRebarOverlay.ts — Report-Audit Phase B7 (2026-08-20)
 *
 * S-10/S-11/S-15/S-16 (Typical/Roof Floor Slab Reinf. Layout Plan,
 * E-W/N-S) — চারটা শীটই একই লজিক দরকার: প্রতিটা slab element-এর জন্য
 * তার design result (RcSlabDesignReport, যদি চালানো হয়ে থাকে) থেকে
 * generateSlabDetailing() দিয়ে bottom mesh bar generate করে, শুধু
 * একটা direction-এর bars (mesh-x বা mesh-y) বের করে দেওয়া — বাকি সব
 * (outline drawing, grid overlay) SlabOutlineSketch.tsx এ common।
 *
 * design result না থাকা slab (design না চালানো) — honestly বাদ যায়
 * (undefined entry, ফলে SlabOutlineSketch শুধু outline দেখাবে সেই
 * slab-এর জন্য, ভুল/অনুমাননির্ভর bar না বসিয়ে)।
 *
 * "E-W"/"N-S" নামকরণ কনভেনশন — এই কোডবেসে কোথাও true geographic
 * north-arrow/compass bearing input নেই (নতুন করে invent করা হয়নি,
 * SlabOutlineSketch.tsx এর docblock এও একই নোট) — বিদ্যমান sheet
 * title কনভেনশন অনুসরণ করে local X-axis বরাবর bar ("mesh-x" role) কে
 * "E-W", local Z-axis বরাবর bar ("mesh-y" role) কে "N-S" ধরা হয়েছে।
 *
 * শুধু bottom (positive-moment) layer overlay করা হয় — top/negative
 * bar একই sketch এ দেখালে plan-view readability নষ্ট হতো (দুই লেয়ার
 * superimposed), calc-sheets এ top/bottom দুটোই আলাদাভাবে detailed
 * আছে ইতিমধ্যে।
 *
 * Bar diameter — ইঞ্জিনিয়ার-নির্বাচিত (RcSlabDesignPanel এর
 * detailingBarDiameterMm ইনপুট), কিন্তু design result persist হওয়ার
 * সময় সেই choice DesignResult এ সংরক্ষিত হয় না (শুধু input/report,
 * detailingBarDiameterMm আলাদা persistDetailingResult() call এ যায়,
 * design-report এর ReportContext এ detailing results এখনো টানা হয়
 * না)। তাই এখানে একটা practical default (12mm, generateSlabDetailing
 * এর নিজস্ব docstring এ "ডিফল্ট 12mm" হিসেবে উল্লেখ) ব্যবহার করা হলো —
 * এটা visual bar-spacing overlay এর জন্য, ইঞ্জিনিয়ারের চূড়ান্ত bar
 * schedule সবসময় calc-sheets/BBS থেকে নিতে হবে, এই sketch থেকে না।
 */

import { generateSlabDetailing } from "@/lib/detailing/generateSlabDetailing";
import { asSlabDetail } from "@/lib/documentation/pdf/calc-sheets/detailTypes";
import type { RebarSegment } from "@/lib/detailing/types";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { StructuralElement } from "@/lib/types/element";

const DEFAULT_BAR_DIAMETER_MM = 12;

/**
 * elements এর মধ্যে category==="slab" গুলোর জন্য elementId → bottom-layer
 * bar segments (শুধু requestedRole) ম্যাপ বানায়। design result না থাকা
 * বা vertices/thickness resolve না হওয়া slab চুপচাপ বাদ যায় (map এ
 * entry থাকে না) — SlabOutlineSketch তখন honest fallback (outline
 * only) দেখাবে সেই slab-এর জন্য।
 */
export function buildSlabRebarOverlay(
  context: ReportContext,
  slabs: StructuralElement[],
  requestedRole: "mesh-x" | "mesh-y"
): Record<string, RebarSegment[]> {
  const overlay: Record<string, RebarSegment[]> = {};

  for (const el of slabs) {
    if (el.category !== "slab") continue;
    const designResult = context.designResults.find((d) => d.elementId === el.elementId);
    if (!designResult) continue;

    const detail = asSlabDetail(designResult.detail);
    if (!detail) continue;

    const vertices = (el as unknown as { vertices?: { x: number; y: number; z: number }[] }).vertices;
    const thickness = (el as unknown as { thickness?: number }).thickness;
    if (!vertices || vertices.length < 3 || !thickness) continue;

    const detailing = generateSlabDetailing({
      elementId: el.elementId,
      elementLabel: designResult.elementLabel,
      vertices,
      thicknessMm: thickness,
      effectiveCoverMm: detail.input.effectiveCoverMm,
      barDiameterMm: DEFAULT_BAR_DIAMETER_MM,
      report: detail.report,
    });

    // শুধু bottom layer (id এ "-bot-" থাকে, generateSlabDetailing.ts এর addMeshLayer layerTag কনভেনশন), শুধু requestedRole
    const bars = (detailing.meshBars ?? []).filter((b) => b.id.includes("-bot-") && b.role === requestedRole);
    if (bars.length > 0) overlay[el.elementId] = bars;
  }

  return overlay;
}
