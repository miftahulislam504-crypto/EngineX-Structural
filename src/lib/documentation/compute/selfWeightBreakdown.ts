/**
 * selfWeightBreakdown.ts — Report-Audit Phase B8 (2026-08-20)
 *
 * Section E (Design Loads) এ এখন শুধু LoadPattern.selfWeightMultiplier
 * (একটা multiplier সংখ্যা, dead category তে) দেখানো হতো — actual
 * item-wise self-weight (Beam vs Column vs Slab আলাদা, কত kN) কোথাও
 * ছিল না। এই মডিউল সেই gap পূরণ করে, category-wise self-weight
 * (kN) হিসাব করে (concrete volume × material.unitWeight)।
 *
 * quantitySummary.ts এর computeElementConcreteVolumeM3()/sectionAreaMm2()
 * reuse করা হলো (এখন export করা, আগে ফাইল-প্রাইভেট ছিল) — নতুন volume
 * calculation duplicate করার বদলে, যাতে Quantity Summary (Section I)
 * এর concrete quantity আর এখানকার self-weight একই ভিত্তি থেকে আসে,
 * কোনোদিন দুই জায়গায় ভিন্ন সংখ্যা না দেখায়।
 *
 * honest সীমাবদ্ধতা (quantitySummary.ts এর computeElementConcreteVolumeM3
 * থেকেই উত্তরাধিকারসূত্রে):
 *   - Beam/Column/Slab/Mat-Foundation/Footing এর জন্য হিসাব করা যায়।
 *   - Wall/Shear-Wall/Core-Wall বাদ — vertical-plane polygon area
 *     এর জন্য কোনো general 3D area calculator এই কোডবেসে নেই
 *     (quantitySummary.ts এর docblock এ documented, নতুন করে invent
 *     করা হয়নি — wall vertices কোন plane এ থাকবে তার কোনো guaranteed
 *     convention নেই, ভুল অনুমান করলে ভুল self-weight দেখানো হতো)।
 *   - Brace/Pile/Combined-Footing/Strip-Footing/Pile-Cap/Pile-Group
 *     বাদ — একই উপরের ফাইলে documented কারণে (unresolved volume)।
 *   - Composite/Prestressed/Cold-Formed section (sectionAreaMm2 এর
 *     সীমাবদ্ধতা) বাদ।
 *
 * বাদ পড়া element গুলো চুপচাপ উপেক্ষা করা হয় না — warnings এ গণনা +
 * কারণ স্পষ্টভাবে জানানো হয়, PDF এ দেখানোর জন্য।
 */

import type { StructuralElement } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeElementConcreteVolumeM3 } from "@/lib/documentation/compute/quantitySummary";

export type SelfWeightGroupCategory = "beam" | "column" | "slab" | "footing" | "other-unresolved";

export interface SelfWeightGroup {
  category: SelfWeightGroupCategory;
  elementCount: number;
  totalVolumeM3: number;
  /** kN — volume × material.unitWeight, প্রতিটা element এর নিজস্ব material অনুযায়ী (একই category তে ভিন্ন grade থাকতে পারে)। */
  totalSelfWeightKN: number;
}

export interface SelfWeightBreakdownResult {
  groups: SelfWeightGroup[];
  totalSelfWeightKN: number;
  unresolvedCount: number;
  warnings: string[];
}

const RESOLVABLE_CATEGORIES: Record<string, SelfWeightGroupCategory> = {
  beam: "beam",
  column: "column",
  slab: "slab",
  "mat-foundation": "slab", // quantitySummary.ts এর computeElementConcreteVolumeM3 এ slab/mat-foundation একই case এ (flat area × thickness) — এখানেও একসাথে group করা হলো
  footing: "footing",
};

export function computeSelfWeightBreakdown(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): SelfWeightBreakdownResult {
  const groupTotals = new Map<SelfWeightGroupCategory, { count: number; volume: number; weight: number }>();
  let unresolvedCount = 0;
  let unresolvedMaterialCount = 0;

  for (const element of elements) {
    const groupCategory = RESOLVABLE_CATEGORIES[element.category];
    if (!groupCategory) {
      // wall/shear-wall/core-wall/brace/pile/... — computeElementConcreteVolumeM3
      // এমনিতেও null দিত এদের জন্য, কিন্তু আগেই skip করে ভিন্ন warning
      // message দেওয়া হলো (wall এর কারণ ভিন্ন — plane ambiguity, বাকিদের
      // কারণ ভিন্ন — data field missing) যাতে ব্যবহারকারী সঠিক কারণ জানে।
      if (element.category === "wall" || element.category === "shear-wall" || element.category === "core-wall") {
        unresolvedCount++;
      } else if (
        element.category === "brace" ||
        element.category === "pile" ||
        element.category === "combined-footing" ||
        element.category === "strip-footing" ||
        element.category === "pile-cap" ||
        element.category === "pile-group"
      ) {
        unresolvedCount++;
      }
      continue;
    }

    const volumeM3 = computeElementConcreteVolumeM3(element, sections);
    if (volumeM3 === null) {
      unresolvedCount++; // Composite/Prestressed/Cold-Formed section, sectionAreaMm2 এর সীমাবদ্ধতা
      continue;
    }

    const material = materials.find((m) => m.materialId === element.materialId);
    if (!material) {
      unresolvedMaterialCount++;
      continue;
    }
    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;
    const weightKN = volumeM3 * unitWeight;

    const existing = groupTotals.get(groupCategory) ?? { count: 0, volume: 0, weight: 0 };
    existing.count += 1;
    existing.volume += volumeM3;
    existing.weight += weightKN;
    groupTotals.set(groupCategory, existing);
  }

  const order: SelfWeightGroupCategory[] = ["beam", "column", "slab", "footing"];
  const groups: SelfWeightGroup[] = order
    .filter((c) => groupTotals.has(c))
    .map((c) => {
      const t = groupTotals.get(c)!;
      return { category: c, elementCount: t.count, totalVolumeM3: t.volume, totalSelfWeightKN: t.weight };
    });

  const totalSelfWeightKN = groups.reduce((sum, g) => sum + g.totalSelfWeightKN, 0);

  const warnings: string[] = [];
  if (unresolvedCount > 0) {
    warnings.push(
      `${unresolvedCount}টা element (Wall/Shear-Wall/Core-Wall, Brace/Pile, Combined/Strip Footing, Pile Cap/Group, বা Composite/Prestressed/Cold-Formed section) এই breakdown এ অন্তর্ভুক্ত হয়নি — এই app-এ এদের concrete volume নির্ভরযোগ্যভাবে হিসাব করার কোনো mechanism নেই এখনো (Wall এর ক্ষেত্রে vertical-plane area calculator নেই, বাকিদের ক্ষেত্রে প্রয়োজনীয় geometry field/section support নেই)।`
    );
  }
  if (unresolvedMaterialCount > 0) {
    warnings.push(
      `${unresolvedMaterialCount}টা element এর materialId material library তে পাওয়া যায়নি — সেগুলো এই breakdown এ বাদ পড়েছে।`
    );
  }

  return { groups, totalSelfWeightKN, unresolvedCount: unresolvedCount + unresolvedMaterialCount, warnings };
}
