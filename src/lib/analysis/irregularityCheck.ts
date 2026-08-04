/**
 * Irregularity Check + Soft Story Detection (Phase 8d) — BNBC 2020
 * Part VI, Chapter 2, Section 2.5.5 (Vertical ও Plan Irregularity)
 * অনুযায়ী। থ্রেশহোল্ডগুলো web search দিয়ে যাচাই করা হয়েছে (BNBC 2020
 * ভিত্তিক গবেষণাপত্র ও ASCE 7 — BNBC 2020-এর এই chapter ASCE 7-এর
 * কাঠামো অনুসরণ করে):
 *
 *   Stiffness Irregularity — Soft Storey: স্টোরি স্টিফনেস উপরের
 *     স্টোরির 70%-এর কম, বা উপরের 3 স্টোরির গড়ের 80%-এর কম।
 *   Stiffness Irregularity — Extreme Soft Storey: 60% / 70% (একই
 *     ভিত্তি, আরও কড়া সীমা)।
 *   Discontinuity in Capacity — Weak Storey: স্টোরি strength উপরের
 *     স্টোরির 80%-এর কম।
 *   Mass Irregularity: কোনো স্টোরির seismic weight সংলগ্ন স্টোরির
 *     200%-এর বেশি হলে (roof এ প্রযোজ্য না)।
 *   Vertical Geometric Irregularity: lateral-force-resisting
 *     system-এর horizontal dimension সংলগ্ন স্টোরির 150%-এর বেশি হলে।
 *   Torsional Irregularity (Plan): rigid diaphragm-এ, accidental
 *     torsion সহ maximum story drift, দুই প্রান্তের average drift-এর
 *     1.2 গুণের বেশি হলে irregular, 1.4 গুণের বেশি হলে extreme।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   1. **Mass Irregularity চেক করা যাচ্ছে না।** এই অ্যাপের
 *      seismicLoad.ts বর্তমানে একটাই মোট seismicWeight নেয় এবং তা
 *      সব story-তে সমানভাবে ভাগ করে দেয় (storyWeight = seismicWeight
 *      / numberOfStories) — per-story আলাদা mass/weight ইনপুট করার
 *      কোনো উপায় এখনো এই অ্যাপে নেই (floor load takeoff/tributary
 *      area calculation Phase 8 এর স্কোপের বাইরে)। তাই এই ফাংশন Mass
 *      Irregularity এর জন্য `"not-computable"` status ফেরত দেয় (false
 *      "no irregularity" না দেখিয়ে) — ব্যবহারকারীকে explicit ভাবে
 *      জানানো হচ্ছে যে এই চেক এখনো সম্ভব না, ভুলভাবে "পাস" দেখানো হয়
 *      না।
 *   2. **Stiffness/Weak Storey চেক approximate।** সরাসরি "story
 *      stiffness" এই অ্যাপ থেকে বের হয় না — এখানে stiffness আনুমানিক
 *      করা হচ্ছে standard practice অনুযায়ী: k_story ≈ V_story /
 *      Δ_story (সেই story-র শিয়ার ভাগ সেই story-র drift দিয়ে,
 *      seismicLoad.ts/windLoad.ts এর storyForces.cumulativeShear ও
 *      storyDrift.ts এর governingDrift থেকে)। এটা secant stiffness
 *      approximation — প্রকৃত elastic story stiffness matrix বের করার
 *      চেয়ে কম নির্ভুল, কিন্তু ইনপুট হিসেবে যা আছে তা দিয়ে যুক্তিসঙ্গত
 *      estimate। Weak Storey (strength-based) এর জন্য ঠিক এই একই
 *      approximation ব্যবহার হচ্ছে (strength এর সরাসরি measure নেই,
 *      তাই V_story কেই proxy হিসেবে ব্যবহার করা হচ্ছে — element-level
 *      capacity check Design Engine-এর কাজ, এখানে না)।
 *   3. **Vertical Geometric Irregularity** node coordinate থেকে
 *      bounding-box extent (max-min X, max-min Z) বের করে হিসাব করা
 *      হয় — এটা প্রকৃত lateral-force-resisting-system-এর extent না
 *      (শুধু node placement-ভিত্তিক), তাই যদি একটা floor-এ non-lateral
 *      member (যেমন cantilever balcony slab edge) থাকে তাহলে এই
 *      bounding box বাস্তবের চেয়ে বড় দেখাতে পারে।
 */

import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";
import { groupNodesByStory } from "@/lib/analysis/nodeStoryMap";
import type { StoryDriftResult } from "@/lib/analysis/storyDrift";

export type IrregularityStatus = "regular" | "irregular" | "extreme-irregular" | "not-computable";

export interface StiffnessIrregularityResult {
  storyId: string;
  storyName: string;
  approximateStiffness: number; // kN/m — V_story / Δ_story (secant approximation)
  ratioToStoryAbove: number | null; // null হলে top story (উপরে কোনো story নেই)
  ratioToAvgOfThreeAbove: number | null;
  status: IrregularityStatus;
}

export interface WeakStoreyResult {
  storyId: string;
  storyName: string;
  storyShear: number; // kN — proxy for strength
  ratioToStoryAbove: number | null;
  status: IrregularityStatus;
}

export interface GeometricIrregularityResult {
  storyId: string;
  storyName: string;
  extentX: number; // মিটার — সেই story-র node bounding box, X দিক
  extentZ: number;
  governingExtent: number; // max(extentX, extentZ)
  ratioToStoryBelow: number | null; // null হলে base/সবচেয়ে নিচের story
  status: IrregularityStatus;
}

export interface TorsionalIrregularityResult {
  storyId: string;
  storyName: string;
  maxDrift: number;
  avgDrift: number;
  ratio: number; // maxDrift / avgDrift
  status: IrregularityStatus;
}

export interface IrregularityCheckResult {
  stiffnessIrregularity: StiffnessIrregularityResult[];
  weakStorey: WeakStoreyResult[];
  massIrregularity: { status: "not-computable"; reason: string };
  geometricIrregularity: GeometricIrregularityResult[];
  torsionalIrregularity: TorsionalIrregularityResult[];
  hasAnyIrregularity: boolean;
  warnings: string[];
}

export interface IrregularityCheckInput {
  nodes: AnalysisNode[];
  displacements: { ux: number; uz: number }[];
  stories: StructuralStory[];
  /** storyDrift.ts এর computeStoryDriftCheck().results — governingDrift ব্যবহার হবে stiffness ও torsional উভয় চেকে। */
  driftResults: StoryDriftResult[];
  /** seismicLoad.ts বা windLoad.ts এর storyForces থেকে — storyId নয়, elevation match করে ব্যবহার হয়। */
  storyShears: { elevation: number; cumulativeShear: number }[];
}

function classifyStiffnessRatio(ratioToAbove: number | null, ratioToAvgAbove: number | null): IrregularityStatus {
  if (ratioToAbove === null && ratioToAvgAbove === null) return "regular"; // top story, কোনো তুলনা সম্ভব না
  const failsExtreme =
    (ratioToAbove !== null && ratioToAbove < 0.6) || (ratioToAvgAbove !== null && ratioToAvgAbove < 0.7);
  if (failsExtreme) return "extreme-irregular";
  const failsSoft =
    (ratioToAbove !== null && ratioToAbove < 0.7) || (ratioToAvgAbove !== null && ratioToAvgAbove < 0.8);
  if (failsSoft) return "irregular";
  return "regular";
}

function findShearAtElevation(
  storyShears: IrregularityCheckInput["storyShears"],
  elevation: number
): number | null {
  const TOL = 0.1;
  const match = storyShears.find((s) => Math.abs(s.elevation - elevation) <= TOL);
  return match ? match.cumulativeShear : null;
}

export function computeIrregularityCheck(input: IrregularityCheckInput): IrregularityCheckResult {
  const warnings: string[] = [];
  const sortedStories = [...input.stories].sort((a, b) => a.elevation - b.elevation);
  const nonBaseStories = sortedStories.filter((s) => !s.isBaseLevel);

  if (nonBaseStories.length === 0) {
    warnings.push("⚠️ কোনো non-base story সংজ্ঞায়িত নেই — Irregularity Check চালানো যায়নি।");
    return {
      stiffnessIrregularity: [],
      weakStorey: [],
      massIrregularity: {
        status: "not-computable",
        reason: "কোনো story নেই।",
      },
      geometricIrregularity: [],
      torsionalIrregularity: [],
      hasAnyIrregularity: false,
      warnings,
    };
  }

  // ---- Stiffness Irregularity (Soft/Extreme Soft Storey) + Weak Storey ----
  // প্রতিটা story-র approximate stiffness ও shear বের করা (bottom-to-top ক্রমে, index 0 = সবচেয়ে নিচের non-base story)
  const storyStiffnessData: { story: StructuralStory; stiffness: number | null; shear: number | null }[] = [];
  for (const story of nonBaseStories) {
    const driftEntry = input.driftResults.find((d) => d.storyId === story.storyId);
    const shear = findShearAtElevation(input.storyShears, story.elevation);
    let stiffness: number | null = null;
    if (driftEntry && shear !== null && driftEntry.governingDrift > 1e-9) {
      stiffness = shear / driftEntry.governingDrift;
    }
    storyStiffnessData.push({ story, stiffness, shear });
  }

  const stiffnessIrregularity: StiffnessIrregularityResult[] = [];
  const weakStorey: WeakStoreyResult[] = [];

  for (let i = 0; i < storyStiffnessData.length; i++) {
    const current = storyStiffnessData[i];
    const above = storyStiffnessData[i + 1]; // পরের index = উপরের story (ascending sort)
    const threeAbove = storyStiffnessData.slice(i + 1, i + 4);

    if (current.stiffness === null) {
      warnings.push(
        `⚠️ Story "${current.story.name}"-এর জন্য stiffness হিসাব করা যায়নি (drift বা shear ডেটা অনুপস্থিত/শূন্য) — এই story স্টিফনেস ইররেগুলারিটি চেকে বাদ পড়েছে।`
      );
      continue;
    }

    const ratioToStoryAbove = above && above.stiffness !== null ? current.stiffness / above.stiffness : null;
    const avgOfThreeAbove =
      threeAbove.length > 0 && threeAbove.every((s) => s.stiffness !== null)
        ? threeAbove.reduce((sum, s) => sum + (s.stiffness as number), 0) / threeAbove.length
        : null;
    const ratioToAvgOfThreeAbove = avgOfThreeAbove !== null ? current.stiffness / avgOfThreeAbove : null;

    stiffnessIrregularity.push({
      storyId: current.story.storyId,
      storyName: current.story.name,
      approximateStiffness: current.stiffness,
      ratioToStoryAbove,
      ratioToAvgOfThreeAbove,
      status: classifyStiffnessRatio(ratioToStoryAbove, ratioToAvgOfThreeAbove),
    });

    if (current.shear !== null) {
      const shearRatioToAbove = above && above.shear !== null && above.shear > 1e-9 ? current.shear / above.shear : null;
      let weakStatus: IrregularityStatus = "regular";
      if (shearRatioToAbove !== null && shearRatioToAbove < 0.8) weakStatus = "irregular";
      weakStorey.push({
        storyId: current.story.storyId,
        storyName: current.story.name,
        storyShear: current.shear,
        ratioToStoryAbove: shearRatioToAbove,
        status: weakStatus,
      });
    }
  }

  // ---- Mass Irregularity — not computable (দেখুন module docstring) ----
  const massIrregularity = {
    status: "not-computable" as const,
    reason:
      "এই অ্যাপে এখনো per-story seismic weight ইনপুট করার উপায় নেই (seismicLoad.ts মোট weight সব story-তে সমানভাবে ভাগ করে) — Mass Irregularity চেক করার জন্য প্রকৃত floor-by-floor weight প্রয়োজন।",
  };

  // ---- Vertical Geometric Irregularity ----
  const { storyGroups } = groupNodesByStory(input.nodes, input.displacements, input.stories);
  const nonBaseGroups = storyGroups.filter((g) => !g.story.isBaseLevel);
  const geometricIrregularity: GeometricIrregularityResult[] = [];

  for (let i = 0; i < nonBaseGroups.length; i++) {
    const group = nonBaseGroups[i];
    if (group.nodes.length === 0) continue;

    const xs = group.nodes.map((n) => n.node.x);
    const zs = group.nodes.map((n) => n.node.z);
    const extentX = Math.max(...xs) - Math.min(...xs);
    const extentZ = Math.max(...zs) - Math.min(...zs);
    const governingExtent = Math.max(extentX, extentZ);

    const below = nonBaseGroups[i - 1]; // নিচের story (BNBC এর সংজ্ঞা "adjacent storey", উপরে না নিচে নির্দিষ্ট না — এখানে নিচের সাথে তুলনা করা হচ্ছে, প্রচলিত practice)
    let ratioToStoryBelow: number | null = null;
    if (below && below.nodes.length > 0) {
      const belowXs = below.nodes.map((n) => n.node.x);
      const belowZs = below.nodes.map((n) => n.node.z);
      const belowExtent = Math.max(Math.max(...belowXs) - Math.min(...belowXs), Math.max(...belowZs) - Math.min(...belowZs));
      ratioToStoryBelow = belowExtent > 1e-9 ? governingExtent / belowExtent : null;
    }

    let status: IrregularityStatus = "regular";
    if (ratioToStoryBelow !== null && ratioToStoryBelow > 1.5) status = "irregular";

    geometricIrregularity.push({
      storyId: group.story.storyId,
      storyName: group.story.name,
      extentX,
      extentZ,
      governingExtent,
      ratioToStoryBelow,
      status,
    });
  }

  // ---- Torsional Irregularity ----
  // findStoryDisplacementExtremes (nodeStoryMap.ts) দিয়ে প্রতিটা story-র
  // max/min horizontal displacement বের করে, তারপর সেই স্টোরির নিচের
  // স্টোরির সাথে তুলনা করে drift বের করা হচ্ছে দুই প্রান্তে আলাদাভাবে।
  const torsionalIrregularity: TorsionalIrregularityResult[] = [];
  for (let i = 0; i < nonBaseGroups.length; i++) {
    const group = nonBaseGroups[i];
    const below = i > 0 ? nonBaseGroups[i - 1] : storyGroups.find((g) => g.story.isBaseLevel);
    if (group.nodes.length < 2 || !below) continue;

    const belowAvgX =
      below.nodes.length > 0 ? below.nodes.reduce((s, n) => s + n.displacement.ux, 0) / below.nodes.length : 0;

    // প্রতিটা node এর drift (এই story displacement - নিচের story গড় displacement)
    const nodeDrifts = group.nodes.map((n) => Math.abs(n.displacement.ux - belowAvgX));
    const maxDrift = Math.max(...nodeDrifts);
    const avgDrift = nodeDrifts.reduce((s, d) => s + d, 0) / nodeDrifts.length;

    if (avgDrift < 1e-9) continue;

    const ratio = maxDrift / avgDrift;
    let status: IrregularityStatus = "regular";
    if (ratio > 1.4) status = "extreme-irregular";
    else if (ratio > 1.2) status = "irregular";

    torsionalIrregularity.push({
      storyId: group.story.storyId,
      storyName: group.story.name,
      maxDrift,
      avgDrift,
      ratio,
      status,
    });
  }

  if (torsionalIrregularity.length === 0 && nonBaseGroups.some((g) => g.nodes.length < 2)) {
    warnings.push(
      "ℹ️ কিছু story-তে ২টার কম node পাওয়া গেছে — Torsional Irregularity নির্ভুলভাবে বের করতে প্রতিটা story-তে অন্তত ২টা diaphragm-প্রান্ত node দরকার।"
    );
  }

  const hasAnyIrregularity = [
    ...stiffnessIrregularity,
    ...weakStorey,
    ...geometricIrregularity,
    ...torsionalIrregularity,
  ].some((r) => r.status === "irregular" || r.status === "extreme-irregular");

  return {
    stiffnessIrregularity,
    weakStorey,
    massIrregularity,
    geometricIrregularity,
    torsionalIrregularity,
    hasAnyIrregularity,
    warnings,
  };
}
