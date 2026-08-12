/**
 * autoReanalysisLoop.ts — Dependency OUTDATED status ধরে auto
 * re-derive (Phase 7)।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 7 আইটেম: "Dependency OUTDATED status ধরে auto
 * re-derive → re-run"।
 *
 * ⚠️ সততার সাথে স্কোপ — "re-run" শব্দটা প্ল্যানে থাকলেও, এই ফাইল
 * শুধু re-derive (Phase 3 এর pure functions: deriveSDC, deriveLiveLoad)
 * পর্যন্ত auto করে, পুরো FE analysis "re-run" (backend solver কল)
 * পর্যন্ত না। কারণ:
 *
 *   ১. প্ল্যানে নিজেই আগের চ্যাটে confirmed হয়েছে — "APPROVED
 *      স্ট্যাটাসে বসানো auto না, Hub-এর নিজস্ব ইচ্ছাকৃত human-review
 *      gate"। downgradeToOutdatedIfApproved() (dependency.firestore.ts,
 *      bumpModuleVersion() এর ভেতরে ইতিমধ্যে কল হয়) সেই downgrade-টা
 *      আগে থেকেই করে — এই ফাইলে সেটা আবার implement করার দরকার নেই।
 *   ২. Analysis "re-run" মানে backend/Cloud Run/Railway এ একটা analysis
 *      job submit করা (compute/client.ts, submitAnalysisJob) —
 *      সেটা ব্যয়বহুল (compute cost) এবং engineer কে জানাতে হবে কখন
 *      চলছে/শেষ হলো। ইঞ্জিনিয়ারের UI session ছাড়া ব্যাকগ্রাউন্ডে চুপচাপ
 *      analysis চালানো একটা বড় সিদ্ধান্ত (unexpected compute cost,
 *      অথবা stale/half-edited model এর উপর ভুল সময়ে চালানো) — তাই এই
 *      ফাইল শুধু "re-run প্রয়োজন" flag করে (needsReanalysis), backend
 *      job নিজে submit করে না। চূড়ান্ত trigger ইঞ্জিনিয়ারের UI action।
 *   ৩. re-derive এর ফলাফল (deriveSDC/deriveLiveLoad) pure/read-only —
 *      কোনো Firestore write বা model mutation করে না, তাই এগুলো auto
 *      চালানো নিরাপদ (ভুল হলেও শুধু stale display value, model corrupt
 *      হয় না)।
 *
 * geometry re-import এই ফাইলের স্কোপে নেই (useHubModuleSubscriptions.ts
 * এর হেডার কমেন্ট দেখুন — UNRESOLVED_MATERIAL_ID এর কারণে সেটা
 * ইঞ্জিনিয়ারের review ছাড়া auto করা অনিরাপদ)।
 */

import { getStructuralDependencyStatuses } from "@/lib/hub/dependencyTracking";
import { deriveSDC, type DerivedSeismicParameters } from "@/lib/derive/deriveSDC";
import { deriveLiveLoad, type DerivedLiveLoad } from "@/lib/derive/deriveLiveLoad";
import { deriveSiteClass } from "@/lib/derive/deriveSiteClass";
import type { HubBnbcSettingsData, HubSiteInfoData } from "@/lib/hub/hub-module-shapes";
import type { OccupancyCategory, SeismicZone } from "@/lib/loads/seismicLoad";

export interface AutoReanalysisCheckResult {
  /** কোনো upstream dependency OUTDATED কিনা — true হলে UI-তে "re-derive/re-analysis প্রয়োজন" ব্যানার দেখানো উচিত। */
  needsReanalysis: boolean;
  outdatedModules: string[];
  /** re-derive সফল হলে re-computed মান (UI প্রিভিউ করতে পারবে, প্রয়োগ করা ইঞ্জিনিয়ারের সিদ্ধান্ত)। */
  rederived: { sdc?: DerivedSeismicParameters; liveLoad?: DerivedLiveLoad } | null;
  warnings: string[];
}

/**
 * Structural এর dependency status চেক করে — কোনোটা OUTDATED থাকলে
 * (ও bnbcSettings/siteInfo ডেটা পাওয়া গেলে) Phase 3 এর derivation
 * functions আবার চালায় (re-derive)। কোনো Firestore write করে না —
 * ফলাফল শুধু রিটার্ন করে, caller (UI hook/component) সিদ্ধান্ত নেবে
 * নতুন মান display/apply করবে কিনা।
 *
 * @param hubBnbcSettings, hubSiteInfo — useHubModuleSubscriptions.ts
 * এর hook থেকে already-subscribed ডেটা pass করুন (এই ফাংশন নিজে
 * subscribe করে না, pure — তাই সরাসরি টেস্ট করা সহজ)।
 */
export async function checkAndReanalyze(
  projectId: string,
  hubBnbcSettings: HubBnbcSettingsData | null,
  hubSiteInfo: HubSiteInfoData | null
): Promise<AutoReanalysisCheckResult> {
  const warnings: string[] = [];
  const dependencies = await getStructuralDependencyStatuses(projectId);
  const outdated = dependencies.filter((d) => d.status === "OUTDATED");

  if (outdated.length === 0) {
    return { needsReanalysis: false, outdatedModules: [], rederived: null, warnings };
  }

  const outdatedModules = outdated.map((d) => d.upstreamModule);

  if (!hubBnbcSettings) {
    warnings.push("bnbcSettings OUTDATED/মিসিং হলেও পাওয়া যায়নি — re-derive করা যায়নি, useHubBnbcSettings() hook subscribe করা আছে কিনা যাচাই করুন।");
    return { needsReanalysis: true, outdatedModules, rederived: null, warnings };
  }

  let resolvedSiteClass: ReturnType<typeof deriveSiteClass>["siteClass"];
  if (hubSiteInfo) {
    const siteClassResult = deriveSiteClass(hubSiteInfo.soilType);
    resolvedSiteClass = siteClassResult.siteClass;
    if (siteClassResult.confidence === "approximate") {
      warnings.push(`deriveSiteClass: ${siteClassResult.note}`);
    }
  } else {
    // hubSiteInfo না থাকলেও hubBnbcSettings.soilType (একই S1-S4 স্কেল)
    // থেকেই deriveSiteClass চালানো সম্ভব — hub-module-shapes.ts এ দুই
    // জায়গাতেই soilType আছে (siteInfo ও bnbcSettings, একই মান হওয়ার
    // কথা)।
    warnings.push("siteInfo পাওয়া যায়নি — hubBnbcSettings.soilType (Hub এর S1-S4 স্কেল) থেকে siteClass derive করা হচ্ছে, siteInfo থেকে না।");
    const siteClassResult = deriveSiteClass(hubBnbcSettings.soilType);
    resolvedSiteClass = siteClassResult.siteClass;
    if (siteClassResult.confidence === "approximate") {
      warnings.push(`deriveSiteClass: ${siteClassResult.note}`);
    }
  }

  const seismicZoneStripped = hubBnbcSettings.seismicZone.replace("Z", "") as SeismicZone;

  const sdc = deriveSDC({
    occupancyCategory: hubBnbcSettings.riskCategory as OccupancyCategory,
    siteClass: resolvedSiteClass,
    seismicZone: seismicZoneStripped,
    hubBnbcSettings,
  });
  warnings.push(...sdc.warnings);

  const liveLoad = deriveLiveLoad({
    liveLoadType: hubBnbcSettings.liveLoadType,
    liveLoadValue: hubBnbcSettings.liveLoadValue,
  });
  warnings.push(...liveLoad.warnings);

  return {
    needsReanalysis: true,
    outdatedModules,
    rederived: { sdc, liveLoad },
    warnings,
  };
}
