/**
 * Weight Optimization — Structure-Wide Material Takeoff
 * Phase 9c — প্রতিটা model element-এর concrete/steel self-weight
 * বের করে একটা structure-wide summary তৈরি করে (element category ও
 * material অনুযায়ী গ্রুপ করে)। এটা নতুন কোনো optimization search না
 * (9a/9b-এর মতো candidate sweep না) — বরং একটা material takeoff/
 * quantity summary, যেটা 9d (Cost Optimization) এর ভিত্তি হবে এবং
 * নিজে থেকেই একটা useful "কোন element category সবচেয়ে বেশি ওজন/
 * volume নিচ্ছে" রিপোর্ট।
 *
 * Scope নোট: এটা rebar-level detailing takeoff না (নির্দিষ্ট bar
 * schedule/cutting list — সেটা Phase 10 Detailing-এর পরিধি)। এখানে
 * শুধু cross-sectional geometry (section area বা footing/mat plan
 * dimension) × length/thickness × material unit weight থেকে
 * concrete/steel-section self-weight হিসাব করা হয় — যেটা preliminary
 * material quantity/cost estimation-এর জন্য standard practice।
 *
 * Section shape সীমাবদ্ধতা: computeSectionProperties() composite/
 * prestressed/cold-formed shape-এ throw করে (lib/types/section.ts এর
 * ইচ্ছাকৃত ডিজাইন — pure geometry থেকে নির্ভরযোগ্য সংখ্যা বের করা
 * যায় না)। এই takeoff সেই এলিমেন্টগুলোকে চুপচাপ বাদ দেয় না — বরং
 * `excluded` তালিকায় স্পষ্টভাবে রিপোর্ট করে, যাতে ইঞ্জিনিয়ার জানেন
 * টোটাল ওজনে কোন এলিমেন্ট অন্তর্ভুক্ত হয়নি।
 */

import type { StructuralElement, ElementCategory, Point3D } from "@/lib/types/element";
import { distanceBetweenPoints } from "@/lib/types/element";
import type { StructuralMaterial, MaterialType } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";

export interface WeightTakeoffExclusion {
  elementId: string;
  elementLabel: string;
  category: ElementCategory;
  reason: string;
}

export interface CategoryWeightSummary {
  category: ElementCategory;
  materialType: MaterialType;
  elementCount: number;
  totalVolumeM3: number;
  totalWeightKN: number;
}

export interface WeightTakeoffResult {
  categorySummaries: CategoryWeightSummary[];
  totalVolumeM3: number;
  totalWeightKN: number;
  excluded: WeightTakeoffExclusion[];
  message: string;
}

/**
 * একটা planar polygon (Slab-এর মতো অনুভূমিক, বা Wall-এর মতো উল্লম্ব —
 * উভয় ক্ষেত্রেই সঠিক) এর সত্যিকার 3D area — Newell's method
 * (cross-product-based), শুধু XZ প্লেন প্রজেকশনের উপর নির্ভর করে না
 * (computePolygonPlanArea এর মতো, যেটা নিজেই স্বীকার করে Wall-এর
 * জন্য কম প্রাসঙ্গিক কারণ সেটা XZ-প্লেন-প্রজেকশন-ভিত্তিক)। ফলাফল m²,
 * ধরে নেওয়া হয় vertices মিটারে (grid/story কনভেনশন অনুযায়ী)।
 */
function computePlanarPolygon3DAreaM2(vertices: Point3D[]): number {
  if (vertices.length < 3) return 0;

  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    normalX += (current.y - next.y) * (current.z + next.z);
    normalY += (current.z - next.z) * (current.x + next.x);
    normalZ += (current.x - next.x) * (current.y + next.y);
  }

  const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2 + normalZ ** 2);
  return magnitude / 2;
}

function findMaterial(materials: StructuralMaterial[], materialId: string): StructuralMaterial | undefined {
  return materials.find((m) => m.materialId === materialId);
}

/**
 * সব material type-এ unitWeight ফিল্ড নাম এক না — CompositeMaterial
 * এ এটা effectiveUnitWeight নামে থাকে (material.ts দেখুন, কারণ সেটা
 * একটা weighted-average মান, সরাসরি material property না)। এই
 * helper দুটোকেই uniformভাবে হ্যান্ডেল করে।
 */
function getUnitWeightKNPerM3(material: StructuralMaterial): number {
  return material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;
}

function findSection(sections: StructuralSection[], sectionId: string): StructuralSection | undefined {
  return sections.find((s) => s.sectionId === sectionId);
}

/**
 * সব element-এর মধ্যে দিয়ে iterate করে, প্রতিটার concrete/steel
 * self-weight হিসাব করে, category অনুযায়ী গ্রুপ করে। কোনো search/
 * optimization loop না — একটা সরল, deterministic takeoff pass।
 */
export function computeWeightTakeoff(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): WeightTakeoffResult {
  const excluded: WeightTakeoffExclusion[] = [];
  const categoryTotals = new Map<
    string,
    { category: ElementCategory; materialType: MaterialType; count: number; volumeM3: number; weightKN: number }
  >();

  function addToCategory(category: ElementCategory, materialType: MaterialType, volumeM3: number, weightKN: number) {
    const key = `${category}::${materialType}`;
    const existing = categoryTotals.get(key) ?? { category, materialType, count: 0, volumeM3: 0, weightKN: 0 };
    existing.count += 1;
    existing.volumeM3 += volumeM3;
    existing.weightKN += weightKN;
    categoryTotals.set(key, existing);
  }

  function exclude(element: StructuralElement, reason: string) {
    excluded.push({ elementId: element.elementId, elementLabel: element.label, category: element.category, reason });
  }

  for (const element of elements) {
    if (element.category === "pile-group") {
      // Pile Group নিজে কোনো solid volume না — গ্রুপের প্রতিটা pile-এর
      // ভলিউম নিজস্ব geometry (pileShape/diameter/embeddedLength) থেকে
      // হিসাব করা হয়, sectionId/materialId নেই বলে material lookup ভিন্নভাবে হয়।
      const material = findMaterial(materials, element.materialId);
      if (!material) {
        exclude(element, `materialId "${element.materialId}" library-তে পাওয়া যায়নি।`);
        continue;
      }
      const pileCount = element.numberOfRows * element.numberOfColumns;
      const areaM2 =
        element.pileShape === "circular"
          ? Math.PI * (element.pileDiameterOrWidthMm / 1000 / 2) ** 2
          : (element.pileDiameterOrWidthMm / 1000) ** 2;
      const lengthM = element.embeddedLengthMm / 1000;
      const volumeM3 = areaM2 * lengthM * pileCount;
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    // বাকি সব category-র materialId কমন BaseElement ফিল্ড
    const material = findMaterial(materials, element.materialId);
    if (!material) {
      exclude(element, `materialId "${element.materialId}" library-তে পাওয়া যায়নি।`);
      continue;
    }

    if (
      element.category === "beam" ||
      element.category === "column" ||
      element.category === "brace" ||
      element.category === "pile"
    ) {
      const section = findSection(sections, element.sectionId);
      if (!section) {
        exclude(element, `sectionId "${element.sectionId}" library-তে পাওয়া যায়নি।`);
        continue;
      }
      let properties;
      try {
        properties = computeSectionProperties(section);
      } catch {
        exclude(
          element,
          `Section shape "${section.shape}" এর geometric property এখনো সাপোর্টেড না (composite/prestressed/cold-formed) — takeoff-এ বাদ দেওয়া হয়েছে।`
        );
        continue;
      }
      const lengthM = distanceBetweenPoints(element.startPoint, element.endPoint);
      const volumeM3 = (properties.area / 1_000_000) * lengthM; // mm² → m², × m
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "slab") {
      const areaM2 = computePlanarPolygon3DAreaM2(element.vertices);
      const volumeM3 = areaM2 * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "wall" || element.category === "shear-wall" || element.category === "core-wall") {
      const areaM2 = computePlanarPolygon3DAreaM2(element.vertices);
      const volumeM3 = areaM2 * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "stair") {
      // waist-slab — Wall-এর মতোই AreaElement, computePlanarPolygon3DAreaM2()
      // Newell's method ব্যবহার করে বলে inclined plane-এও সত্যিকার
      // surface area দেয় (flat XZ-projection না) — mapStair()-এর
      // ৪-vertex inclined plane-এর জন্য এটাই সঠিক ভলিউম দেয়। step-এর
      // নিজস্ব আয়তন (waist slab-এর ওপরের ত্রিভুজাকার ধাপ) এখানে ধরা
      // হয়নি — শুধু waist slab, একই সরলীকরণ Slab/Wall-এও প্রযোজ্য
      // (uniform-thickness plate ধরে নেওয়া হয়, কোনো surface relief না)।
      const areaM2 = computePlanarPolygon3DAreaM2(element.vertices);
      const volumeM3 = areaM2 * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "parapet") {
      // Wall-এর ঠিক একই AreaElement geometry (mapParapet() দেখুন,
      // hub-geometry-parser.ts — vertical rectangular plane, ৪-vertex),
      // তাই computePlanarPolygon3DAreaM2() একই ভাবে সঠিক surface area
      // দেয়। deriveAreaSelfWeightLoads.ts এর dead-load derivation এর
      // সাথে সঙ্গতিপূর্ণ থাকতে এই takeoff-ও একই formula ব্যবহার করছে।
      const areaM2 = computePlanarPolygon3DAreaM2(element.vertices);
      const volumeM3 = areaM2 * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "footing" || element.category === "pile-cap") {
      const volumeM3 = (element.width / 1000) * (element.length / 1000) * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    if (element.category === "combined-footing") {
      // CombinedFootingElement এর নিজস্ব width/length ফিল্ড নেই (sizing
      // calculation থেকে derive হয়) — takeoff-এর জন্য column স্প্যান+
      // সাধারণ cantilever allowance অনুমান করার বদলে, এই এলিমেন্ট
      // honestly excluded করা হলো, কারণ নির্ভরযোগ্য plan dimension
      // ছাড়া ভলিউম অনুমান করা বিভ্রান্তিকর সংখ্যা দিত।
      exclude(
        element,
        "Combined Footing-এর plan dimension (width/length) element-এ সংরক্ষিত নেই — sizing calculation-এর আউটপুট থেকে আসে, তাই এই takeoff-এ নির্ভরযোগ্যভাবে অনুমান করা যায় না।"
      );
      continue;
    }

    if (element.category === "strip-footing") {
      exclude(
        element,
        "Strip Footing-এর width element-এ সংরক্ষিত নেই — sizing calculation-এর আউটপুট থেকে আসে, তাই এই takeoff-এ নির্ভরযোগ্যভাবে অনুমান করা যায় না।"
      );
      continue;
    }

    if (element.category === "mat-foundation") {
      const areaM2 = computePlanarPolygon3DAreaM2(element.vertices);
      const volumeM3 = areaM2 * (element.thickness / 1000);
      const weightKN = volumeM3 * getUnitWeightKNPerM3(material);
      addToCategory(element.category, material.type, volumeM3, weightKN);
      continue;
    }

    // Exhaustiveness — নতুন ElementCategory যোগ হলে এখানে কম্পাইল
    // এরর দেবে যদি case না লেখা হয়।
    const exhaustiveCheck: never = element;
    exclude(exhaustiveCheck as StructuralElement, "অজানা element category।");
  }

  const categorySummaries: CategoryWeightSummary[] = Array.from(categoryTotals.values())
    .map((totals) => ({
      category: totals.category,
      materialType: totals.materialType,
      elementCount: totals.count,
      totalVolumeM3: totals.volumeM3,
      totalWeightKN: totals.weightKN,
    }))
    .sort((a, b) => b.totalWeightKN - a.totalWeightKN);

  const totalVolumeM3 = categorySummaries.reduce((sum, c) => sum + c.totalVolumeM3, 0);
  const totalWeightKN = categorySummaries.reduce((sum, c) => sum + c.totalWeightKN, 0);

  const message =
    categorySummaries.length > 0
      ? `${elements.length - excluded.length}টি element-এর takeoff সম্পন্ন হয়েছে — মোট ভলিউম ${totalVolumeM3.toFixed(2)} m³, মোট self-weight ${totalWeightKN.toFixed(1)} kN।${excluded.length > 0 ? ` ${excluded.length}টি element বাদ দেওয়া হয়েছে (কারণ নিচে দেখুন)।` : ""}`
      : `কোনো element-এর জন্য takeoff হিসাব করা যায়নি — মডেলে element যোগ করুন অথবা material/section library সম্পূর্ণ করুন।`;

  return { categorySummaries, totalVolumeM3, totalWeightKN, excluded, message };
}
