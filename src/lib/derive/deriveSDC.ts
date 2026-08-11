/**
 * deriveSDC — Seismic Design Category + unified seismic parameter
 * derivation থেকে Hub-এর primary data (occupancy, site class, zone)।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 3 আইটেম: "deriveSDC(occupancy, siteClass, zone)"।
 *
 * ⚠️ গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত — Hub vs local table:
 *
 * Hub-এর bnbc_settings document (HubBnbcSettingsData) ইতিমধ্যে নিজে
 * Z/I/S/Ss/R হিসাব করে ফেলে (seismicZoneCoeff, importanceFactor,
 * spectralAcceleration, responseModFactor)। এই ফাইলের ফাংশনগুলো তাই
 * দুই মোডে কাজ করে:
 *
 *   1. Hub থেকে ইতিমধ্যে গণনাকৃত মান থাকলে (bnbcSettings দেওয়া হলে) —
 *      সেগুলোই primary source of truth হিসেবে ব্যবহার হয়, local
 *      টেবিল থেকে recompute করা হয় না। এতে দুই app-এর মধ্যে ভিন্ন
 *      ফলাফল আসার ঝুঁকি থাকে না।
 *   2. শুধু occupancy/siteClass/zone দেওয়া হলে (Hub bnbcSettings
 *      অনুপস্থিত, বা standalone ব্যবহার) — লোকাল BNBC টেবিল থেকে
 *      হিসাব করা হয় (Hub-এর lib/types/bnbc.types.ts এর সাথে
 *      cross-verified মান ব্যবহার করে, নিচে দেখুন)।
 *
 * 🔴 CROSS-APP DATA DRIFT পাওয়া গেছে (Phase 0-2 verification-এর
 * সময়, এই Phase-এ ধরা পড়েছে) — ঠিক করা হয়নি, শুধু flag করা হলো:
 *
 * Structural-এর seismicLoad.ts এর getResponseModificationFactor()
 * এ shear-wall-concrete → R=5, কিন্তু Hub-এর bnbc.types.ts এর
 * STRUCTURAL_SYSTEMS এ "RC Shear Wall" → R=6.0। কোনো comment এ এই
 * পার্থক্যের BNBC টেবিল রেফারেন্স নেই কোনো ফাইলে — মনে হচ্ছে
 * ইচ্ছাকৃত না, দুই app আলাদাভাবে লেখার সময় drift হয়েছে। এই ফাইলে
 * Hub-এর মান (৬.০) কে authoritative ধরা হলো যখন Hub থেকে R আসে,
 * কিন্তু Structural-এর নিজস্ব seismicLoad.ts এখনো পুরনো ৫ ব্যবহার
 * করছে — এই দুটো ফাইলের মধ্যে অসামঞ্জস্য আছে, একজন ইঞ্জিনিয়ারকে
 * BNBC 2020 Table 6.2.19 দেখে কোনটা সঠিক তা নিশ্চিত করতে হবে এবং
 * seismicLoad.ts টা সেই অনুযায়ী আপডেট করতে হবে (এই Phase-এর স্কোপে
 * এটা ঠিক করা হয়নি — শুধু এখানে নথিভুক্ত)।
 */

import type { OccupancyCategory, SiteClass, SeismicZone, StructuralSystem } from "@/lib/loads/seismicLoad";
import type { HubBnbcSettingsData } from "@/lib/hub/hub-module-shapes";

export type SeismicDesignCategory = "A" | "B" | "C" | "D" | "E" | "F";

export interface DeriveSDCInput {
  occupancyCategory: OccupancyCategory;
  siteClass: SiteClass;
  seismicZone: SeismicZone;
  /**
   * ঐচ্ছিক — Hub থেকে সরাসরি bnbc_settings document পাওয়া গেলে দিন।
   * দিলে, এই ফাংশন Hub-এর pre-computed spectralAcceleration/Z/I/R
   * ব্যবহার করবে (স্থানীয় টেবিল থেকে recompute করবে না)।
   */
  hubBnbcSettings?: HubBnbcSettingsData;
  structuralSystem?: StructuralSystem;
}

export interface DerivedSeismicParameters {
  seismicDesignCategory: SeismicDesignCategory;
  seismicZoneCoefficient: number; // Z
  importanceFactor: number; // I
  responseModificationFactor?: number; // R — structuralSystem দেওয়া থাকলেই পাওয়া যায়
  shortPeriodSpectralAcceleration: number; // Ss (g)
  source: "hub" | "local-table";
  warnings: string[];
}

/** BNBC 2020 Table 6.2.19-এর কাছাকাছি সরলীকৃত SDC নির্ণয় — Ss (short-period spectral acceleration) ও Risk/Occupancy Category-এর উপর ভিত্তি করে। */
function lookupSDC(Ss: number, occupancy: OccupancyCategory): SeismicDesignCategory {
  // Risk Category I-II-III vs IV — BNBC/ASCE 7 উভয়েই Category IV
  // (occupancy IV, essential facility) একই Ss-এ এক ধাপ কঠোর SDC পায়।
  const isEssential = occupancy === "IV";

  if (Ss < 0.167) return isEssential ? "B" : "A";
  if (Ss < 0.33) return isEssential ? "C" : "B";
  if (Ss < 0.5) return isEssential ? "D" : "C";
  // Ss ≥ 0.5 — Bangladesh-এর Zone 3/4 এ সাধারণ, D এর নিচে নামে না
  return "D";
  // লক্ষ্য করুন: E/F শুধু নির্দিষ্ট near-fault বা special-study সাইটে
  // প্রযোজ্য (S1 ≥ 0.75g জাতীয় শর্তে) — এই সরলীকৃত সংস্করণ সেই
  // শর্ত চেক করে না, তাই সবসময় D-তে cap হয়। উচ্চ ঝুঁকির Zone 4 +
  // নরম মাটির (SE) কম্বিনেশনে ইঞ্জিনিয়ারের ম্যানুয়াল যাচাই আবশ্যক।
}

/**
 * সম্পূর্ণ seismic parameter set derive করে। Hub থেকে
 * pre-computed bnbcSettings পাওয়া গেলে সেটাই primary source,
 * নাহলে local BNBC টেবিল থেকে হিসাব করে।
 */
export function deriveSDC(input: DeriveSDCInput): DerivedSeismicParameters {
  const warnings: string[] = [];

  if (input.hubBnbcSettings) {
    const hub = input.hubBnbcSettings;
    const Ss = hub.spectralAcceleration;
    const sdc = lookupSDC(Ss, input.occupancyCategory);

    if (hub.occupancyType && hub.riskCategory !== riskCategoryFromOccupancy(input.occupancyCategory)) {
      warnings.push(
        `Hub-এর riskCategory ("${hub.riskCategory}") ইনপুটে দেওয়া occupancyCategory ("${input.occupancyCategory}") থেকে ভিন্ন হতে পারে — Hub-এর মানকেই primary ধরা হয়েছে, নিশ্চিত করুন কোনটা সাম্প্রতিক।`
      );
    }

    return {
      seismicDesignCategory: sdc,
      seismicZoneCoefficient: hub.seismicZoneCoeff,
      importanceFactor: hub.importanceFactor,
      responseModificationFactor: hub.responseModFactor,
      shortPeriodSpectralAcceleration: Ss,
      source: "hub",
      warnings,
    };
  }

  // Hub data নেই — local BNBC টেবিল থেকে হিসাব (Hub-এর
  // lib/types/bnbc.types.ts এর সাথে cross-verified মান)।
  const Z = getLocalZoneCoefficient(input.seismicZone);
  const I = getLocalImportanceFactor(input.occupancyCategory);
  const Fa = getLocalSiteAmplification(input.siteClass);
  const Ss = Z * Fa * 2.5; // Hub-এর getSpectralAcceleration() এর same formula (Z * Fa * 2.5)

  const sdc = lookupSDC(Ss, input.occupancyCategory);

  let R: number | undefined;
  if (input.structuralSystem) {
    R = getLocalResponseModificationFactor(input.structuralSystem);
    warnings.push(
      "R (Response Modification Factor) Structural app-এর নিজস্ব seismicLoad.ts টেবিল থেকে নেওয়া হয়েছে — Hub-এর STRUCTURAL_SYSTEMS টেবিলের সাথে shear-wall-concrete এর মান অমিল আছে (৫ বনাম ৬), নিশ্চিত হয়ে ব্যবহার করুন।"
    );
  }

  warnings.push(
    "Hub bnbc_settings পাওয়া যায়নি — এই ফলাফল local BNBC টেবিল থেকে গণনা করা হয়েছে, Hub-এর সাথে project-level সিঙ্ক না হওয়া পর্যন্ত এটা preliminary।"
  );

  return {
    seismicDesignCategory: sdc,
    seismicZoneCoefficient: Z,
    importanceFactor: I,
    responseModificationFactor: R,
    shortPeriodSpectralAcceleration: Ss,
    source: "local-table",
    warnings,
  };
}

/** occupancyCategory (I-IV) থেকে Hub-এর riskCategory স্কিমে map — দুটো টাইপ ইতিমধ্যে identical ("I"|"II"|"III"|"IV"), শুধু cross-check-এর জন্য explicit রাখা হলো। */
function riskCategoryFromOccupancy(occ: OccupancyCategory): HubBnbcSettingsData["riskCategory"] {
  return occ;
}

/** Hub-এর SEISMIC_ZONES টেবিলের সাথে cross-verified (bnbc.types.ts) — মান হুবহু মেলে। */
function getLocalZoneCoefficient(zone: SeismicZone): number {
  const zoneMap: Record<SeismicZone, number> = { "1": 0.12, "2": 0.2, "3": 0.28, "4": 0.36 };
  return zoneMap[zone];
}

/** Hub-এর getImportanceFactor()-এর সাথে হুবহু মেলে (bnbc.types.ts)। */
function getLocalImportanceFactor(occupancy: OccupancyCategory): number {
  const iMap: Record<OccupancyCategory, number> = { I: 1.0, II: 1.0, III: 1.25, IV: 1.5 };
  return iMap[occupancy];
}

/** Structural-এর seismicLoad.ts এর getSiteAmplificationFactor()-এর সাথে হুবহু মেলে (SiteClass স্কেলে, Hub-এর soilType স্কেলে না — deriveSiteClass.ts দিয়ে আগে convert করা থাকতে হবে)। */
function getLocalSiteAmplification(siteClass: SiteClass): number {
  const factorMap: Record<SiteClass, number> = { SA: 0.8, SB: 1.0, SC: 1.2, SD: 1.5, SE: 2.0 };
  return factorMap[siteClass];
}

/**
 * ⚠️ এই ফাইলের নিজস্ব R টেবিল Structural-এর seismicLoad.ts থেকে
 * কপি করা (একীভূত entry point হওয়ার কথা ছিল, কিন্তু দুই app এর
 * মধ্যে shear-wall-concrete এর মান অমিল থাকায় এখনই silently pick
 * করে দেওয়া হলো না — উপরের ফাইল-হেডার কমেন্ট দেখুন)।
 */
function getLocalResponseModificationFactor(system: StructuralSystem): number {
  const rMap: Record<StructuralSystem, number> = {
    "moment-frame-concrete": 8,
    "moment-frame-steel": 8,
    "shear-wall-concrete": 5, // ⚠️ Hub-এর "RC Shear Wall" R=6.0 এর সাথে অমিল — দেখুন ফাইল-হেডার
    "dual-system": 7,
  };
  return rMap[system];
}
