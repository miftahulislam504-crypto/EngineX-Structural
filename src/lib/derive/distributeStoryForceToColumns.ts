/**
 * distributeStoryForceToColumns.ts — Wind/Seismic story force (kN,
 * lateral) কে সেই story-র Column ও Brace (উভয় lateral-resisting
 * element) এ stiffness-proportional পদ্ধতিতে ভাগ করে PointLoadCase[]
 * তৈরি করে।
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
 * Brace stiffness (২০২৬-০৮ যোগ হলো):
 *   Brace diagonal member, তাই তার lateral stiffness আসে axial
 *   stiffness (A·E/L) থেকে, column-এর মতো bending stiffness (E·I/L³)
 *   থেকে না। একটা brace-এর axis lateral direction (X বা Z) এর সাথে
 *   যে কোণে আছে, সেই কোণের ভিত্তিতে axial stiffness-এর কতটুকু অংশ
 *   সেই lateral direction-এ effective, তা বের করা হয়:
 *
 *     k_lateral = (A·E/L) × cos²θ
 *
 *   যেখানে cosθ = |horizontal projection along direction axis| / L
 *   (θ = brace-এর axis ও lateral direction-এর মধ্যবর্তী কোণ)। পুরোপুরি
 *   vertical brace (θ = 90°, column-এর মতো) হলে lateral contribution
 *   শূন্যের কাছাকাছি (axial force lateral direction-এ কোনো component
 *   দেয় না) — physically সঠিক, কারণ vertical brace আসলে column-ই।
 *   পুরোপুরি horizontal brace (θ = 0°, ঐ direction বরাবর) হলে পুরো
 *   axial stiffness lateral resistance এ যোগ হয়।
 *
 *   Column ও Brace উভয়ের stiffness এখন একই totalStiffness pool-এ
 *   যোগ হয় এবং একই proportional-share সূত্রে force ভাগ হয় — rigid-
 *   diaphragm assumption উভয় element type-এর জন্যই প্রযোজ্য (একই
 *   story-তে থাকা সব lateral-resisting element একই displacement
 *   অনুভব করে ধরে নেওয়া হয়)।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - E (elasticity modulus) material থেকে নেওয়া হয়; ভিন্ন material
 *     এর column একই story তে থাকলে সঠিকভাবে EI ব্যবহার করা হয় (শুধু
 *     I না) — stiffness আসলে EI/L³ সমানুপাতিক।
 *   - এই পদ্ধতি P-Delta, torsional irregularity, বা diaphragm
 *     flexibility বিবেচনা করে না — এগুলো ETABS-এর পূর্ণাঙ্গ 3D
 *     matrix-analysis এ যেভাবে হয় তার একটা সরলীকৃত preliminary
 *     approximation, চূড়ান্ত ডিজাইনের জন্য না।
 *   - Brace stiffness এখন গণনায় ঢোকে (উপরে ব্যাখ্যা করা হয়েছে), কিন্তু
 *     brace-এর end connection pin ধরে নেওয়া হয় (connectionType থেকে
 *     আসলে পড়া হয় না, কারণ axial stiffness pin/moment উভয় ক্ষেত্রেই
 *     মূলত একই — brace-এর lateral resistance মূলত axial action থেকে
 *     আসে, moment connection হলে সামান্য অতিরিক্ত bending stiffness
 *     যোগ হতে পারে যা এখানে conservative-ভাবে বাদ দেওয়া হয়েছে)। এছাড়া
 *     brace সাধারণত দুই story-র মধ্যে diagonal ভাবে বিস্তৃত থাকে —
 *     এই ফাংশন brace-কে সেই story-র "সদস্য" ধরে যেখানে তার midpoint
 *     পড়ে (column-এর মতোই ভাবা হয়), এবং force apply হয় brace-এর
 *     উপরের প্রান্তে (startPoint/endPoint এর মধ্যে যেটার elevation বেশি)।
 */

import type { StructuralElement, ColumnElement, BraceElement, Point3D } from "@/lib/types/element";
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

/** নির্দিষ্ট elevation-range এ পড়া (মধ্যবিন্দুর elevation যদি story-র নিচের ও উপরের সীমার মধ্যে থাকে) সব Column/Brace element খুঁজে বের করে — উভয়ই LineElement, একই midpoint-ভিত্তিক পরীক্ষা প্রযোজ্য। */
function findLateralElementsInStoryRange<T extends ColumnElement | BraceElement>(
  candidates: T[],
  bottomElevation: number,
  topElevation: number
): T[] {
  const epsilon = 1e-6;
  return candidates.filter((c) => {
    const midY = (c.startPoint.y + c.endPoint.y) / 2;
    return midY >= bottomElevation - epsilon && midY <= topElevation + epsilon;
  });
}

/** element-এর দুই প্রান্তের মধ্যে যেটার elevation বেশি সেটার positionRatio রিটার্ন করে (0 = startPoint প্রান্ত, 1 = endPoint প্রান্ত) — force apply করার প্রান্ত নির্ধারণে ব্যবহৃত। */
function topPointRatio(startPoint: Point3D, endPoint: Point3D): number {
  return endPoint.y >= startPoint.y ? 1.0 : 0.0;
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
 * একটা brace-এর lateral stiffness proxy (axial stiffness × cos²θ)
 * হিসাব করে — উপরের হেডার কমেন্টে সূত্র ব্যাখ্যা করা আছে। direction
 * অনুযায়ী (X বা Z axis) brace-এর horizontal projection ব্যবহার করে
 * cosθ বের করা হয় (Y-axis vertical/elevation, তাই horizontal plane
 * X-Z)।
 */
function computeBraceStiffness(
  brace: BraceElement,
  direction: "X" | "Y", // "X" মানে global X-axis, "Y" মানে (distributeStoryForceToColumns এর কনভেনশন অনুযায়ী) global Z-axis — নিচে ব্যাখ্যা দেখুন
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): number | null {
  const material = materials.find((m) => m.materialId === brace.materialId);
  const section = sections.find((s) => s.sectionId === brace.sectionId);
  if (!material || !section) return null;

  let properties;
  try {
    properties = computeSectionProperties(section);
  } catch {
    return null;
  }

  const lengthM = computeLineElementLength(brace);
  const lengthMm = lengthM * 1000;
  if (lengthMm <= 0) return null;

  const elasticModulus = resolveElasticModulus(material);
  if (!elasticModulus || elasticModulus <= 0) return null;

  // horizontal projection — createPointLoad এর forceX/forceZ কনভেনশনের
  // সাথে সঙ্গতিপূর্ণ: direction "X" → global X-axis projection,
  // direction "Y" → global Z-axis projection (নিচে forceZ ব্যবহার হয়
  // "Y" direction-এর জন্য, তাই এখানেও Z কো-অর্ডিনেট ব্যবহার করা হচ্ছে)।
  const horizontalDelta =
    direction === "X" ? brace.endPoint.x - brace.startPoint.x : brace.endPoint.z - brace.startPoint.z;
  const cosTheta = Math.abs(horizontalDelta) / lengthM;
  if (cosTheta <= 0) return 0; // পুরোপুরি vertical brace (বা এই direction-এর সাথে লম্ব) — এই direction-এ lateral contribution নেই

  const areaMm2 = properties.area; // mm²
  const axialStiffness = (elasticModulus * areaMm2) / lengthMm; // E·A/L, আপেক্ষিক প্রক্সি
  return axialStiffness * cosTheta ** 2; // k_lateral = (E·A/L) × cos²θ
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
  const braces = elements.filter((e): e is BraceElement => e.category === "brace");

  for (const sf of storyForces) {
    const range = ranges[sf.storyIndex - 1]; // storyIndex 1-based
    if (!range) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: "এই storyIndex এর সাথে মেলে এমন কোনো StructuralStory পাওয়া যায়নি (geometry.stories তালিকা storyForces এর সাথে সামঞ্জস্যপূর্ণ নয়)।" });
      continue;
    }

    const storyColumns = findLateralElementsInStoryRange(columns, range.bottomElevation, range.topElevation);
    const storyBraces = findLateralElementsInStoryRange(braces, range.bottomElevation, range.topElevation);
    if (storyColumns.length === 0 && storyBraces.length === 0) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: `Story "${range.story.name}" (elevation ${range.bottomElevation}m–${range.topElevation}m) এ কোনো Column বা Brace পাওয়া যায়নি।` });
      continue;
    }

    // Column ও Brace — উভয়ের stiffness একই একক (আপেক্ষিক proxy, ইউনিট
    // অপ্রাসঙ্গিক) দিয়ে হিসাব হলেও তাদের সূত্র ভিন্ন (bending vs axial,
    // উপরের হেডার কমেন্ট দেখুন) — তাই একটা সাধারণ { elementId, k } shape
    // এ মিলিয়ে একই totalStiffness pool এ যোগ করা হচ্ছে।
    const columnEntries = storyColumns.map((c) => ({
      elementId: c.elementId,
      applyAtRatio: topPointRatio(c.startPoint, c.endPoint),
      k: computeColumnStiffness(c, materials, sections),
    }));
    const braceEntries = storyBraces.map((b) => ({
      elementId: b.elementId,
      applyAtRatio: topPointRatio(b.startPoint, b.endPoint),
      k: computeBraceStiffness(b, direction, materials, sections),
    }));

    const allEntries = [...columnEntries, ...braceEntries];
    const validEntries = allEntries.filter(
      (e): e is { elementId: string; applyAtRatio: number; k: number } => e.k !== null && e.k > 0
    );

    if (validEntries.length === 0) {
      skippedStories.push({ storyIndex: sf.storyIndex, reason: `Story "${range.story.name}" এর কোনো Column/Brace এর material/section resolve করা যায়নি, বা কোনো Brace এই direction-এর সাথে লম্ব — stiffness হিসাব করা যায়নি।` });
      continue;
    }
    if (validEntries.length < allEntries.length) {
      warnings.push(
        `Story "${range.story.name}" এ ${allEntries.length - validEntries.length}টা element stiffness হিসাবে বাদ পড়েছে (material/section resolve ব্যর্থ, অথবা brace এই direction-এর সাথে লম্ব) — বাকি element গুলোর মধ্যেই force পুনর্বণ্টন করা হয়েছে।`
      );
    }

    const totalStiffness = validEntries.reduce((sum, e) => sum + e.k, 0);

    for (const { elementId, applyAtRatio, k } of validEntries) {
      const shareRatio = k / totalStiffness;
      const elementForce = sf.force * shareRatio;

      loadCases.push(
        createPointLoad({
          patternId,
          elementId,
          forceX: direction === "X" ? elementForce : 0,
          forceY: 0,
          forceZ: direction === "Y" ? elementForce : 0,
          positionRatio: applyAtRatio, // element-এর top প্রান্তে (story force ঐ level এর diaphragm এ প্রযুক্ত হয় বলে ধরা হয়) — Column-এ প্রায় সবসময় 1.0 (endPoint উপরে), Brace-এ orientation অনুযায়ী 0 বা 1
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
