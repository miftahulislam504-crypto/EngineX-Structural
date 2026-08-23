/**
 * distributeStoryForceToColumns.ts — Wind/Seismic story force (kN,
 * lateral) কে সেই story-র column গুলোতে stiffness-proportional
 * পদ্ধতিতে ভাগ করে PointLoadCase[] তৈরি করে।
 * ------------------------------------------------------------------
 * Miftahul এর সিদ্ধান্ত: "Stiffness-proportional (I/L অনুযায়ী)"।
 *
 * পদ্ধতি (rigid-diaphragm সরলীকরণ, ETABS/SAP2000 এর "equal lateral
 * displacement per diaphragm" নীতির basic approximation):
 *   ধরে নেওয়া হয় একই story-র সব column একই লেটারাল displacement
 *   অনুভব করে (rigid floor diaphragm assumption — Slab কে rigid
 *   diaphragm ধরা BNBC/ACI এর সাধারণ প্র্যাকটিস, যদি না torsional
 *   irregularity বিশেষভাবে চেক করা লাগে, যা এই ফাংশনের scope এর
 *   বাইরে)। এই assumption এ প্রতিটা column-এর ভাগের force তার lateral
 *   stiffness-এর সমানুপাতিক:
 *
 *     k_i = 12·E·I / L³   (fixed-fixed column stiffness, cantilever
 *                          বা pin-pin এর তুলনায় বেশি প্রচলিত approximation
 *                          RC frame এ, যেখানে beam-column joint কে
 *                          rigid ধরা হয়)
 *
 *     force_i = totalStoryForce × (k_i / Σk_j)   [সেই story-র সব column j জুড়ে যোগফল]
 *
 *   direction অনুযায়ী (X বা Y) সংশ্লিষ্ট axis-এর moment of inertia
 *   ব্যবহার করা হয় (iyy → X-direction bending-এ প্রতিরোধ করে এমন axis,
 *   ixx → Y-direction — rectangular section এ local-axis orientation
 *   ডকুমেন্টেড না থাকায় রক্ষণশীলভাবে ছোট মান (min(ixx, iyy)) সব
 *   দিকেই ব্যবহার করা হচ্ছে, যতক্ষণ না element এ local-axis rotation
 *   তথ্য যোগ হয়)।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - E (elasticity modulus) material থেকে নেওয়া হয়; ভিন্ন material
 *     এর column একই story তে থাকলে সঠিকভাবে EI ব্যবহার করা হয় (শুধু
 *     I না) — stiffness আসলে EI/L³ সমানুপাতিক।
 *   - এই পদ্ধতি P-Delta, torsional irregularity, বা diaphragm
 *     flexibility বিবেচনা করে না — এগুলো ETABS-এর পূর্ণাঙ্গ 3D
 *     matrix-analysis এ যেভাবে হয় তার একটা সরলীকৃত preliminary
 *     approximation, চূড়ান্ত ডিজাইনের জন্য না।
 *   - Brace element কে lateral-resisting element হিসেবে গণ্য করা
 *     হয়নি (শুধু Column) — bracing configuration থাকলে stiffness
 *     ভাগ ভুল হতে পারে, ভবিষ্যতে যোগ করা উচিত।
 */

import type { StructuralElement, ColumnElement } from "@/lib/types/element";
import { computeLineElementLength } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import { computeConcreteEc } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";
import type { PointLoadCase } from "@/lib/types/load";
import { createPointLoad } from "@/lib/types/load";
import type { GeometryCore, StructuralStory } from "@/lib/types/geometry";
import type { WindLoadResult } from "@/lib/loads/windLoad";
import type { SeismicLoadResult } from "@/lib/loads/seismicLoad";

export interface DistributeStoryForceResult {
  loadCases: PointLoadCase[];
  skippedStories: { storyIndex: number; reason: string }[];
  warnings: string[];
}

/** নির্দিষ্ট elevation-range এ পড়া (স্টার্ট বা এন্ড পয়েন্টের elevation যদি story-র নিচের ও উপরের সীমার মধ্যে থাকে) সব Column element খুঁজে বের করে। */
function findColumnsInStoryRange(
  columns: ColumnElement[],
  bottomElevation: number,
  topElevation: number
): ColumnElement[] {
  const epsilon = 1e-6;
  return columns.filter((c) => {
    const midY = (c.startPoint.y + c.endPoint.y) / 2;
    return midY >= bottomElevation - epsilon && midY <= topElevation + epsilon;
  });
}

/** stories কে elevation অনুযায়ী sort করে bottom/top elevation সহ রিটার্ন করে (StructuralStory.elevation = story-র base, height = ঐ story-র উচ্চতা)। */
function sortedStoryRanges(stories: StructuralStory[]): { story: StructuralStory; bottomElevation: number; topElevation: number }[] {
  return [...stories]
    .sort((a, b) => a.elevation - b.elevation)
    .map((story) => ({ story, bottomElevation: story.elevation, topElevation: story.elevation + story.height }));
}

/**
 * material variant অনুযায়ী সঠিক elastic modulus (MPa) বের করে।
 * ConcreteMaterial এ সরাসরি elasticModulus ফিল্ড নেই (fc/ec থেকে
 * computeConcreteEc() দিয়ে হিসাব করতে হয়, material.ts এর ACI 318-19
 * Eq. 19.2.2.1.b অনুযায়ী)। SteelMaterial এ ফিল্ডের নাম "es" (অন্য সব
 * variant এ "elasticModulus")। CompositeMaterial এ
 * "effectiveElasticModulus"। deriveSelfWeightLoads.ts এর মতোই
 * discriminated-union-aware resolution, কিন্তু এখানে variant-প্রতি
 * field-নাম আরও বেশি ভিন্ন হওয়ায় exhaustive switch দরকার হলো।
 */
function resolveElasticModulus(material: StructuralMaterial): number {
  switch (material.type) {
    case "concrete":
      return computeConcreteEc(material);
    case "composite":
      return material.effectiveElasticModulus;
    case "steel":
      return material.es;
    case "timber":
    case "aluminium":
    case "frp":
    case "glass":
      return material.elasticModulus;
  }
}

/** একটা column এর lateral stiffness proxy (E·I_min / L³) হিসাব করে — I_min ব্যবহার করার কারণ উপরের হেডার কমেন্টে ব্যাখ্যা করা আছে। */
function computeColumnStiffness(
  column: ColumnElement,
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): number | null {
  const material = materials.find((m) => m.materialId === column.materialId);
  const section = sections.find((s) => s.sectionId === column.sectionId);
  if (!material || !section) return null;

  let properties;
  try {
    properties = computeSectionProperties(section);
  } catch {
    return null;
  }

  const lengthMm = computeLineElementLength(column) * 1000;
  if (lengthMm <= 0) return null;

  const elasticModulus = resolveElasticModulus(material);
  if (!elasticModulus || elasticModulus <= 0) return null;

  const iMin = Math.min(properties.ixx, properties.iyy); // mm⁴, রক্ষণশীল দিকে ছোট axis (হেডার কমেন্ট দেখুন)
  return (elasticModulus * iMin) / lengthMm ** 3; // আপেক্ষিক stiffness proxy — একক গুরুত্বপূর্ণ না, শুধু অনুপাত ব্যবহার হবে
}

/**
 * একটা direction (X বা Y) এর story force array কে stiffness-proportional
 * ভাবে সেই story-র column গুলোতে distribute করে PointLoadCase[] বানায়।
 *
 * storyForces এর storyIndex 1 = base-এর ঠিক উপরের তলা (windLoad.ts/
 * seismicLoad.ts এর কনভেনশন) — তাই geometry.stories কে elevation
 * অনুযায়ী sort করে storyIndex 1 কে সবচেয়ে নিচের non-base story ধরা হয়।
 */
export function distributeStoryForceToColumns(
  storyForces: { storyIndex: number; force: number }[],
  direction: "X" | "Y",
  patternId: string,
  geometry: GeometryCore,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): DistributeStoryForceResult {
  const warnings: string[] = [];
  const skippedStories: DistributeStoryForceResult["skippedStories"] = [];
  const loadCases: PointLoadCase[] = [];

  const nonBaseStories = geometry.stories.filter((s) => !s.isBaseLevel);
  const ranges = sortedStoryRanges(nonBaseStories);
  const columns = elements.filter((e): e is ColumnElement => e.category === "column");

  for (const sf of storyForces) {
    const range = ranges[sf.storyIndex - 1]; // storyIndex 1-based
    if (!range) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: "এই storyIndex এর সাথে মেলে এমন কোনো StructuralStory পাওয়া যায়নি (geometry.stories তালিকা storyForces এর সাথে সামঞ্জস্যপূর্ণ নয়)।" });
      continue;
    }

    const storyColumns = findColumnsInStoryRange(columns, range.bottomElevation, range.topElevation);
    if (storyColumns.length === 0) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: `Story "${range.story.name}" (elevation ${range.bottomElevation}m–${range.topElevation}m) এ কোনো Column পাওয়া যায়নি।` });
      continue;
    }

    const stiffnesses = storyColumns.map((c) => ({ column: c, k: computeColumnStiffness(c, materials, sections) }));
    const validStiffnesses = stiffnesses.filter((s): s is { column: ColumnElement; k: number } => s.k !== null && s.k > 0);

    if (validStiffnesses.length === 0) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: `Story "${range.story.name}" এর কোনো Column এর material/section resolve করা যায়নি — stiffness হিসাব করা যায়নি।` });
      continue;
    }
    if (validStiffnesses.length < storyColumns.length) {
      warnings.push(
        `Story "${range.story.name}" এ ${storyColumns.length - validStiffnesses.length}টা Column stiffness হিসাবে বাদ পড়েছে (material/section resolve ব্যর্থ) — বাকি column গুলোর মধ্যেই force পুনর্বণ্টন করা হয়েছে।`
      );
    }

    const totalStiffness = validStiffnesses.reduce((sum, s) => sum + s.k, 0);

    for (const { column, k } of validStiffnesses) {
      const shareRatio = k / totalStiffness;
      const columnForce = sf.force * shareRatio;

      loadCases.push(
        createPointLoad({
          patternId,
          elementId: column.elementId,
          forceX: direction === "X" ? columnForce : 0,
          forceY: 0,
          forceZ: direction === "Y" ? columnForce : 0,
          positionRatio: 1.0, // column-এর top প্রান্তে (story force ঐ level এর diaphragm এ প্রযুক্ত হয় বলে ধরা হয়)
          source: "auto",
        })
      );
    }
  }

  if (skippedStories.length > 0) {
    warnings.push(`${skippedStories.length}টা story এ force distribute করা যায়নি — নিচে storyIndex/কারণ দেখুন।`);
  }

  return { loadCases, skippedStories, warnings };
}

/** WindLoadResult.storyForces থেকে সরাসরি distribute করার সুবিধাজনক wrapper। */
export function distributeWindStoryForces(
  windStoryForces: WindLoadResult["storyForces"],
  direction: "X" | "Y",
  patternId: string,
  geometry: GeometryCore,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): DistributeStoryForceResult {
  return distributeStoryForceToColumns(
    windStoryForces.map((sf) => ({ storyIndex: sf.storyIndex, force: sf.force })),
    direction,
    patternId,
    geometry,
    elements,
    materials,
    sections
  );
}

/** SeismicLoadResult.storyForces থেকে সরাসরি distribute করার সুবিধাজনক wrapper। */
export function distributeSeismicStoryForces(
  seismicStoryForces: SeismicLoadResult["storyForces"],
  direction: "X" | "Y",
  patternId: string,
  geometry: GeometryCore,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): DistributeStoryForceResult {
  return distributeStoryForceToColumns(
    seismicStoryForces.map((sf) => ({ storyIndex: sf.storyIndex, force: sf.force })),
    direction,
    patternId,
    geometry,
    elements,
    materials,
    sections
  );
}
