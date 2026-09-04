/**
 * deriveAreaSelfWeightLoads.ts — Slab/Wall/Shear-Wall/Core-Wall/Parapet/
 * Stair-Landing এর geometry ও material থেকে স্বয়ংক্রিয়ভাবে self-weight
 * (uniform-area dead load) বের করে।
 * ------------------------------------------------------------------
 * deriveSelfWeightLoads.ts (Beam/Column) এর ঠিক পাশের gap পূরণ করে —
 * সেই ফাইলের নিজস্ব কমেন্টেই স্বীকার করা ছিল "Slab/Wall self-weight
 * এখানে নেই ... future Phase এ যোগ হতে পারে"। এই ফাইল সেই future
 * Phase।
 *
 * পদ্ধতি (deriveLiveLoadCases.ts এর ঠিক একই প্যাটার্ন অনুসরণ করে,
 * শুধু live value এর বদলে material.unitWeight × thickness):
 *
 *   intensity = -(thickness_m × unitWeight_kNm3) × selfWeightMultiplier
 *
 * ঋণাত্মক, কারণ gravity load (deriveSelfWeightLoads.ts/deriveLiveLoadCases.ts
 * এর একই Y-অক্ষ কনভেনশন)।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - Slab/Wall/Shear-Wall/Core-Wall/Parapet/Stair-Landing — এই ছয়টাই
 *     AreaElement (vertices+thickness), তাই একই derivation logic
 *     প্রযোজ্য। Stair (waist-slab flight, landing না) ইচ্ছাকৃতভাবে বাদ —
 *     StairElement ও AreaElement হলেও এটা inclined geometry (flat plan
 *     area না) — সেই gap deriveStairSelfWeightLoads.ts দিয়ে পূরণ হয়েছে
 *     (waist-slab true inclined area, Newell's method + ধাপের
 *     triangular extra weight)। Stair-Landing (LandingElement, ২০২৬-০৮
 *     গ্যাপ-ক্লোজিং পাস এ যোগ) আলাদা — এটা flat/horizontal (mid-run
 *     platform, ঢালু না), তাই এখানে Slab-এর মতোই সরাসরি ধরা হয়েছে,
 *     আলাদা ফাংশনের দরকার হয়নি।
 *   - Wall/Shear-Wall/Core-Wall/Parapet এর জন্যও এই ফাংশন plan-polygon
 *     area (computePolygonPlanArea) ব্যবহার করে, ঠিক Slab-এর মতোই। এটা
 *     ইচ্ছাকৃত সরলীকরণ: এই codebase-এ AreaElement সব সময় একটা
 *     vertices+thickness polygon হিসেবেই সংজ্ঞায়িত (element.ts),
 *     vertical/horizontal orientation ভিন্ন করে model করা হয়নি — তাই
 *     "plan area" ধরে নেওয়া Slab ও Wall/Parapet উভয়ের জন্যই একই ফাংশন
 *     সঠিকভাবে কাজ করে (Wall/Parapet-এর ক্ষেত্রে এই "plan area" আসলে
 *     elevation-এ থাকা surface area, কিন্তু গাণিতিকভাবে
 *     computePolygonPlanArea সেই একই vertices polygon area হিসাব করে,
 *     orientation নির্বিশেষে)। Parapet-এর vertices mapParapet()
 *     (hub-geometry-parser.ts) থেকেই Wall-এর ঠিক একই rectangular-plane
 *     আকারে আসে (base+elevation থেকে height পর্যন্ত), তাই এখানে কোনো
 *     বাড়তি বিশেষ-ব্যবস্থার দরকার হয়নি।
 *   - Composite/Prestressed/Cold-Formed material এর জন্য effectiveUnitWeight
 *     ব্যবহার (deriveSelfWeightLoads.ts এর সাথে সঙ্গতিপূর্ণ)।
 *
 * ⚠️ নোট (Miftahul, 2026-09-04 — Hub payload-size split, hub-write.ts/
 * hub-geometry-parser.ts এর সংশ্লিষ্ট নোট দেখুন): এই ফাংশনের category
 * "wall" branch এখনো বৈধ ও অপরিবর্তিত — এটা শুধু Hub import path
 * এর জন্য বন্ধ হয়েছে (ordinary wall Hub থেকে আর WallElement হয়ে
 * আসে না)। কেউ যদি এই App-এ সরাসরি (Hub ছাড়া) একটা Wall/category
 * "wall" element মডেল করেন, সেটা এখনো এই ফাংশন দিয়েই স্বাভাবিকভাবে
 * self-weight পাবে। Hub-imported ordinary wall-এর self-weight এখন
 * আলাদা পথে আসে — deriveWallLineLoadFromSelfWeight.ts, যেটা beam/
 * slab-এর case-এর intensity-তে সরাসরি merge হয় (useAutoLoadSync.ts)।
 */

import type { StructuralElement, SlabElement, WallElement, ShearWallElement, CoreWallElement, ParapetElement, LandingElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { UniformAreaLoadCase } from "@/lib/types/load";
import { createUniformAreaLoad } from "@/lib/types/load";

const AREA_SELF_WEIGHT_SUPPORTED_CATEGORIES = new Set(["slab", "wall", "shear-wall", "core-wall", "parapet", "stair-landing"]);

export interface DeriveAreaSelfWeightLoadsResult {
  loadCases: UniformAreaLoadCase[];
  skipped: { elementId: string; label: string; reason: string }[];
  warnings: string[];
}

/**
 * সব Slab/Wall/Shear-Wall/Core-Wall element-এর জন্য self-weight
 * uniform-area load তৈরি করে।
 *
 * @param deadPatternId - যে LoadPattern-এ এই load case গুলো যুক্ত হবে (category "dead" হওয়া উচিত, caller নিশ্চিত করবে)
 * @param selfWeightMultiplier - LoadPattern থেকে (সাধারণত 1.0), না দিলে 1.0 ধরা হয়
 */
export function deriveAreaSelfWeightLoads(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  deadPatternId: string,
  selfWeightMultiplier = 1.0
): DeriveAreaSelfWeightLoadsResult {
  const loadCases: UniformAreaLoadCase[] = [];
  const skipped: DeriveAreaSelfWeightLoadsResult["skipped"] = [];
  const warnings: string[] = [];

  const areaElements = elements.filter(
    (e): e is SlabElement | WallElement | ShearWallElement | CoreWallElement | ParapetElement | LandingElement =>
      AREA_SELF_WEIGHT_SUPPORTED_CATEGORIES.has(e.category)
  );

  const stairCount = elements.filter((e) => e.category === "stair").length;
  if (stairCount > 0) {
    warnings.push(
      `${stairCount}টা Stair element এখানে বাদ পড়েছে — deriveStairSelfWeightLoads() দিয়ে আলাদাভাবে এদের self-weight (waist slab + step) হিসাব করুন, সাধারণ flat-area formula (এই ফাংশন) দিয়ে সঠিক হবে না।`
    );
  }

  for (const element of areaElements) {
    const material = materials.find((m) => m.materialId === element.materialId);
    if (!material) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: `materialId "${element.materialId}" পাওয়া যায়নি material library তে।` });
      continue;
    }

    const areaM2 = computePolygonPlanArea(element.vertices);
    if (areaM2 <= 0) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: "Plan area শূন্য বা অবৈধ (কমপক্ষে ৩টা বৈধ vertex দরকার)।" });
      continue;
    }

    // CompositeMaterial এর জন্য effectiveUnitWeight — deriveSelfWeightLoads.ts এর সাথে সঙ্গতিপূর্ণ নামকরণ পার্থক্য।
    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;

    const thicknessM = element.thickness / 1000; // mm → m
    const intensity = -(thicknessM * unitWeight * selfWeightMultiplier); // kN/m², gravity direction negative

    loadCases.push(
      createUniformAreaLoad({
        patternId: deadPatternId,
        elementId: element.elementId,
        intensity,
        source: "auto",
      })
    );
  }

  if (skipped.length > 0) {
    warnings.push(`${skipped.length}টা Slab/Wall/Parapet/Stair-Landing element self-weight auto-generation এ বাদ পড়েছে — নিচে elementId/কারণ দেখুন, প্রয়োজনে ম্যানুয়ালি যোগ করুন।`);
  }

  return { loadCases, skipped, warnings };
}
