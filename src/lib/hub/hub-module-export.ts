/**
 * hub-module-export.ts — Structural → Hub outgoing sync (Phase 6)
 * ------------------------------------------------------------------
 * EngineXEstimate-এর lib/services/hub-module-export.ts এর প্রমাণিত
 * pattern অনুসরণ করা হয়েছে (prepareHubExport/pushHubExport আলাদা রাখা
 * — prepare কখনো নিজে push করে না, UI আগে preview দেখাতে পারবে)।
 *
 * Hub-এর StructuralModuleData (../hub/module-data.types.ts, Hub থেকে
 * port করা) এ ২০টা field আছে। এই ফাইল তার মধ্যে ৭টা পূরণ করে existing
 * compute module থেকে (কোনো নতুন data-entry UI ছাড়া) — বাকি ১৩টা
 * ইচ্ছাকৃতভাবে undefined থাকে, কারণ Structural app-এ এই মুহূর্তে এর
 * কোনো ডেটা সোর্সই নেই (Estimate-এর activityWiseCost এর মতোই একই
 * সৎ প্যাটার্ন — না থাকা জিনিস অনুমান করে ভরাট করা হয়নি):
 *
 *   - formworkQuantities, excavationQuantities, backfillQuantities —
 *     কোনো formwork-area/excavation-volume calculator এই কোডবেসে
 *     নেই (grep করে যাচাই করা হয়েছে — শুধু deprecated hub-outgoing.ts
 *     স্কেলেটনে field নাম হিসেবে ছিল, কোনো implementation না)।
 *   - structuralSteelQuantities — এই app শুধু RC (Reinforced Concrete)
 *     design করে (barBendingSchedule.ts, quantitySummary.ts সব RC-
 *     ভিত্তিক); steel-frame structural steel takeoff আলাদা, নেই।
 *   - shopDrawingRevision, shopDrawingStatus, inspectionStages,
 *     inspectionStatus, structuralActivities, castingSequence,
 *     structuralMilestones, foundationSequence, designRevision —
 *     এগুলো construction-management/scheduling concept, যা এই design/
 *     analysis app-এর স্কোপে নেই (CPMS/PM app-এর কাজ, Estimate-এর
 *     activityWiseCost না-থাকার মতোই একই যুক্তি)।
 *   - wasteFactors — কোনো waste-factor input/config এই app-এ নেই।
 *
 * ⚠️ concreteQuantities ও beamColumnSlabQuantities+foundationQuantities
 * — তিনটাই computeQuantitySummary()-র একই concreteByGradeAndCategory
 * থেকে আসে (শুধু ভিন্নভাবে group করা — Hub-এর schema দুই আকারেই field
 * চায়, Estimate-এর boq/finalBoq duplicate এর মতো একই কারণে)। Hub-এর
 * schema তাদের আলাদা field হিসেবে চেয়েছে বলে দুই/তিন জায়গাতেই বসানো
 * হচ্ছে, ডুপ্লিকেট মনে হলেও এটা Hub-এর contract মেনে চলার জন্য প্রয়োজনীয়।
 * একইভাবে reinforcementQuantities = bbs (diameterSummary), materialSummary
 * = concreteQuantities+bbs একসাথে (এই app-এ আলাদা কোনো "material
 * summary" কনসেপ্ট নেই, তাই দুটোর সমন্বয়)। materialDemand ইচ্ছাকৃতভাবে
 * undefined — এটা conceptually "কতটুকু লাগবে ভবিষ্যতে" (procurement-এর
 * মতো), যেখানে concreteQuantities/reinforcementQuantities হলো "এই
 * মুহূর্তে ডিজাইন অনুযায়ী কতটুকু আছে" — দুটো ভিন্ন জিনিস, ভুলভাবে
 * alias করা ঠিক হবে না (Estimate-এর materialDemand=materialRequirement
 * alias এর মতো সরাসরি এক না, কারণ ওখানে সত্যিই একই ডেটা ছিল)।
 *
 * computeQuantitySummary() এর unresolvedElementCount/note (element.ts
 * এর কিছু category এখনো volume-হিসাবযোগ্য না — combined-footing,
 * strip-footing, wall ইত্যাদি, quantitySummary.ts এর docblock দেখুন)
 * সরাসরি HubModuleExportResult.warnings এ propagate করা হয়, চুপচাপ
 * বাদ দেওয়া হয় না — Hub-এর দিকে যে সংখ্যা যাচ্ছে সেটা সম্পূর্ণ কিনা
 * তা downstream app (Estimate/PM) জানতে পারবে।
 */

import { buildReportContext } from "@/lib/documentation/reportContext";
import { computeQuantitySummary, type QuantitySummary } from "@/lib/documentation/compute/quantitySummary";
import { buildProjectBbs, type ProjectBbs } from "@/lib/documentation/compute/projectBbs";
import { bumpOwnModuleVersion, saveOwnModuleData } from "@/lib/hub/hub-sdk-client";
import type { StructuralModuleData } from "@/lib/hub/module-data.types";
import type { ElementCategory } from "@/lib/types/element";

const BEAM_COLUMN_SLAB_CATEGORIES: ElementCategory[] = ["beam", "column", "slab"];
const FOUNDATION_CATEGORIES: ElementCategory[] = [
  "footing",
  "combined-footing",
  "strip-footing",
  "mat-foundation",
];
// লক্ষ্য করুন: "pile", "wall", "shear-wall", "core-wall", "brace" কোনো
// গ্রুপেই নেই — Hub-এর schema তে এদের জন্য আলাদা কোনো field নেই
// (beamColumnSlabQuantities/foundationQuantities শুধু এই ৭টা category
// কভার করে), তাই এদের ভলিউম (যদি resolve হয়) concreteQuantities এর
// সামগ্রিক summary তে থাকবে কিন্তু এই দুই sub-group এর কোনোটাতেই
// আলাদা করে ভাগ হবে না। quantitySummary.ts এর docblock অনুযায়ী wall
// category এমনিতেও এই মুহূর্তে unresolved (কোনো 3D polygon area
// calculator নেই), তাই এই মুহূর্তে বাস্তবিক প্রভাব সীমিত।

export interface HubModuleExportResult {
  data: StructuralModuleData;
  /** Hub-এর কোন field আজ ডেটার অভাবে খালি রয়ে গেছে — এই ফাইলের হেডার কমেন্টে তালিকাভুক্ত ১৩টা field সবসময় এখানে থাকবে (এই app-এ এদের কোনো সোর্স নেই), বাকিগুলো conditional (BBS/quantity summary খালি থাকলে)। */
  emptyFields: (keyof StructuralModuleData)[];
  /** emptyFields এর চেয়ে বেশি প্রেক্ষাপট দরকার এমন নোট (আংশিক ডেটা — সম্পূর্ণ খালি না কিন্তু কিছু element unresolved)। */
  warnings: string[];
}

const ALWAYS_EMPTY_FIELDS: (keyof StructuralModuleData)[] = [
  "formworkQuantities",
  "excavationQuantities",
  "backfillQuantities",
  "structuralSteelQuantities",
  "shopDrawingRevision",
  "wasteFactors",
  "structuralActivities",
  "castingSequence",
  "structuralMilestones",
  "shopDrawingStatus",
  "inspectionStages",
  "materialDemand",
  "foundationSequence",
  "inspectionStatus",
  "designRevision",
];

function groupConcreteByCategories(
  quantitySummary: QuantitySummary,
  categories: ElementCategory[]
): QuantitySummary["concreteByGradeAndCategory"] {
  return quantitySummary.concreteByGradeAndCategory.filter((row) => categories.includes(row.category));
}

/**
 * প্রজেক্টের সব compute module (Design Report Section I/BBS engine —
 * নতুন কোনো data-entry UI ছাড়া) থেকে ডেটা নিয়ে Hub-এর
 * StructuralModuleData shape এ সাজিয়ে দেয়। নিজে saveOwnModuleData()
 * কল করে না — ঠিক Estimate-এর prepareHubExport() এর মতোই prepare/push
 * আলাদা রাখা হয়েছে।
 */
export async function prepareHubExport(projectId: string): Promise<HubModuleExportResult> {
  const emptyFields: (keyof StructuralModuleData)[] = [...ALWAYS_EMPTY_FIELDS];
  const warnings: string[] = [];

  const context = await buildReportContext(projectId);
  const quantitySummary = computeQuantitySummary(context);
  const bbs: ProjectBbs = buildProjectBbs(context);

  if (quantitySummary.note) {
    warnings.push(`concreteQuantities/beamColumnSlabQuantities/foundationQuantities: ${quantitySummary.note}`);
  }
  if (quantitySummary.concreteByGradeAndCategory.length === 0) {
    emptyFields.push("concreteQuantities", "beamColumnSlabQuantities", "foundationQuantities");
  }
  if (bbs.allEntries.length === 0) {
    emptyFields.push("reinforcementQuantities", "bbs");
    warnings.push("bbs/reinforcementQuantities: কোনো detailing result নেই — Detailing ট্যাব থেকে অন্তত একটা element এর rebar detailing generate করুন।");
  }
  if (quantitySummary.concreteByGradeAndCategory.length === 0 && bbs.allEntries.length === 0) {
    emptyFields.push("materialSummary");
  }

  const beamColumnSlabQuantities = groupConcreteByCategories(quantitySummary, BEAM_COLUMN_SLAB_CATEGORIES);
  const foundationQuantities = groupConcreteByCategories(quantitySummary, FOUNDATION_CATEGORIES);

  const data: StructuralModuleData = {
    concreteQuantities: quantitySummary.concreteByGradeAndCategory.length > 0 ? quantitySummary : undefined,
    reinforcementQuantities: bbs.allEntries.length > 0 ? bbs.diameterSummary : undefined,
    formworkQuantities: undefined, // ফাইল-শীর্ষ নোট দ্রষ্টব্য
    excavationQuantities: undefined,
    backfillQuantities: undefined,
    foundationQuantities: foundationQuantities.length > 0 ? foundationQuantities : undefined,
    beamColumnSlabQuantities: beamColumnSlabQuantities.length > 0 ? beamColumnSlabQuantities : undefined,
    structuralSteelQuantities: undefined,
    shopDrawingRevision: undefined,
    wasteFactors: undefined,

    bbs: bbs.allEntries.length > 0 ? bbs : undefined,
    materialSummary:
      quantitySummary.concreteByGradeAndCategory.length > 0 || bbs.allEntries.length > 0
        ? { concreteByGradeAndCategory: quantitySummary.concreteByGradeAndCategory, steelByDiameter: bbs.diameterSummary }
        : undefined,
    structuralActivities: undefined,
    castingSequence: undefined,
    structuralMilestones: undefined,
    shopDrawingStatus: undefined,
    inspectionStages: undefined,
    materialDemand: undefined,
    foundationSequence: undefined,
    inspectionStatus: undefined,
    designRevision: undefined,
  };

  return { data, emptyFields, warnings };
}

/**
 * prepareHubExport()-এর ফলাফল Hub-এ প্রকাশ করে — version bump
 * (bumpOwnModuleVersion, যা নিজেই MODULE_VERSION_BUMPED event emit
 * করে, dependency.firestore.ts) তারপর saveOwnModuleData()। এই ফাংশন
 * UI-এর "Hub-এ পাঠান" বাটনে কল হবে, prepare-এর ফলাফল আগে preview
 * হিসেবে দেখানোর পর — Estimate-এর pushHubExport() এর একই প্যাটার্ন।
 */
export async function pushHubExport(projectId: string, data: StructuralModuleData): Promise<number> {
  const newVersion = await bumpOwnModuleVersion(projectId);
  await saveOwnModuleData(projectId, data as Record<string, unknown>, newVersion);
  return newVersion;
}
