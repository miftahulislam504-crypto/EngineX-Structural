/**
 * deriveAreaSelfWeightLoads.ts — Slab/Wall/Shear-Wall/Core-Wall এর
 * geometry ও material থেকে স্বয়ংক্রিয়ভাবে self-weight (uniform-area
 * dead load) বের করে।
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
 *   - Slab/Wall/Shear-Wall/Core-Wall/Parapet — এই পাঁচটাই AreaElement
 *     (vertices+thickness), তাই একই derivation logic প্রযোজ্য। Stair
 *     ইচ্ছাকৃতভাবে বাদ — StairElement ও AreaElement হলেও এটা inclined
 *     waist-slab geometry (flat plan area না), এবং stair-এর নিজস্ব
 *     dedicated self-weight derivation stair design module-এর অংশ
 *     হিসেবে আসা উচিত (waist slab thickness + landing slab + step-এর
 *     triangular extra weight — সাধারণ flat-area formula দিয়ে সঠিক
 *     হবে না)।
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
 */

import type { StructuralElement, SlabElement, WallElement, ShearWallElement, CoreWallElement, ParapetElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { UniformAreaLoadCase } from "@/lib/types/load";
import { createUniformAreaLoad } from "@/lib/types/load";

const AREA_SELF_WEIGHT_SUPPORTED_CATEGORIES = new Set(["slab", "wall", "shear-wall", "core-wall", "parapet"]);

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
    (e): e is SlabElement | WallElement | ShearWallElement | CoreWallElement =>
      AREA_SELF_WEIGHT_SUPPORTED_CATEGORIES.has(e.category)
  );

  const stairCount = elements.filter((e) => e.category === "stair").length;
  if (stairCount > 0) {
    warnings.push(
      `${stairCount}টা Stair element self-weight auto-generation এ বাদ পড়েছে — stair-এর self-weight stair design module (waist slab + landing) থেকে আলাদাভাবে আসা উচিত, সাধারণ flat-area formula দিয়ে সঠিক হবে না।`
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
    warnings.push(`${skipped.length}টা Slab/Wall element self-weight auto-generation এ বাদ পড়েছে — নিচে elementId/কারণ দেখুন, প্রয়োজনে ম্যানুয়ালি যোগ করুন।`);
  }

  return { loadCases, skipped, warnings };
}
