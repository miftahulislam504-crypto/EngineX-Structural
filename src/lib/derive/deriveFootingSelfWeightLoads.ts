/**
 * deriveFootingSelfWeightLoads.ts — Footing/Pile-Cap/Mat-Foundation এর
 * geometry ও material থেকে স্বয়ংক্রিয়ভাবে self-weight (point dead load)
 * বের করে।
 * ------------------------------------------------------------------
 * ⚠️ গ্যাপ-ক্লোজিং পাস (Miftahul এর structural audit, 2026-08-25):
 * deriveAreaSelfWeightLoads.ts এর নিজস্ব AREA_SELF_WEIGHT_SUPPORTED_
 * CATEGORIES-এ footing কখনো ছিল না, আর deriveSelfWeightLoads.ts
 * (Beam/Column/Brace/Pile) এও ছিল না — ফলে useAutoLoadSync.ts এর পুরো
 * auto-load pipeline-এ Footing/Pile-Cap/Mat-Foundation-এর self-weight
 * কখনো derive হতো না, অথচ বাকি সব modeled element (Slab/Wall/Beam/
 * Column/Stair) এর হতো। এই ফাইল সেই gap পূরণ করে।
 *
 * কেন আলাদা ফাইল, deriveAreaSelfWeightLoads.ts এ যোগ না করে:
 *   - Footing/Pile-Cap AreaElement না (vertices নেই) — width/length/
 *     thickness/location দিয়ে সংজ্ঞায়িত (element.ts এর FootingElement/
 *     PileCapElement দেখুন), তাই computePolygonPlanArea() প্রযোজ্য না।
 *   - Mat-Foundation AreaElement (vertices+thickness), কিন্তু
 *     ফলাফল point load (পুরো mat-টা একটাই lump mass না, একটা single
 *     point-এ concentrate করাও যান্ত্রিকভাবে অর্থহীন) — তাই এটাকেও এখানে
 *     রাখা হলো, area-load pipeline-এ না মিশিয়ে, ফলাফল-টাইপের
 *     সামঞ্জস্যের জন্য।
 *   - ফলাফল PointLoadCase (applicationType: "point") — deriveSelfWeightLoads.ts
 *     এর uniform-line বা deriveAreaSelfWeightLoads.ts এর uniform-area
 *     কোনোটাই footing-এর geometry-র সাথে মেলে না। load.ts এর
 *     PointLoadCase-এর নিজস্ব ডকুমেন্টেই এই ব্যবহার আগে থেকে
 *     anticipated ছিল ("Footing এর মতো point element এ")।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - Footing/Pile-Cap — নিজস্ব width/length/thickness element property
 *     হিসেবে সংরক্ষিত, তাই volume = (width/1000)×(length/1000)×
 *     (thickness/1000) সরাসরি নির্ভরযোগ্য। এই একই সূত্র weightOptimization.ts
 *     (Estimate/BOQ takeoff) এ ইতিমধ্যে ব্যবহৃত — এখানে সেটাই পুনর্ব্যবহার
 *     করা হলো যাতে self-weight ও material takeoff কখনো ভিন্ন সংখ্যা না
 *     দেয়।
 *   - Mat-Foundation — AreaElement, computePolygonPlanArea() (element.ts)
 *     দিয়ে plan area বের করে volume = area × thickness।
 *   - Combined-Footing/Strip-Footing **ইচ্ছাকৃতভাবে বাদ** — এই দুই category-র
 *     plan dimension (width/length) element-এ সংরক্ষিত না, sizing
 *     calculation (combinedFootingSizing.ts/stripFootingSizing.ts) এর
 *     আউটপুট থেকে আসে যা এই App-এর নিজস্ব ডিজাইন workflow-এর অংশ, Hub
 *     import বা সাধারণ element creation-এ থাকে না। weightOptimization.ts
 *     এই একই কারণে এই দুই category-কে takeoff থেকে honestly exclude
 *     করে ("নির্ভরযোগ্যভাবে অনুমান করা যায় না") — এই ফাইলও সেই একই নীতি
 *     অনুসরণ করে, বরং ভুল/অনুমানভিত্তিক সংখ্যা তৈরির চেয়ে skipped তালিকায়
 *     স্পষ্ট কারণ সহ রাখা ভালো।
 *   - Composite/Prestressed/Cold-Formed material এর জন্য effectiveUnitWeight
 *     ব্যবহার (deriveSelfWeightLoads.ts/deriveAreaSelfWeightLoads.ts এর
 *     সাথে সঙ্গতিপূর্ণ)।
 *   - বিয়ারিং-ক্যাপাসিটি/soil-pressure এই ফাংশনের স্কোপে না — সেটা এই
 *     App-এর footingDesign.ts workflow-এর নিজস্ব কাজ (mapFooting()-এর
 *     "reference import" নোট, hub-geometry-parser.ts দেখুন)। এখানে শুধু
 *     analysis model-এ footing-এর নিজের ওজন (dead load contribution)
 *     যোগ হচ্ছে, ঠিক যেভাবে Beam/Column/Slab-এর নিজস্ব ওজন যোগ হয়।
 */

import type { StructuralElement, FootingElement, PileCapElement, MatFoundationElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { PointLoadCase } from "@/lib/types/load";
import { createPointLoad } from "@/lib/types/load";

const FOOTING_SELF_WEIGHT_SUPPORTED_CATEGORIES = new Set(["footing", "pile-cap", "mat-foundation"]);

export interface DeriveFootingSelfWeightLoadsResult {
  loadCases: PointLoadCase[];
  skipped: { elementId: string; label: string; reason: string }[];
  warnings: string[];
}

/**
 * সব Footing/Pile-Cap/Mat-Foundation element-এর জন্য self-weight
 * PointLoadCase তৈরি করে (positionRatio 0 — point element-এ ভগ্নাংশের
 * ধারণা প্রযোজ্য না, createPointLoad()-এর ডিফল্ট 0.5 এখানে override
 * করা হয়েছে যাতে ভুলবশত "midspan" অর্থ না বোঝায়)।
 *
 *   volumeM3 = (width_m × length_m × thickness_m)  [footing/pile-cap]
 *            = (planAreaM2 × thickness_m)           [mat-foundation]
 *   forceY = -(volumeM3 × unitWeight_kNm3) × selfWeightMultiplier   [kN]
 *
 * @param deadPatternId - যে LoadPattern-এ এই load case গুলো যুক্ত হবে (category "dead" হওয়া উচিত, caller নিশ্চিত করবে)
 * @param selfWeightMultiplier - LoadPattern থেকে (সাধারণত 1.0), না দিলে 1.0 ধরা হয়
 */
export function deriveFootingSelfWeightLoads(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  deadPatternId: string,
  selfWeightMultiplier = 1.0
): DeriveFootingSelfWeightLoadsResult {
  const loadCases: PointLoadCase[] = [];
  const skipped: DeriveFootingSelfWeightLoadsResult["skipped"] = [];
  const warnings: string[] = [];

  const footingElements = elements.filter(
    (e): e is FootingElement | PileCapElement | MatFoundationElement =>
      FOOTING_SELF_WEIGHT_SUPPORTED_CATEGORIES.has(e.category)
  );

  const unresolvedCount = elements.filter(
    (e) => e.category === "combined-footing" || e.category === "strip-footing"
  ).length;
  if (unresolvedCount > 0) {
    warnings.push(
      `${unresolvedCount}টা Combined/Strip Footing element এখানে বাদ পড়েছে — এদের plan dimension sizing calculation থেকে derive হয়, element-এ সংরক্ষিত না, তাই self-weight নির্ভরযোগ্যভাবে auto-generate করা যায় না। sizing সম্পন্ন হওয়ার পর ম্যানুয়ালি point load যোগ করুন।`
    );
  }

  for (const element of footingElements) {
    const material = materials.find((m) => m.materialId === element.materialId);
    if (!material) {
      skipped.push({ elementId: element.elementId, label: element.label, reason: `materialId "${element.materialId}" পাওয়া যায়নি material library তে।` });
      continue;
    }

    // CompositeMaterial এর জন্য effectiveUnitWeight — deriveSelfWeightLoads.ts এর সাথে সঙ্গতিপূর্ণ নামকরণ পার্থক্য।
    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;

    let volumeM3: number;
    if (element.category === "mat-foundation") {
      const areaM2 = computePolygonPlanArea(element.vertices);
      if (areaM2 <= 0) {
        skipped.push({ elementId: element.elementId, label: element.label, reason: "Plan area শূন্য বা অবৈধ (কমপক্ষে ৩টা বৈধ vertex দরকার)।" });
        continue;
      }
      volumeM3 = areaM2 * (element.thickness / 1000);
    } else {
      // footing | pile-cap — width/length/thickness সরাসরি element এ (mm)
      if (element.width <= 0 || element.length <= 0 || element.thickness <= 0) {
        skipped.push({ elementId: element.elementId, label: element.label, reason: "width/length/thickness শূন্য বা ঋণাত্মক — geometry যাচাই করুন।" });
        continue;
      }
      volumeM3 = (element.width / 1000) * (element.length / 1000) * (element.thickness / 1000);
    }

    const forceY = -(volumeM3 * unitWeight * selfWeightMultiplier); // kN, gravity direction negative

    loadCases.push(
      createPointLoad({
        patternId: deadPatternId,
        elementId: element.elementId,
        forceX: 0,
        forceY,
        forceZ: 0,
        positionRatio: 0,
        source: "auto",
      })
    );
  }

  if (skipped.length > 0) {
    warnings.push(`${skipped.length}টা Footing/Pile-Cap/Mat-Foundation element self-weight auto-generation এ বাদ পড়েছে — নিচে elementId/কারণ দেখুন, প্রয়োজনে ম্যানুয়ালি যোগ করুন।`);
  }

  return { loadCases, skipped, warnings };
}
