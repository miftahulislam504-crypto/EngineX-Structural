/**
 * dependencyTracking.ts — Structural এর dependency link গুলো Hub এ
 * নিবন্ধন করে (Phase 7)।
 * ------------------------------------------------------------------
 * dependency.firestore.ts এর linkDependency()/getProjectDependencyStatuses()
 * Phase 0 এই port হয়ে গিয়েছিল, কিন্তু কোথাও কল হতো না (grep করে
 * যাচাই করা হয়েছে — src/lib/hub/dependency.firestore.ts ছাড়া অন্য
 * কোনো ফাইলে linkDependency/getProjectDependencies এর কোনো caller
 * ছিল না)। ফলে getDependencyStatus() কখনো "OUTDATED" রিটার্ন করতে
 * পারত না — কারণ কোনো dependency link ই তৈরি হয়নি, তুলনা করার কিছু
 * ছিল না। এই ফাইল সেই gap পূরণ করে — Phase 3 এর derivation function
 * গুলো (deriveSDC/deriveLiveLoad) যে upstream module এর ডেটার উপর
 * নির্ভর করে, সেগুলোর জন্য link তৈরি করার entry point।
 *
 * linkDependency() ফিক্সড doc id ব্যবহার করে
 * (`${dependentModule}__depends_on__${upstreamModule}`) — তাই বারবার
 * কল করলে idempotent (নতুন duplicate doc তৈরি হয় না, একই doc
 * overwrite হয় upstreamVersionAtLink আপডেট সহ)।
 */

import { linkDependency, getProjectDependencyStatuses, type DependencyWithStatus } from "@/lib/hub/dependency.firestore";
import { getModuleVersion } from "@/lib/hub/dependency.firestore";
import type { ModuleId } from "@/lib/hub/dependency.types";

/**
 * Structural যে upstream module গুলোর উপর নির্ভর করে — deriveSDC()
 * (siteInfo এর siteClass, bnbcSettings এর occupancy/zone/spectral
 * data) ও deriveLiveLoad() (bnbcSettings এর liveLoadType/Value) এর
 * ইনপুট। hub-module-shapes.ts এর সাথে সামঞ্জস্যপূর্ণ (একই তিনটা module
 * সেখানেও পড়া হয়)।
 */
export const STRUCTURAL_UPSTREAM_MODULES: ModuleId[] = ["siteInfo", "bnbcSettings", "buildingInfo"];

export interface EnsureDependenciesLinkedResult {
  linked: ModuleId[];
  alreadyLinkedAtCurrentVersion: ModuleId[];
  upstreamMissing: ModuleId[];
}

/** Structural এর সব dependency (status সহ) — getProjectDependencyStatuses() পুরো project এর dependency দেয় (dependentModule দিয়ে ফিল্টার করে না, অন্য app এর dependency ও থাকতে পারে), তাই এখানে শুধু dependentModule="structural" এর গুলো ফিল্টার করা হয়। ensureDependenciesLinked() নিজেও এটা reuse করে (নিচে)। */
export async function getStructuralDependencyStatuses(projectId: string): Promise<DependencyWithStatus[]> {
  const all = await getProjectDependencyStatuses(projectId);
  return all.filter((d) => d.dependentModule === "structural");
}

/**
 * Structural এর dependency link গুলো (siteInfo/bnbcSettings/
 * buildingInfo, তিনটাই) Hub এ নিশ্চিত করে — না থাকলে তৈরি করে, upstream
 * এর বর্তমান version ধরে (upstreamVersionAtLink = এখনকার version, তাই
 * link তৈরির মুহূর্তে status "CURRENT" থাকবে, upstream পরে বাড়লে
 * "OUTDATED" হবে)। upstream module এ এখনো কোনো version doc না থাকলে
 * (upstream app কখনো কিছু publish করেনি) সেই module skip হয় —
 * upstreamMissing এ ফেরত দেওয়া হয়, ইঞ্জিনিয়ারকে জানানোর জন্য।
 *
 * এই ফাংশন idempotent (linkDependency() এর fixed-doc-id property এর
 * কারণে) — নিরাপদে বারবার কল করা যায় (যেমন প্রতিবার project খোলার
 * সময়, "কোনো link মিসিং কিনা" নিশ্চিত করতে)।
 */
export async function ensureDependenciesLinked(projectId: string): Promise<EnsureDependenciesLinkedResult> {
  const result: EnsureDependenciesLinkedResult = { linked: [], alreadyLinkedAtCurrentVersion: [], upstreamMissing: [] };

  // getStructuralDependencyStatuses() ইতিমধ্যে dependentModule="structural"
  // দিয়ে ফিল্টার করে দেয় — অন্য app (যেমন estimating) যদি একই upstream
  // (bnbcSettings) এ নিজের link রাখে, সেটা ভুলভাবে "Structural এর link
  // ইতিমধ্যে আছে" হিসেবে গণ্য হবে না।
  const existingDeps = await getStructuralDependencyStatuses(projectId);
  const existingByUpstream = new Map(existingDeps.map((d) => [d.upstreamModule, d]));

  for (const upstreamModule of STRUCTURAL_UPSTREAM_MODULES) {
    const versionRecord = await getModuleVersion(projectId, upstreamModule);
    if (!versionRecord) {
      result.upstreamMissing.push(upstreamModule);
      continue;
    }

    const existing = existingByUpstream.get(upstreamModule);
    if (existing && existing.upstreamVersionAtLink === versionRecord.currentVersion) {
      result.alreadyLinkedAtCurrentVersion.push(upstreamModule);
      continue;
    }

    await linkDependency(
      projectId,
      "structural",
      upstreamModule,
      versionRecord.currentVersion,
      `deriveSDC/deriveLiveLoad (Phase 3) এর ইনপুট — auto-registered by dependencyTracking.ts`
    );
    result.linked.push(upstreamModule);
  }

  return result;
}

/**
 * ensureDependenciesLinked()-এর নিরাপদ সংস্করণ, শুধু analysis
 * page mount-এ auto-call করার জন্য (Phase 5/7 wiring)।
 *
 * ⚠️ কেন ensureDependenciesLinked() নিজে mount-এ কল করা অনিরাপদ:
 * সেই ফাংশনের নিজের লজিক অনুযায়ী — existing link থাকলেও
 * upstreamVersionAtLink current version-এর সাথে না মিললে (মানে
 * dependency আসলে OUTDATED), সেটা linkDependency() আবার কল করে নতুন
 * version দিয়ে re-link করে দেয়। checkAndReanalyze() যদি ঠিক তার
 * পরেই (বা আগে একই mount-effect-এ) কল হয়, race অনুযায়ী
 * ensureDependenciesLinked() আগে চললে OUTDATED status প্রথম রেন্ডারেই
 * silently CURRENT-এ রিসেট হয়ে যাবে — ইঞ্জিনিয়ার কখনো ব্যানার দেখার
 * সুযোগই পাবেন না। EngineXEstimate-এর hub-module-import.ts এই একই
 * ধরনের version-bump শুধু successful save-এর *পরে* কল করে
 * (linkHubImportDependencies, tryProcess()-এর ভিতরে) — mount-এ না।
 * Structural-এ কোনো "save/consume" মুহূর্ত নেই (re-derive pure/
 * read-only, checkAndReanalyze.ts-এর হেডার কমেন্ট দেখুন), তাই সেই
 * প্যাটার্ন সরাসরি এখানে বসে না — বদলে এই ফাংশন শুধু "link একেবারেই
 * নেই" (upstreamMissing) সেই case-টা handle করে, existing-but-stale
 * link কে কখনো touch করে না। Version bump (OUTDATED status ক্লিয়ার
 * করা) শুধু ইঞ্জিনিয়ার re-derive suggestion সত্যিই "apply" করলে
 * ঘটা উচিত — সেই acknowledgement এখনো এই সেশনে UI-তে বসানো হয়নি
 * (নিচে useHubAnalysisSuggestions.ts-এর হেডার কমেন্ট দ্রষ্টব্য),
 * তাই আপাতত link শুধু প্রথমবার তৈরি হয়, কখনো silently bump হয় না।
 */
export async function ensureDependenciesLinkedIfMissing(projectId: string): Promise<EnsureDependenciesLinkedResult> {
  const result: EnsureDependenciesLinkedResult = { linked: [], alreadyLinkedAtCurrentVersion: [], upstreamMissing: [] };

  const existingDeps = await getStructuralDependencyStatuses(projectId);
  const existingByUpstream = new Map(existingDeps.map((d) => [d.upstreamModule, d]));

  for (const upstreamModule of STRUCTURAL_UPSTREAM_MODULES) {
    if (existingByUpstream.has(upstreamModule)) {
      result.alreadyLinkedAtCurrentVersion.push(upstreamModule);
      continue; // ⚠️ ensureDependenciesLinked() থেকে ইচ্ছাকৃত পার্থক্য — এখানে version মেলে কিনা চেক করা হয় না, শুধু link exist করে কিনা। stale হলেও bump করা হয় না (উপরের হেডার কমেন্ট দেখুন)।
    }

    const versionRecord = await getModuleVersion(projectId, upstreamModule);
    if (!versionRecord) {
      result.upstreamMissing.push(upstreamModule);
      continue;
    }

    await linkDependency(
      projectId,
      "structural",
      upstreamModule,
      versionRecord.currentVersion,
      `deriveSDC/deriveLiveLoad (Phase 3) এর ইনপুট — auto-registered by dependencyTracking.ts (first-link-only, mount-safe variant)`
    );
    result.linked.push(upstreamModule);
  }

  return result;
}
