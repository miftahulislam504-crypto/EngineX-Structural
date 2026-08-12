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
