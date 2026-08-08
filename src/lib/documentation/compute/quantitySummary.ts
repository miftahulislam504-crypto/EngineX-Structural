/**
 * Quantity Summary — Design Report Section I (Phase 11c)
 *
 * মূল প্লানের চাহিদা:
 *   "Concrete quantity (grade-wise, m³) — element type অনুযায়ী
 *    breakdown (beam/column/slab/footing)
 *    Steel/Rebar quantity (dia-wise, kg বা ton) — BBS থেকে aggregate
 *    করা টোটাল"
 * এবং Phase 11a এর নোট: এই একই আউটপুট hub-outgoing.ts এর
 * OutgoingQuantityOutput.concreteVolumeM3/.reinforcementWeightKg এর
 * উৎস — একটা ফাংশন, দুই consumer (এই Section I, Hub sync)।
 *
 * সততার সাথে একটা সীমাবদ্ধতা এখানে জানানো দরকার (element.ts স্ক্যান
 * করে ধরা পড়েছে): concrete volume প্রতিটা element category এর জন্য
 * সমানভাবে হিসাবযোগ্য না —
 *   - beam/column: sectionId → SectionLibrary area (mm²) × length — সরাসরি হিসাবযোগ্য
 *   - slab/mat-foundation: vertices (XZ প্লেন পলিগন) × thickness — সরাসরি হিসাবযোগ্য
 *   - footing (isolated): width × length × thickness — element এই তিনটাই রাখে, সরাসরি হিসাবযোগ্য
 *   - combined-footing/strip-footing: element.ts এর নিজস্ব কমেন্ট
 *     অনুযায়ী "width sizing calculation থেকে আসে" — element এ width
 *     সংরক্ষিত না, তাই DesignResult.detail এ persist করা sizing output
 *     ছাড়া volume বের করা অসম্ভব। যতক্ষণ designResults খালি (Phase
 *     11a এর নোট করা gap), এই দুই category "unavailable" হিসেবে
 *     রিপোর্ট হবে, ভুল/অনুমাননির্ভর সংখ্যা দেখানো হবে না।
 *   - wall/shear-wall/core-wall: vertices vertical plane এ (XZ শোলেস
 *     ফর্মুলা প্রযোজ্য না) — general 3D polygon area calculator এই
 *     কোডবেসে কোথাও নেই (foundationOptimization.ts/matFoundationSizing.ts
 *     এর polygon area helper শুধু XZ/horizontal ধরে নেয়)। তাই wall
 *     concrete volume ও আপাতত "unavailable"।
 *   - pile/pile-cap/pile-group: sizing element.ts এ আছে কিন্তু এই
 *     ফেজে (11c, Design Report) স্কোপের বাইরে রাখা হলো — ভবিষ্যতে
 *     একই প্যাটার্নে যোগ করা যাবে।
 *
 * "unavailable" থাকা মানে false zero দেখানো না — QuantitySummary এর
 * `unresolvedElementCount`/`unresolvedCategories` ফিল্ডে caller
 * (Design Report Section I template, Phase 11d এ লেখা হবে) দেখতে
 * পাবে ঠিক কতগুলো element/কোন category বাদ পড়েছে, কেন তার একটা
 * ছোট নোট (`note`) সহ — যাতে ইঞ্জিনিয়ার/QC রিভিউয়ার বিভ্রান্ত না হন।
 */

import type { ReportContext } from "@/lib/documentation/reportContext";
import type { StructuralElement, ElementCategory } from "@/lib/types/element";
import type { RectangularSection, CircularSection, StructuralSection } from "@/lib/types/section";
import type { ConcreteMaterial } from "@/lib/types/material";
import { computeLineElementLength } from "@/lib/types/element";
import {
  computeRebarUnitWeightKgPerM,
  summarizeBbsByDiameter,
  type BbsEntry,
} from "@/lib/design/barBendingSchedule";
import type { BarScheduleRow } from "@/lib/detailing/types";

export interface ConcreteQuantityRow {
  category: ElementCategory;
  materialId: string;
  materialName: string;
  fcMPa: number;
  volumeM3: number;
  elementCount: number;
}

export interface SteelQuantityRow {
  diameterMm: number;
  totalWeightKg: number;
  totalLengthM: number;
}

export interface QuantitySummary {
  concreteByGradeAndCategory: ConcreteQuantityRow[];
  totalConcreteVolumeM3: number;
  steelByDiameter: SteelQuantityRow[];
  totalSteelWeightKg: number;
  /** যে element গুলোর concrete volume এই ফেজে হিসাব করা যায়নি (categoryর কারণে, উপরের docblock দেখুন)। */
  unresolvedElementCount: number;
  unresolvedCategories: ElementCategory[];
  note: string | null;
}

function sectionAreaMm2(section: StructuralSection | undefined): number | null {
  if (!section) return null;
  if (section.shape === "rectangular") {
    return (section as RectangularSection).width * (section as RectangularSection).depth;
  }
  if (section.shape === "circular") {
    const r = (section as CircularSection).diameter / 2;
    return Math.PI * r * r;
  }
  // w-shape/hss/built-up/composite/prestressed/cold-formed — এগুলো সাধারণত steel section,
  // এবং BaseSection এ একটা প্রি-কম্পিউটেড `area` ফিল্ড থাকে (section.ts এর কমেন্ট অনুযায়ী,
  // Phase 4 Analysis Engine এর জন্য আগে থেকেই হিসাব করা)।
  return "area" in section ? (section as { area: number }).area : null;
}

/** শোলেস ফর্মুলা — শুধু XZ (horizontal) প্লেনের polygon এর জন্য প্রযোজ্য (slab/mat-foundation)। foundationOptimization.ts/matFoundationSizing.ts এ একই সূত্র প্রাইভেট হিসেবে আছে — এখানে exported সংস্করণ, কারণ Documentation Engine এর জন্যও লাগে। */
export function computeHorizontalPolygonAreaM2(vertices: { x: number; z: number }[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) / 2;
}

/** একটা element এর concrete volume (m³), হিসাবযোগ্য হলে — নাহলে null (উপরের docblock এ ব্যাখ্যা করা সীমাবদ্ধতা অনুযায়ী)। */
function computeElementConcreteVolumeM3(
  element: StructuralElement,
  sections: StructuralSection[]
): number | null {
  switch (element.category) {
    // brace: element.ts এর computeLineElementLength() টাইপ-সীমাবদ্ধভাবে
    // শুধু BeamElement|ColumnElement নেয় (যদিও গঠনগতভাবে BraceElement এর
    // startPoint/endPoint একই আছে) — এবং মূল Design Report প্লানেও
    // brace কোনো section (G1-G5) এ নেই (শুধু beam/column/slab/wall/
    // footing)। তাই এই ফেজে brace ইচ্ছাকৃতভাবে unresolved রাখা হলো,
    // computeLineElementLength() এর সিগনেচার এখানে জোর করে বদলানোর
    // বদলে — সেটা design/analysis panel গুলোর জন্যও ব্যবহৃত একটা
    // shared ফাংশন, শুধু Documentation Engine এর সুবিধার জন্য তার
    // টাইপ শিথিল করা যথাযথ না।
    case "beam":
    case "column": {
      const section = sections.find((s) => s.sectionId === element.sectionId);
      const areaMm2 = sectionAreaMm2(section);
      if (areaMm2 === null) return null;
      const lengthM = computeLineElementLength(element);
      return (areaMm2 / 1_000_000) * lengthM; // mm² → m², × m length
    }
    case "slab":
    case "mat-foundation": {
      const areaM2 = computeHorizontalPolygonAreaM2(
        element.vertices.map((v) => ({ x: v.x, z: v.z }))
      );
      return areaM2 * (element.thickness / 1000);
    }
    case "footing": {
      return (element.width / 1000) * (element.length / 1000) * (element.thickness / 1000);
    }
    // wall/shear-wall/core-wall: vertical-plane polygon, কোনো general 3D area
    // calculator নেই এই কোডবেসে (উপরের docblock দেখুন) — unresolved.
    // combined-footing/strip-footing: width element এ নেই, DesignResult.detail
    // দরকার যা এখনো persist হয় না (Phase 11a gap) — unresolved.
    // pile/pile-cap/pile-group: এই ফেজের স্কোপের বাইরে — unresolved।
    default:
      return null;
  }
}

/**
 * DetailingResult.schedule (BarScheduleRow[], শুধু length/diameter/count
 * রাখে) কে BbsEntry (weight-সহ) এ রূপান্তর করে — কারণ Quantity Summary
 * এর steel অংশে ওজন লাগে, BarScheduleRow এ সেটা নেই।
 */
function barScheduleRowToBbsEntry(row: BarScheduleRow, elementLabel: string): BbsEntry {
  const unitWeightKgPerM = computeRebarUnitWeightKgPerM(row.diameterMm);
  const totalLengthM = row.totalLengthMm / 1000;
  return {
    barMark: row.barMark,
    elementLabel,
    shapeType: row.shape === "straight" ? "straight" : "stirrup-tie",
    barDiameterMm: row.diameterMm,
    count: row.count,
    cutLengthMm: row.cutLengthMm,
    totalLengthM,
    unitWeightKgPerM,
    totalWeightKg: totalLengthM * unitWeightKgPerM,
  };
}

export function computeQuantitySummary(context: ReportContext): QuantitySummary {
  // --- Concrete (grade+category-wise) ---
  const concreteMaterials = context.materials.materials.filter(
    (m): m is ConcreteMaterial => m.type === "concrete"
  );
  const volumeByKey = new Map<string, ConcreteQuantityRow>();
  const unresolvedCategories = new Set<ElementCategory>();
  let unresolvedElementCount = 0;

  for (const element of context.elements) {
    const volumeM3 = computeElementConcreteVolumeM3(element, context.sections.sections);
    if (volumeM3 === null) {
      unresolvedCategories.add(element.category);
      unresolvedElementCount += 1;
      continue;
    }
    const material = concreteMaterials.find((m) => m.materialId === element.materialId);
    // material না পাওয়া গেলে (ভুল/মুছে ফেলা materialId রেফারেন্স) এই element
    // "unresolved" হিসেবেই গণনা হওয়া উচিত — ভুল grade এ চুপচাপ যোগ করলে
    // রিপোর্টে ভুল তথ্য যাবে।
    if (!material) {
      unresolvedCategories.add(element.category);
      unresolvedElementCount += 1;
      continue;
    }
    const key = `${element.category}::${material.materialId}`;
    const existing = volumeByKey.get(key);
    if (existing) {
      existing.volumeM3 += volumeM3;
      existing.elementCount += 1;
    } else {
      volumeByKey.set(key, {
        category: element.category,
        materialId: material.materialId,
        materialName: material.name,
        fcMPa: material.fc,
        volumeM3,
        elementCount: 1,
      });
    }
  }

  const concreteByGradeAndCategory = Array.from(volumeByKey.values()).sort(
    (a, b) => a.category.localeCompare(b.category) || a.materialName.localeCompare(b.materialName)
  );
  const totalConcreteVolumeM3 = concreteByGradeAndCategory.reduce((sum, row) => sum + row.volumeM3, 0);

  // --- Steel (dia-wise, BBS থেকে aggregate) ---
  const allBbsEntries: BbsEntry[] = context.detailingResults.flatMap((detailing) =>
    detailing.schedule.map((row) => barScheduleRowToBbsEntry(row, detailing.elementLabel))
  );
  const diaSummary = summarizeBbsByDiameter(allBbsEntries);
  const steelByDiameter: SteelQuantityRow[] = diaSummary.map((s) => ({
    diameterMm: s.barDiameterMm,
    totalWeightKg: s.totalWeightKg,
    totalLengthM: s.totalLengthM,
  }));
  const totalSteelWeightKg = steelByDiameter.reduce((sum, row) => sum + row.totalWeightKg, 0);

  const unresolvedList = Array.from(unresolvedCategories);
  const note =
    unresolvedElementCount > 0
      ? `${unresolvedElementCount}টা element এর concrete volume এই সারাংশে যুক্ত করা যায়নি (category: ${unresolvedList.join(", ")}) — কারণের বিস্তারিত quantitySummary.ts এর docblock এ।`
      : null;

  return {
    concreteByGradeAndCategory,
    totalConcreteVolumeM3,
    steelByDiameter,
    totalSteelWeightKg,
    unresolvedElementCount,
    unresolvedCategories: unresolvedList,
    note,
  };
}
