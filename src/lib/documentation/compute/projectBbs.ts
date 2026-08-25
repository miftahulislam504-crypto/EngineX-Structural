/**
 * Project BBS Aggregator — Phase 11d
 *
 * প্লানের চাহিদা: "Grouping: element type অনুযায়ী section-wise ভাগ
 * (Beam বার, Column বার, Slab বার, Footing বার — আলাদা sub-table);
 * Element-wise subtotal + grand total (dia-ভিত্তিক ব্রেকডাউনও)"।
 *
 * DetailingResult[] (context.detailingResults, Phase 11a থেকে) এ প্রতিটা
 * element এর BarScheduleRow[] থাকে, কিন্তু সেটা BbsEntry না — ওজন
 * নেই, শুধু length/count/diameter। এই মডিউল সেই রূপান্তর করে, তারপর
 * category-wise group করে।
 *
 * বাগ-ফিক্স নোট (Phase 11c এ ধরা পড়েছে, এখানে ঠিক করা হলো):
 * quantitySummary.ts এর আগের barScheduleRowToBbsEntry() BarScheduleRow.shape
 * ("straight"|"stirrup"|"tie"|"L-bend"|"U-bend", ৫টা মান) কে ভুলভাবে
 * BbsShapeType ("straight"|"stirrup-tie", ২টা মান) এ ম্যাপ করছিল —
 * L-bend/U-bend দুটোই stirrup-tie তে silently collapse হচ্ছিল, যেটা
 * ভুল sketch icon দেখাত (L-bend আসলে "straight" এর কাছাকাছি, stirrup
 * এর মতো loop না)। barBendingSchedule.ts এর নিজস্ব কমেন্ট অনুযায়ী v1
 * detailing engine আসলে L-bend/U-bend কখনো produce করে না (শুধু
 * straight/stirrup/tie), তাই আজকের ডেটাতে এই bug এর প্রভাব শূন্য —
 * কিন্তু টাইপ-সঠিকভাবে হ্যান্ডল করা হলো যাতে ভবিষ্যতে detailing engine
 * এ L-bend/U-bend সাপোর্ট যোগ হলে এই কোড ভুল sketch না দেখায় (L-bend
 * কে "straight" ভিজ্যুয়াল ক্যাটাগরিতে রাখা হয়েছে, একটা isBent ফ্ল্যাগ
 * সহ যাতে caller চাইলে আলাদা করে চিহ্নিত করতে পারে)।
 */

import type { ReportContext } from "@/lib/documentation/reportContext";
import type { DetailingElementCategory, BarScheduleRow } from "@/lib/detailing/types";
import {
  computeRebarUnitWeightKgPerM,
  summarizeBbsByDiameter,
  computeTotalRebarWeightKg,
  type BbsEntry,
  type BbsSummaryByDiameter,
} from "@/lib/design/barBendingSchedule";

/** BbsEntry এর shapeType এর চেয়ে বেশি নির্দিষ্ট — sketch রেন্ডার করার সময় L-bend/U-bend আলাদা আইকন পাবে (Phase 11d এর নতুন sketch component), কিন্তু quantity গণনায় (weight/length) তারতম্য হয় না। */
export type BbsVisualShape = "straight" | "stirrup-tie" | "l-bend" | "u-bend";

export interface EnrichedBbsEntry extends BbsEntry {
  category: DetailingElementCategory;
  visualShape: BbsVisualShape;
}

export interface BbsCategoryGroup {
  category: DetailingElementCategory;
  entries: EnrichedBbsEntry[];
  subtotalWeightKg: number;
}

export interface ProjectBbs {
  groups: BbsCategoryGroup[];
  allEntries: EnrichedBbsEntry[];
  diameterSummary: BbsSummaryByDiameter[];
  grandTotalWeightKg: number;
}

function toVisualShape(shape: BarScheduleRow["shape"]): BbsVisualShape {
  switch (shape) {
    case "straight":
      return "straight";
    case "stirrup":
    case "tie":
      return "stirrup-tie";
    case "L-bend":
      return "l-bend";
    case "U-bend":
      return "u-bend";
  }
}

function rowToEnrichedEntry(
  row: BarScheduleRow,
  elementLabel: string,
  category: DetailingElementCategory
): EnrichedBbsEntry {
  const unitWeightKgPerM = computeRebarUnitWeightKgPerM(row.diameterMm);
  const totalLengthM = row.totalLengthMm / 1000;
  return {
    barMark: row.barMark,
    elementLabel,
    shapeType: row.shape === "straight" || row.shape === "L-bend" ? "straight" : "stirrup-tie",
    barDiameterMm: row.diameterMm,
    count: row.count,
    cutLengthMm: row.cutLengthMm,
    totalLengthM,
    unitWeightKgPerM,
    totalWeightKg: totalLengthM * unitWeightKgPerM,
    category,
    visualShape: toVisualShape(row.shape),
  };
}

const CATEGORY_ORDER: DetailingElementCategory[] = [
  "beam",
  "column",
  "slab",
  "wall",
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
  "pile-cap",
];

/**
 * context.detailingResults থেকে পুরো প্রজেক্টের BBS বানায় — category-wise
 * group করা, প্রতিটা group এ subtotal, শেষে dia-wise summary ও grand
 * total। BBS PDF sheet (S-10/annexure), BBS XLSX export, এবং Quantity
 * Summary (Section I) — এই তিনটাই ভবিষ্যতে এই একই ফাংশন থেকে ডেটা
 * নেবে (quantitySummary.ts আপাতত নিজের ভেতরে একই লজিক ডুপ্লিকেট করে
 * রেখেছে ঐতিহাসিক কারণে — Phase 11c এ লেখা, এই মডিউলের আগে; পরবর্তী
 * refactor এ quantitySummary.ts কেও এটা ব্যবহার করানো উচিত)।
 */
export function buildProjectBbs(context: ReportContext): ProjectBbs {
  const allEntries: EnrichedBbsEntry[] = context.detailingResults.flatMap((detailing) =>
    detailing.schedule.map((row) =>
      rowToEnrichedEntry(row, detailing.elementLabel, detailing.category)
    )
  );

  const byCategory = new Map<DetailingElementCategory, EnrichedBbsEntry[]>();
  for (const entry of allEntries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const groups: BbsCategoryGroup[] = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map(
    (category) => {
      const entries = byCategory.get(category)!;
      return {
        category,
        entries,
        subtotalWeightKg: computeTotalRebarWeightKg(entries),
      };
    }
  );

  return {
    groups,
    allEntries,
    diameterSummary: summarizeBbsByDiameter(allEntries),
    grandTotalWeightKg: computeTotalRebarWeightKg(allEntries),
  };
}

export const CATEGORY_LABEL: Record<DetailingElementCategory, string> = {
  beam: "Beam",
  column: "Column",
  slab: "Slab",
  wall: "Wall",
  stair: "Stair",
  footing: "Footing",
  "combined-footing": "Combined Footing",
  "strip-footing": "Strip Footing",
  "mat-foundation": "Mat Foundation",
  "pile-cap": "Pile Cap",
};
