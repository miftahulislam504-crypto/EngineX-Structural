/**
 * Story Drift Check (Phase 8c) — BNBC 2020 Part VI, Chapter 1 (Sec
 * 1.5.6, wind/non-seismic loads) ও Chapter 2 (Sec 2.5.14, earthquake
 * loads) অনুযায়ী।
 *
 * সততার সাথে সীমাবদ্ধতা: BNBC 2020-এর সিসমিক drift limit (Sec 2.5.14)
 * ও non-seismic drift limit (Sec 1.5.6) উভয়ের general period-based
 * ও structure-type-based সূত্র এখানে প্রয়োগ করা হয়েছে —
 *   Non-seismic (wind ইত্যাদি): Δ ≤ 0.005h (T<0.7s), 0.004h (T≥0.7s),
 *     0.0025h (unreinforced masonry)।
 *   Seismic: Δ ≤ 0.025h (T<0.7s), 0.020h (T≥0.7s) — এটা ASCE 7/UBC এর
 *     প্রচলিত occupancy-independent সরলীকৃত সীমা, BNBC 2020-এর পূর্ণাঙ্গ
 *     occupancy-category-নির্দিষ্ট টেবিল (যদি থাকে, IV এর জন্য আরও
 *     কড়া সীমা প্রযোজ্য হতে পারে ASCE 7 Table 12.12-1 এর মতো) এখানে
 *     প্রয়োগ করা হয়নি — এই মডিউল conservative-side এর সাধারণ সীমা
 *     ব্যবহার করে, চূড়ান্ত ডিজাইনে occupancy-specific factor একজন
 *     ইঞ্জিনিয়ারের যাচাই করা উচিত।
 *
 * এই মডিউল groupNodesByStory() (nodeStoryMap.ts, Phase 8a) ব্যবহার
 * করে node displacement কে story-র সাথে associate করে, তারপর দুইটা
 * পরপর story-র (X বা Z দিকের) গড় horizontal displacement বিয়োগ করে
 * inter-story drift বের করে।
 *
 * গুরুত্বপূর্ণ: RSA (Response Spectrum) এর nodalDisplacements CQC
 * magnitude-only (সবসময় ≥0, sign নেই — ParsedResponseSpectrumResult
 * এর displacementIsMagnitudeOnly flag, Phase 8a)। দুইটা story-র
 * magnitude-only মান সরাসরি বিয়োগ করলে ভুল ফলাফল আসতে পারে (উদাহরণ:
 * দুই story যদি একই দিকে সমান displacement এ move করে, প্রকৃত drift
 * প্রায় শূন্য হওয়া উচিত, কিন্তু magnitude-only ক্ষেত্রে দুটোই ধনাত্মক
 * এক-রকম মান হলে বিয়োগফল শূন্যের কাছাকাছি আসতে পারে কাকতালীয়ভাবে, বা
 * ভিন্ন হলে ভুল বড় মান আসতে পারে — কোনো নিশ্চয়তা নেই)। তাই
 * computeStoryDrift() displacementIsMagnitudeOnly=true হলে RSA
 * ফলাফলের সাথে কাজ করতে অস্বীকার করে না (ব্যবহারকারীর জন্য কিছু তথ্য
 * ভালো, কিছুই না-এর চেয়ে), কিন্তু ফলাফলে একটা স্পষ্ট, high-visibility
 * warning যোগ করে যাতে ভুল বোঝাবুঝি না হয়। Linear Static/Nonlinear
 * Static/P-Delta/Pushover এর signed displacement দিয়ে হিসাব করা হলে
 * এই সতর্কতা আসে না।
 */

import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";
import { groupNodesByStory } from "@/lib/analysis/nodeStoryMap";

export type DriftCheckLoadCategory = "seismic" | "non-seismic";
export type MasonryType = "none" | "unreinforced-masonry";

export interface StoryDriftCheckInput {
  nodes: AnalysisNode[];
  /** প্রতিটা node এর horizontal displacement — ux ও uz (মিটার)। */
  displacements: { ux: number; uz: number }[];
  stories: StructuralStory[];
  loadCategory: DriftCheckLoadCategory;
  /** সেকেন্ড — fundamentalPeriod (seismicLoad.ts এর computeApproximatePeriod() থেকে, বা wind এর জন্য n/a হলে undefined রেখে non-seismic branch এ period ignore হবে না, তবুও ক্লায়েন্টকে দিতে হবে)। */
  fundamentalPeriodSeconds: number;
  masonryType?: MasonryType; // শুধু loadCategory="non-seismic" এ প্রাসঙ্গিক
  /** true হলে (RSA থেকে) ফলাফল magnitude-only, sign নেই — একটা স্পষ্ট warning যোগ হবে। */
  displacementIsMagnitudeOnly?: boolean;
}

export interface StoryDriftResult {
  storyId: string;
  storyName: string;
  elevation: number;
  storyHeight: number;
  /** এই story ও তার ঠিক নিচের story-র (বা base, story 1 এর ক্ষেত্রে) মধ্যে horizontal displacement এর পার্থক্য (মিটার), X ও Z দিক আলাদাভাবে। */
  driftX: number;
  driftZ: number;
  /** max(|driftX|, |driftZ|) দিয়ে নির্ধারিত governing (নিয়ন্ত্রণকারী) দিক ও মান। */
  governingDrift: number;
  governingDirection: "X" | "Z";
  driftRatio: number; // governingDrift / storyHeight
  allowableDriftRatio: number;
  isWithinLimit: boolean;
  utilizationRatio: number; // driftRatio / allowableDriftRatio — >1 হলে ব্যর্থ
}

export interface StoryDriftCheckResult {
  results: StoryDriftResult[];
  worstStory: StoryDriftResult | null;
  overallPass: boolean;
  warnings: string[];
}

/**
 * Allowable drift ratio (Δ/h) নির্ধারণ করে — BNBC 2020 Sec 1.5.6
 * (non-seismic) বা Sec 2.5.14-এর সাধারণ period-based সীমা (seismic)
 * অনুযায়ী।
 */
function getAllowableDriftRatio(
  loadCategory: DriftCheckLoadCategory,
  fundamentalPeriodSeconds: number,
  masonryType: MasonryType
): number {
  if (loadCategory === "non-seismic") {
    if (masonryType === "unreinforced-masonry") return 0.0025;
    return fundamentalPeriodSeconds < 0.7 ? 0.005 : 0.004;
  }
  // seismic
  return fundamentalPeriodSeconds < 0.7 ? 0.025 : 0.02;
}

/**
 * প্রতিটা story-র average horizontal displacement (ux, uz) বের করে —
 * সেই story-র সব node এর গড় (rigid diaphragm অনুমান করা হচ্ছে;
 * প্রকৃত flexible diaphragm এ ভিন্ন node আলাদা displace করতে পারে,
 * সেই বৈচিত্র্য torsion check এর বিষয়, Phase 8e)।
 */
function computeAverageStoryDisplacement(
  storyNodes: { displacement: { ux: number; uz: number } }[]
): { ux: number; uz: number } {
  if (storyNodes.length === 0) return { ux: 0, uz: 0 };
  const sumUx = storyNodes.reduce((sum, n) => sum + n.displacement.ux, 0);
  const sumUz = storyNodes.reduce((sum, n) => sum + n.displacement.uz, 0);
  return { ux: sumUx / storyNodes.length, uz: sumUz / storyNodes.length };
}

export function computeStoryDriftCheck(input: StoryDriftCheckInput): StoryDriftCheckResult {
  const warnings: string[] = [];

  if (input.displacementIsMagnitudeOnly) {
    warnings.push(
      "🔴 এই ফলাফল Response Spectrum (RSA) থেকে এসেছে, যার displacement CQC magnitude-only (sign/direction তথ্য নেই)। দুইটা story-র মধ্যে সরাসরি বিয়োগ করে বের করা drift এখানে সঠিক নাও হতে পারে — নির্ভরযোগ্য Story Drift Check এর জন্য Linear Static, Nonlinear Static, P-Delta, বা Pushover এর signed displacement ব্যবহার করার পরামর্শ দেওয়া হচ্ছে।"
    );
  }

  if (input.stories.length === 0) {
    return { results: [], worstStory: null, overallPass: true, warnings: ["⚠️ কোনো Story সংজ্ঞায়িত নেই — Drift Check চালানো যায়নি।"] };
  }

  const { storyGroups, unmatchedNodes } = groupNodesByStory(
    input.nodes,
    input.displacements,
    input.stories
  );

  if (unmatchedNodes.length > 0) {
    warnings.push(
      `ℹ️ ${unmatchedNodes.length}টা node কোনো story elevation এর সাথে মেলেনি (সম্ভবত mid-span split node বা story ডেটা অসম্পূর্ণ) — এই node গুলো drift হিসাবে অন্তর্ভুক্ত হয়নি।`
    );
  }

  const allowableDriftRatio = getAllowableDriftRatio(
    input.loadCategory,
    input.fundamentalPeriodSeconds,
    input.masonryType ?? "none"
  );

  // sortedStories base থেকে roof পর্যন্ত ascending — groupNodesByStory
  // ইতিমধ্যে এই ক্রমে storyGroups রিটার্ন করে (nodeStoryMap.ts দেখুন)।
  const results: StoryDriftResult[] = [];
  let previousAvgDisplacement = { ux: 0, uz: 0 }; // base level এ ধরে নেওয়া হচ্ছে zero displacement (fully-fixed support)

  for (const group of storyGroups) {
    if (group.story.isBaseLevel) {
      // Base level এর নিজের drift অর্থহীন (support, তাত্ত্বিকভাবে zero
      // displacement) — কিন্তু পরের story-র জন্য reference হিসেবে ব্যবহার
      // হবে, তাই স্কিপ না করে previousAvgDisplacement আপডেট করে result এ
      // যোগ করা হচ্ছে না।
      previousAvgDisplacement = computeAverageStoryDisplacement(group.nodes);
      continue;
    }

    if (group.nodes.length === 0) {
      warnings.push(`⚠️ Story "${group.story.name}" এ কোনো node পাওয়া যায়নি — এই story-র জন্য drift হিসাব করা যায়নি।`);
      continue;
    }

    const avgDisplacement = computeAverageStoryDisplacement(group.nodes);
    const driftX = avgDisplacement.ux - previousAvgDisplacement.ux;
    const driftZ = avgDisplacement.uz - previousAvgDisplacement.uz;

    const governingDirection: "X" | "Z" = Math.abs(driftX) >= Math.abs(driftZ) ? "X" : "Z";
    const governingDrift = Math.abs(governingDirection === "X" ? driftX : driftZ);
    const driftRatio = group.story.height > 0 ? governingDrift / group.story.height : 0;
    const utilizationRatio = allowableDriftRatio > 0 ? driftRatio / allowableDriftRatio : 0;

    results.push({
      storyId: group.story.storyId,
      storyName: group.story.name,
      elevation: group.story.elevation,
      storyHeight: group.story.height,
      driftX,
      driftZ,
      governingDrift,
      governingDirection,
      driftRatio,
      allowableDriftRatio,
      isWithinLimit: utilizationRatio <= 1.0,
      utilizationRatio,
    });

    previousAvgDisplacement = avgDisplacement;
  }

  const worstStory =
    results.length > 0
      ? results.reduce((worst, current) => (current.utilizationRatio > worst.utilizationRatio ? current : worst))
      : null;

  const overallPass = results.every((r) => r.isWithinLimit);

  if (worstStory && !overallPass) {
    warnings.push(
      `🔴 Story "${worstStory.storyName}" এ drift limit exceed করেছে (utilization ${(worstStory.utilizationRatio * 100).toFixed(0)}%) — stiffness বাড়ানো বা lateral system পুনর্বিবেচনা প্রয়োজন হতে পারে।`
    );
  }

  return { results, worstStory, overallPass, warnings };
}
