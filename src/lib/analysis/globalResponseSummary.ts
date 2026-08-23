/**
 * Global Response Summary (Report-Audit Phase A1+A2) — Base Shear,
 * Story Shear, Overturning Moment, Story Displacement.
 *
 * Audit-এ ধরা পড়া gap: Design Report PDF-এ এই ৪টা quantity কোথাও
 * printed হয় না, যদিও সবগুলোর কাঁচা ডেটা (reactionForces,
 * nodalDisplacements, nodes, stories) analysis result-এ আগে থেকেই
 * আছে (Phase 10n থেকে) — এই মডিউল সেই raw ডেটা থেকে derive করে,
 * কোনো নতুন solver work লাগে না।
 *
 * সীমাবদ্ধতা (honest, explicit):
 *   - reactionForces শুধু Linear Static run-এ populate হয়
 *     (runAnalysis.ts এর ParsedAnalysisResult কমেন্ট দেখুন) —
 *     P-Delta/Nonlinear Static/Pushover এ এখনো backend পাঠায় না।
 *     তাই Base Shear/Overturning Moment শুধু Linear Static এর জন্য
 *     compute হয়, অন্য run type হলে null + warning।
 *   - Story Shear (প্রতিটা story-র উপরে-নিচে কাটা তলে horizontal
 *     force) সরাসরি backend থেকে আসে না — এই মডিউল সেটা elementEndForces
 *     থেকে DERIVE করে না (সেটার জন্য প্রতিটা vertical element কোন
 *     story boundary cross করছে তা geometrically resolve করতে হতো,
 *     যা ভুল হওয়ার ঝুঁকি বেশি)। বরং standard equivalent-static-force
 *     পদ্ধতিতে: একটা story-র "story shear" = তার উপরের সব story-র
 *     মোট base-reaction-share, যা এখানে প্রতিটা story-স্তরের নোডের
 *     reaction থাকলে সরাসরি ব্যবহার করা হয়। এই backend এ Base ছাড়া
 *     অন্য কোনো story-তে support/reaction নেই (base-only boundary
 *     condition) — তাই real per-story shear reaction থেকে বের করা
 *     সম্ভব না। এই মডিউল সেই honest সীমা মেনে শুধু Base Shear +
 *     Overturning Moment (base reaction sum) দেয়, per-story shear
 *     "Not available — requires per-story support/diaphragm force
 *     recovery, not yet implemented" note সহ বাদ রাখে।
 *   - Overturning Moment = base node reaction moments (mx, mz) এর
 *     যোগফল — এটাই FE solver-এর base-level moment equilibrium থেকে
 *     সরাসরি পাওয়া মান, নতুন কোনো derivation-chain (যেমন Σ Fx × arm)
 *     invent করা হয়নি।
 */

import type { AnalysisNode, ReactionForce } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";
import { groupNodesByStory } from "@/lib/analysis/nodeStoryMap";

export interface GlobalResponseSummary {
  /** Σ reactionForces.fx, kN — Linear Static এ reactionForces থাকলেই কেবল। */
  baseShearX: number | null;
  /** Σ reactionForces.fz, kN। */
  baseShearZ: number | null;
  /** Σ reactionForces.mx, kN·m — X-অক্ষ ধরে overturning resistance। */
  overturningMomentX: number | null;
  /** Σ reactionForces.mz, kN·m — Z-অক্ষ ধরে overturning resistance। */
  overturningMomentZ: number | null;
  /** true হলে reactionForces উপলব্ধ না (non-Linear-Static run) — caller "Not available" দেখাবে। */
  unavailable: boolean;
  warnings: string[];
}

export function computeGlobalResponseSummary(
  reactionForces: ReactionForce[] | undefined
): GlobalResponseSummary {
  if (!reactionForces || reactionForces.length === 0) {
    return {
      baseShearX: null,
      baseShearZ: null,
      overturningMomentX: null,
      overturningMomentZ: null,
      unavailable: true,
      warnings: [
        "Base Shear ও Overturning Moment গণনা করা যায়নি — reaction force ডেটা শুধু Linear Static run-এ পাওয়া যায় (এই backend limitation), P-Delta/Nonlinear Static/Pushover এ এখনো নেই।",
      ],
    };
  }

  const baseShearX = reactionForces.reduce((sum, r) => sum + r.fx, 0);
  const baseShearZ = reactionForces.reduce((sum, r) => sum + r.fz, 0);
  const overturningMomentX = reactionForces.reduce((sum, r) => sum + r.mx, 0);
  const overturningMomentZ = reactionForces.reduce((sum, r) => sum + r.mz, 0);

  return {
    baseShearX,
    baseShearZ,
    overturningMomentX,
    overturningMomentZ,
    unavailable: false,
    warnings: [],
  };
}

export interface StoryDisplacementResult {
  storyId: string;
  storyName: string;
  elevation: number;
  /** এই story-র node গুলোর average resultant horizontal displacement (X-Z প্লেনে), মিটার। */
  avgDisplacementX: number;
  avgDisplacementZ: number;
  /** সব node এর মধ্যে সর্বোচ্চ resultant displacement (X-Z), মিটার — governing/peak মান। */
  maxResultantDisplacement: number;
}

export interface StoryDisplacementSummary {
  results: StoryDisplacementResult[];
  warnings: string[];
}

/**
 * প্রতিটা story-র average ও peak horizontal displacement — storyDrift.ts
 * এর groupNodesByStory() একই pattern পুনর্ব্যবহার করে, কিন্তু drift
 * (পার্থক্য) না, বরং absolute displacement per story দেখায়।
 */
export function computeStoryDisplacementSummary(
  nodes: AnalysisNode[] | undefined,
  displacements: { ux: number; uz: number }[] | undefined,
  stories: StructuralStory[]
): StoryDisplacementSummary {
  if (!nodes || !displacements || nodes.length === 0) {
    return {
      results: [],
      warnings: ["Story Displacement — nodal displacement ডেটা পাওয়া যায়নি এই analysis run-এ।"],
    };
  }
  if (stories.length === 0) {
    return { results: [], warnings: ["কোনো Story সংজ্ঞায়িত নেই — Story Displacement table দেখানো যায়নি।"] };
  }

  const { storyGroups, unmatchedNodes } = groupNodesByStory(nodes, displacements, stories);
  const warnings: string[] = [];
  if (unmatchedNodes.length > 0) {
    warnings.push(
      `ℹ️ ${unmatchedNodes.length}টা node কোনো story elevation এর সাথে মেলেনি — সেগুলো এই টেবিলে অন্তর্ভুক্ত হয়নি।`
    );
  }

  const results: StoryDisplacementResult[] = [];
  for (const group of storyGroups) {
    if (group.nodes.length === 0) continue;

    const sumUx = group.nodes.reduce((s, n) => s + n.displacement.ux, 0);
    const sumUz = group.nodes.reduce((s, n) => s + n.displacement.uz, 0);
    const avgDisplacementX = sumUx / group.nodes.length;
    const avgDisplacementZ = sumUz / group.nodes.length;

    const maxResultantDisplacement = Math.max(
      ...group.nodes.map((n) => Math.sqrt(n.displacement.ux ** 2 + n.displacement.uz ** 2))
    );

    results.push({
      storyId: group.story.storyId,
      storyName: group.story.name,
      elevation: group.story.elevation,
      avgDisplacementX,
      avgDisplacementZ,
      maxResultantDisplacement,
    });
  }

  return { results, warnings };
}
