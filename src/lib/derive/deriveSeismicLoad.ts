/**
 * deriveSeismicLoad.ts — Hub-এর BNBC settings + geometry + model-এর
 * dead-load থেকে SeismicLoadInput তৈরি করে computeSeismicLoad() কল
 * করার pure derivation layer।
 * ------------------------------------------------------------------
 * deriveWindLoad.ts এর সহোদর ফাইল — একই কারণ (Miftahul এর অনুরোধ:
 * "wind ও earthquake এর ইনফরমেশন গুলো Hub থেকে আসবে তাহলেই অটোমেটিক
 * হয়ে যাবে")।
 *
 * seismicZone ম্যাপিং:
 *   HubBnbcSettingsData.seismicZone হলো "Z1"|"Z2"|"Z3"|"Z4" (BNBC এর
 *   নিজস্ব নামকরণ), autoReanalysisLoop.ts/useHubAnalysisSuggestions.ts
 *   এ প্রতিষ্ঠিত কনভেনশন অনুযায়ী "Z" prefix বাদ দিয়ে সরাসরি
 *   SeismicZone ("1"|"2"|"3"|"4") এ ব্যবহার করা হচ্ছে — নতুন কোনো
 *   ভিন্ন convention চালু করা হয়নি, existing pattern অনুসরণ করা হলো।
 *
 * siteClass ম্যাপিং:
 *   deriveSiteClass.ts (Phase 1, আগে থেকেই আছে) পুনঃব্যবহার করা
 *   হয়েছে — সেই ফাইলের honest confidence-flag pattern এখানেও বজায়
 *   থাকে (নতুন conversion logic তৈরি করা হয়নি, duplicate না)।
 *
 * occupancyCategory ম্যাপিং:
 *   HubBnbcSettingsData.riskCategory ("I"|"II"|"III"|"IV") সরাসরি এই
 *   App-এর OccupancyCategory ("I"|"II"|"III"|"IV") এর সাথে হুবহু মেলে
 *   — দুটোই একই ASCE 7 / BNBC 2020 Table 1.5-1 এর Risk Category
 *   ধারণা, তাই কোনো lossy conversion দরকার নেই (occupancyType
 *   "A"-"F" ব্যবহার করা হয়নি — সেটা ভিন্ন, ভবন ব্যবহার-প্রকৃতির
 *   classification, riskCategory ইতিমধ্যেই সরাসরি প্রযোজ্য মান)।
 *
 * structuralSystem ম্যাপিং:
 *   HubBnbcSettingsData.structuralSystem একটা free-text string (Hub-এ
 *   কোনো নির্দিষ্ট enum পাওয়া যায়নি — hub-module-shapes.ts এ শুধু
 *   `string` টাইপ, কোনো enum রেফারেন্স নেই)। তাই এখানে conservative
 *   keyword-matching করা হচ্ছে ("shear"/"wall" থাকলে shear-wall,
 *   "steel" থাকলে moment-frame-steel, "dual" থাকলে dual-system, নাহলে
 *   ডিফল্ট moment-frame-concrete — বাংলাদেশে RC moment frame সবচেয়ে
 *   প্রচলিত সিস্টেম)। এটা সবসময় "approximate" confidence — string
 *   matching কখনো নিশ্চিত (confirmed) হতে পারে না, Hub-এ প্রকৃত enum
 *   যোগ হলে এই ফাইল আপডেট করা উচিত।
 *
 * seismicWeight — BNBC 2020 সাধারণত dead load + storage/heavy-occupancy
 *   এর জন্য live load এর একাংশ (২৫%) ধরে (deriveSelfWeightLoads.ts এর
 *   হেডার কমেন্টেও উল্লেখ আছে)। এই ফাইলে শুধু dead load byপাশ করা
 *   হচ্ছে (live load এখনো element-এ apply করা options এই phase এ নেই
 *   — Step 3 এ deriveLiveLoad যোগ হলে এই ফাংশন আপডেট হবে) — তাই
 *   ফলাফল conservative-না, বরং সামান্য under-estimate হতে পারে,
 *   warning এ স্পষ্ট বলা আছে।
 */

import type { SeismicLoadInput, SeismicLoadResult, StructuralSystem } from "@/lib/loads/seismicLoad";
import { computeSeismicLoad } from "@/lib/loads/seismicLoad";
import type { HubBnbcSettingsData, HubSiteInfoData } from "@/lib/hub/hub-module-shapes";
import type { GeometryCore } from "@/lib/types/geometry";
import type { StructuralElement } from "@/lib/types/element";
import { computeLineElementLength } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";
import { deriveSiteClass } from "@/lib/derive/deriveSiteClass";
import type { DerivationConfidence } from "@/lib/derive/deriveWindLoad";

export interface DerivedSeismicLoadInput {
  input: SeismicLoadInput | null;
  confidence: DerivationConfidence;
  warnings: string[];
}

export interface DerivedSeismicLoadResult extends DerivedSeismicLoadInput {
  result: SeismicLoadResult | null;
}

/** Hub এর free-text structuralSystem কে এই App এর StructuralSystem enum এ conservative keyword-matching দিয়ে map করে। */
function mapStructuralSystem(hubValue: string): StructuralSystem {
  const v = hubValue.toLowerCase();
  if (v.includes("dual")) return "dual-system";
  if (v.includes("shear") || v.includes("wall")) return "shear-wall-concrete";
  if (v.includes("steel")) return "moment-frame-steel";
  return "moment-frame-concrete"; // বাংলাদেশে সবচেয়ে প্রচলিত, সুস্পষ্ট keyword না মিললে conservative-not-unsafe ডিফল্ট
}

/** stories থেকে building height ও storey count (deriveWindLoad.ts এর computeBuildingHeight এর সাথে হুবহু একই যুক্তি — duplicate না করে এই ছোট helper আলাদাভাবে রাখা হলো কারণ cross-import করলে unnecessary coupling হতো)। */
function computeBuildingHeight(geometry: GeometryCore): { height: number; numberOfStories: number } | null {
  if (geometry.stories.length === 0) return null;
  const topStory = geometry.stories.reduce((top, s) => (s.elevation > top.elevation ? s : top));
  const height = topStory.elevation + topStory.height;
  const numberOfStories = geometry.stories.filter((s) => !s.isBaseLevel).length || geometry.stories.length;
  if (height <= 0) return null;
  return { height, numberOfStories };
}

/**
 * সব Beam/Column element এর total dead weight (kN) হিসাব করে —
 * deriveSelfWeightLoads.ts এর ঠিক একই material/section resolution
 * logic, কিন্তু এখানে LoadCase array না, শুধু একটা scalar sum দরকার
 * (seismicWeight input হিসেবে ব্যবহারের জন্য), তাই আলাদা lightweight
 * ফাংশন — deriveSelfWeightLoads() নিজে না ডেকে duplicate করা হলো যাতে
 * এই ফাইল LoadCase তৈরির (Firestore id generation ইত্যাদি) সাথে
 * অপ্রয়োজনীয়ভাবে coupled না হয়।
 */
function computeTotalDeadWeightKN(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): { totalWeightKN: number; skippedCount: number } {
  let totalWeightKN = 0;
  let skippedCount = 0;

  const lineElements = elements.filter((e) => e.category === "beam" || e.category === "column");

  for (const element of lineElements) {
    const material = materials.find((m) => m.materialId === element.materialId);
    const section = sections.find((s) => s.sectionId === element.sectionId);
    if (!material || !section) {
      skippedCount += 1;
      continue;
    }

    let properties;
    try {
      properties = computeSectionProperties(section);
    } catch {
      skippedCount += 1;
      continue;
    }

    const unitWeight = material.type === "composite" ? material.effectiveUnitWeight : material.unitWeight;
    const lengthM = computeLineElementLength(element);
    if (lengthM <= 0) {
      skippedCount += 1;
      continue;
    }

    const areaM2 = properties.area / 1e6;
    totalWeightKN += areaM2 * unitWeight * lengthM;
  }

  return { totalWeightKN, skippedCount };
}

/**
 * Hub BNBC settings + site info + geometry + model elements থেকে
 * SeismicLoadInput derive করে। প্রয়োজনীয় geometry (height) না থাকলে,
 * অথবা কোনো Beam/Column element না থাকলে (seismicWeight শূন্য/অর্থহীন
 * হবে) input: null রিটার্ন করে।
 */
export function deriveSeismicLoadInput(
  hubBnbc: HubBnbcSettingsData,
  hubSiteInfo: HubSiteInfoData | null,
  geometry: GeometryCore,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): DerivedSeismicLoadInput {
  const warnings: string[] = [];

  const heightInfo = computeBuildingHeight(geometry);
  if (!heightInfo) {
    return {
      input: null,
      confidence: "insufficient-data",
      warnings: ["Seismic load auto-calculate করতে কমপক্ষে ১টা story দরকার — Geometry ট্যাবে story যোগ করুন।"],
    };
  }

  const { totalWeightKN, skippedCount } = computeTotalDeadWeightKN(elements, materials, sections);
  if (totalWeightKN <= 0) {
    return {
      input: null,
      confidence: "insufficient-data",
      warnings: ["Seismic load auto-calculate করতে কমপক্ষে ১টা Beam/Column element (dead weight হিসাবের জন্য) দরকার — Elements ট্যাবে element যোগ করুন।"],
    };
  }
  if (skippedCount > 0) {
    warnings.push(
      `seismicWeight হিসাবে ${skippedCount}টা element বাদ পড়েছে (material/section resolve করা যায়নি) — মোট weight প্রকৃতের চেয়ে কম হতে পারে।`
    );
  }
  warnings.push(
    "seismicWeight শুধু Beam/Column এর dead (self-weight) থেকে হিসাব করা হয়েছে — Slab/Wall dead load এবং BNBC 2020 অনুযায়ী storage occupancy এর জন্য live load এর অংশ (সাধারণত ২৫%) এখনো এই হিসাবে যোগ হয়নি, তাই মোট বেস শিয়ার প্রকৃতের চেয়ে কম আসতে পারে।"
  );

  const siteClassResult = hubSiteInfo ? deriveSiteClass(hubSiteInfo.soilType) : deriveSiteClass(hubBnbc.soilType);
  warnings.push(siteClassResult.note);

  const structuralSystem = mapStructuralSystem(hubBnbc.structuralSystem);
  warnings.push(
    `Structural System 'Hub: "${hubBnbc.structuralSystem}"' থেকে '${structuralSystem}' অনুমান করা হয়েছে (keyword matching — Hub এ নির্দিষ্ট enum নেই)। ভুল হলে ম্যানুয়ালি সংশোধন করুন, কারণ Response Modification Factor (R) সরাসরি এর ওপর নির্ভর করে।`
  );

  const input: SeismicLoadInput = {
    seismicZone: hubBnbc.seismicZone.replace("Z", "") as SeismicLoadInput["seismicZone"],
    siteClass: siteClassResult.siteClass,
    structuralSystem,
    occupancyCategory: hubBnbc.riskCategory,
    buildingHeight: heightInfo.height,
    seismicWeight: totalWeightKN,
    numberOfStories: heightInfo.numberOfStories,
  };

  // structuralSystem keyword-matching নিজেই সবসময় approximate করে
  // তোলে (siteClass আলাদাভাবে confirmed হলেও) — তাই সামগ্রিক input
  // confidence সবসময় "approximate", কখনো "confirmed" না।
  const confidence: DerivationConfidence = "approximate";

  return { input, confidence, warnings };
}

/** derive + compute একসাথে — caller সরাসরি ফলাফল ব্যবহার করতে পারবে। */
export function deriveSeismicLoad(
  hubBnbc: HubBnbcSettingsData,
  hubSiteInfo: HubSiteInfoData | null,
  geometry: GeometryCore,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[]
): DerivedSeismicLoadResult {
  const derived = deriveSeismicLoadInput(hubBnbc, hubSiteInfo, geometry, elements, materials, sections);
  if (!derived.input) {
    return { ...derived, result: null };
  }
  return { ...derived, result: computeSeismicLoad(derived.input) };
}
