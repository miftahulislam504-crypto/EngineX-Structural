/**
 * deriveStairSelfWeightLoads.ts — Stair (waist-slab) element-এর
 * geometry ও material থেকে self-weight (uniform-area dead load) বের
 * করে।
 * ------------------------------------------------------------------
 * deriveAreaSelfWeightLoads.ts (Slab/Wall/Shear-Wall/Core-Wall/Parapet)
 * এর নিজস্ব কমেন্টেই এই gap স্বীকার করা ছিল: "Stair ইচ্ছাকৃতভাবে বাদ
 * ... stair-এর নিজস্ব dedicated self-weight derivation stair design
 * module-এর অংশ হিসেবে আসা উচিত"। এই ফাইল সেই মডিউল।
 *
 * কেন আলাদা ফাইল, deriveAreaSelfWeightLoads.ts-এ যোগ না করে:
 *   (1) Waist-slab area — StairElement.vertices ইনক্লাইন্ড (bottom
 *       edge এক elevation-এ, top edge আরেক elevation-এ), তাই
 *       computePolygonPlanArea() (XZ-শুধু shoelace) ভুল ফল দেয় — সেই
 *       একই বাগ যা modelChecker.ts-এর zero-area check-এ Wall-এর জন্য
 *       ধরা পড়েছিল। এখানে computePolygonAreaAnyPlane() (Newell's
 *       method, @/lib/types/element) ব্যবহার করা হয়েছে যা যেকোনো
 *       সমতলের polygon-এর সঠিক 3D surface area দেয়।
 *   (2) ধাপ (step)-এর triangular অতিরিক্ত ওজন — waist slab-এর উপরে
 *       সিঁড়ির ধাপগুলো একটা করাত-দাঁতের (sawtooth) মতো ত্রিভুজাকার
 *       অতিরিক্ত কংক্রিট যোগ করে, যা flat-area formula ধরে না। এই
 *       ফাইল riser/going থেকে সেই triangular ওজন হিসাব করে waist-slab
 *       weight-এর সাথে যোগ করে (নিচে deriveStairStepWeightIncrement()
 *       দেখুন)।
 *
 * সীমাবদ্ধতা (honestly documented, deriveAreaSelfWeightLoads.ts-এর
 * ঠিক একই ঐতিহ্য অনুসরণ করে):
 *   - StairElement-এ numberOfSteps/going আলাদাভাবে সংরক্ষিত না
 *     (hub-geometry-parser.ts-এর mapStair() শুধু vertices+thickness
 *     পাঠায়, Draw-এর raw flight geometry থেকে) — riser height
 *     (element.riserHeightM, ২০২৬-০৮ যোগ হলো) ইঞ্জিনিয়ারকে Stair
 *     Design panel থেকে বসাতে হয় (ঠিক যেমন RcSlabDesignPanel-এ span
 *     ইঞ্জিনিয়ার নিজে দেন, কারণ FE moment recovery নেই)। undefined
 *     থাকা element-এ শুধু flat waist-slab weight ধরা হয়, per-element
 *     warning সহ।
 *   - Landing স্ল্যাব এই ফাংশনের স্কোপে নেই — hub-geometry-parser.ts-এর
 *     mapStair() comment অনুযায়ী landing এই মুহূর্তে কোনো element
 *     হিসেবেই import হয় না (শুধু raw flights[]), তাই landing-এর
 *     self-weight এখানে বা অন্য কোথাও ধরার মতো কোনো element নেই। এটা
 *     stair design module-এর একটা পরিচিত, পরবর্তী ধাপের কাজ হিসেবে
 *     থেকে যাচ্ছে (Draw থেকে landing geometry export করা শুরু হলে)।
 *   - Waist-slab thickness সবসময় DEFAULT_STAIR_WAIST_THICKNESS_M
 *     (150mm) থেকে আসে import review পর্যন্ত (hub-geometry-parser.ts) —
 *     এই ফাইল element.thickness যা-ই থাকুক তাই ব্যবহার করে, ধরে নেয়
 *     ইঞ্জিনিয়ার প্রয়োজনে review-তে ঠিক করে নিয়েছেন।
 */

import type { StairElement, StructuralElement } from "@/lib/types/element";
import { computePolygonAreaAnyPlane } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { UniformAreaLoadCase } from "@/lib/types/load";
import { createUniformAreaLoad } from "@/lib/types/load";

export interface DeriveStairSelfWeightLoadsResult {
  loadCases: UniformAreaLoadCase[];
  skipped: { elementId: string; label: string; reason: string }[];
  warnings: string[];
}

/**
 * একটা stair flight-এর ধাপগুলোর triangular অতিরিক্ত ওজন, waist-slab
 * নিজস্ব ওজনের উপর একটা per-m² (inclined surface area অনুযায়ী)
 * increment হিসেবে।
 *
 * পদ্ধতি: প্রতিটা ধাপ একটা সমকোণী ত্রিভুজ যোগ করে waist slab-এর উপরে
 * (riser height × going, অর্ধেক — step-এর উপরের ত্রিভুজাকার অংশ,
 * নিচেরটা waist slab-এর নিজস্ব thickness-এর মধ্যেই ধরা)। এই triangular
 * cross-section area কে ধাপের horizontal going দিয়ে ভাগ করলে একটা
 * "সমতুল্য অতিরিক্ত পুরুত্ব" (equivalent extra thickness) পাওয়া যায়,
 * যা পুরো slope length জুড়ে uniform ধরা যায় (ধাপ সংখ্যা যা-ই হোক, এই
 * equivalent thickness ধাপ সংখ্যার উপর নির্ভর করে না — শুধু riser ও
 * going-এর অনুপাতের উপর, কারণ প্রতিটা ধাপের নিজস্ব going-ও ছোট হয়ে
 * যায় ধাপ বেশি হলে, দুটো effect বাতিল হয়ে যায়):
 *
 *   equivalentExtraThicknessM = riserHeightM / 2
 *
 * (স্ট্যান্ডার্ড স্টেয়ার-ডিজাইন সরলীকরণ — waist slab-এর inclined slope
 * length বরাবর ধাপগুলোর গড় অতিরিক্ত ওজন riser height-এর অর্ধেকের
 * সমতুল্য একটা flat slab পুরুত্ব বৃদ্ধির সমান, going-নির্বিশেষে,
 * যতক্ষণ সব ধাপ সমান riser/going হয়)।
 */
export function deriveStairStepWeightIncrement(riserHeightM: number, unitWeightKNm3: number): number {
  if (!Number.isFinite(riserHeightM) || riserHeightM <= 0) return 0;
  const equivalentExtraThicknessM = riserHeightM / 2;
  return equivalentExtraThicknessM * unitWeightKNm3; // kN/m², inclined surface area-র উপর uniform
}

/**
 * সব StairElement-এর জন্য self-weight uniform-area load তৈরি করে
 * (waist slab flat weight + ধাপের triangular extra weight,
 * element.riserHeightM দেওয়া থাকলে — প্রতিটা flight-এর নিজস্ব riser
 * ভিন্ন হতে পারে, তাই এটা প্রতি-element property, একটা shared option
 * না)।
 *
 * @param deadPatternId - যে LoadPattern-এ এই load case গুলো যুক্ত হবে (category "dead" হওয়া উচিত, caller নিশ্চিত করবে)
 * @param selfWeightMultiplier - LoadPattern থেকে (সাধারণত 1.0), না দিলে 1.0 ধরা হয়
 */
export function deriveStairSelfWeightLoads(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  deadPatternId: string,
  selfWeightMultiplier = 1.0,
): DeriveStairSelfWeightLoadsResult {
  const loadCases: UniformAreaLoadCase[] = [];
  const skipped: DeriveStairSelfWeightLoadsResult["skipped"] = [];
  const warnings: string[] = [];

  const stairElements = elements.filter((e): e is StairElement => e.category === "stair");

  if (stairElements.length === 0) {
    return { loadCases, skipped, warnings };
  }

  const missingRiserCount = stairElements.filter((e) => e.riserHeightM === undefined).length;
  if (missingRiserCount > 0) {
    warnings.push(
      `${missingRiserCount}টা Stair element-এ riser height দেওয়া নেই — শুধু waist-slab flat self-weight ধরা হয়েছে, ধাপের triangular অতিরিক্ত ওজন (সাধারণত ১৫-২৫% বেশি) বাদ পড়েছে। Stair Design panel-এ riser height বসালে এই হিসাব সম্পূর্ণ হবে।`,
    );
  }

  for (const element of stairElements) {
    const material = materials.find((m) => m.materialId === element.materialId);
    if (!material) {
      skipped.push({
        elementId: element.elementId,
        label: element.label,
        reason: `materialId "${element.materialId}" পাওয়া যায়নি material library তে।`,
      });
      continue;
    }

    const inclinedAreaM2 = computePolygonAreaAnyPlane(element.vertices);
    if (inclinedAreaM2 <= 0) {
      skipped.push({
        elementId: element.elementId,
        label: element.label,
        reason: "Waist-slab surface area শূন্য বা অবৈধ (কমপক্ষে ৩টা বৈধ vertex দরকার)।",
      });
      continue;
    }

    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;
    const thicknessM = element.thickness / 1000; // mm → m

    const flatWeightPerM2 = thicknessM * unitWeight; // waist slab, ধাপ ছাড়া
    const stepWeightIncrementPerM2 =
      element.riserHeightM !== undefined ? deriveStairStepWeightIncrement(element.riserHeightM, unitWeight) : 0;

    const intensity = -(flatWeightPerM2 + stepWeightIncrementPerM2) * selfWeightMultiplier; // kN/m², gravity direction negative

    loadCases.push(
      createUniformAreaLoad({
        patternId: deadPatternId,
        elementId: element.elementId,
        intensity,
        source: "auto",
      }),
    );
  }

  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length}টা Stair element self-weight auto-generation এ বাদ পড়েছে — নিচে elementId/কারণ দেখুন, প্রয়োজনে ম্যানুয়ালি যোগ করুন।`,
    );
  }

  return { loadCases, skipped, warnings };
}
