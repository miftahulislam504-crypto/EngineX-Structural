/**
 * Node → Story/Grid Mapping (Phase 8a)
 *
 * backend এখন প্রতিটা analysis result এর সাথে `nodes` (AnalysisNode[])
 * ফেরত দেয় (app/main.py এর প্রতিটা _build_*_result_payload, Phase 8a) —
 * nodalDisplacements[i]/modeShape[i] এর coordinate সরাসরি nodes[i] এ
 * পাওয়া যায়। এই মডিউল সেই coordinate ব্যবহার করে node গুলোকে
 * StructuralStory (elevation, Y-axis) অনুযায়ী group করে — Story Drift
 * (Phase 8c), Soft Story Detection (Phase 8d), ও Torsion Check
 * (Phase 8e) — সবগুলোরই প্রথম ধাপ এটাই।
 *
 * এই মডিউল বিশুদ্ধ (pure) — কোনো store/API নির্ভরতা নেই, শুধু data
 * transform। তাই যেকোনো analysis result (Linear Static, RSA,
 * Nonlinear Static, Pushover ইত্যাদি) এর সাথে independently ব্যবহারযোগ্য।
 */

import type { AnalysisNode } from "@/lib/analysis/runAnalysis";
import type { StructuralStory } from "@/lib/types/geometry";

/**
 * একটা node কে elevation (Y-coordinate) অনুযায়ী কোন story-র সাথে মেলানো
 * হবে তা নির্ধারণের সহনশীলতা (মিটার)। backend এর NodeGraph node
 * merge করার সময় 3-decimal (মিলিমিটার) precision ব্যবহার করে
 * (analysis_orchestration.py এর get_or_create_node দেখুন), কিন্তু
 * story elevation ইউজার-ইনপুট (সাধারণত round number, যেমন 3.0, 6.0) —
 * তাই এখানে বেশি generous tolerance ব্যবহার করা হচ্ছে, node-merge
 * precision এর জন্য না, বরং একই floor-এর node গুলোর সামান্য
 * modeling variance (যেমন slab thickness offset) সামঞ্জান্য করতে।
 */
const STORY_ELEVATION_TOLERANCE_M = 0.05;

export interface NodeWithDisplacement<TDisplacement> {
  node: AnalysisNode;
  displacement: TDisplacement;
}

export interface StoryNodeGroup<TDisplacement> {
  story: StructuralStory;
  nodes: NodeWithDisplacement<TDisplacement>[];
}

/**
 * প্রতিটা analysis node কে তার নিকটতম StructuralStory এর সাথে যুক্ত করে
 * (elevation ম্যাচ করে), এবং প্রতিটা story-র node গুলোকে group করে
 * ফেরত দেয়। কোনো node কোনো story-র STORY_ELEVATION_TOLERANCE_M এর
 * মধ্যে না পড়লে (যেমন mid-span split node যেটা কোনো actual story
 * level এ নেই — column-এর মাঝখানে, বা ভুল/অসম্পূর্ণ story ডেটা), সেই
 * node result এর `unmatchedNodes` অংশে থাকবে, silently বাদ যাবে না।
 *
 * stories প্যারামিটার sort করা থাকতে হবে না — এই ফাংশন নিজে elevation
 * অনুযায়ী sort করে নেয় (ascending, base থেকে roof)।
 */
export function groupNodesByStory<TDisplacement>(
  nodes: AnalysisNode[],
  displacements: TDisplacement[],
  stories: StructuralStory[]
): {
  storyGroups: StoryNodeGroup<TDisplacement>[];
  unmatchedNodes: NodeWithDisplacement<TDisplacement>[];
} {
  const sortedStories = [...stories].sort((a, b) => a.elevation - b.elevation);
  const storyGroups: StoryNodeGroup<TDisplacement>[] = sortedStories.map((story) => ({
    story,
    nodes: [],
  }));
  const unmatchedNodes: NodeWithDisplacement<TDisplacement>[] = [];

  nodes.forEach((node, index) => {
    const displacement = displacements[index];
    if (displacement === undefined) return; // displacements array node এর চেয়ে ছোট হলে (shape mismatch) — silently skip, caller এর responsibility shape যাচাই করা

    let closestGroup: StoryNodeGroup<TDisplacement> | null = null;
    let closestDistance = Infinity;
    for (const group of storyGroups) {
      const distance = Math.abs(node.y - group.story.elevation);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestGroup = group;
      }
    }

    if (closestGroup && closestDistance <= STORY_ELEVATION_TOLERANCE_M) {
      closestGroup.nodes.push({ node, displacement });
    } else {
      unmatchedNodes.push({ node, displacement });
    }
  });

  return { storyGroups, unmatchedNodes };
}

/**
 * একটা story-র node গুলোর মধ্যে সবচেয়ে বেশি ও সবচেয়ে কম horizontal
 * displacement (X বা Z দিক, direction ভিত্তিক) বের করে — Torsion
 * Check (Phase 8e) এর জন্য মূল ইনপুট (diaphragm এর দুই প্রান্তের
 * displacement এর পার্থক্য দিয়ে torsional irregularity নির্ণয় হয়,
 * ASCE 7 এর মতো BNBC 2020 এও একই ভিত্তি)।
 *
 * getComponent দিয়ে caller নির্দিষ্ট করে কোন displacement component
 * (ux বা uz) ব্যবহার হবে — এই ফাংশন generic থাকায় ভবিষ্যতে যেকোনো
 * TDisplacement shape (RSA magnitude-only বা signed Linear Static)
 * এর সাথে কাজ করবে, caller শুধু extraction logic দেয়।
 */
export function findStoryDisplacementExtremes<TDisplacement>(
  storyNodes: NodeWithDisplacement<TDisplacement>[],
  getComponent: (displacement: TDisplacement) => number
): { max: NodeWithDisplacement<TDisplacement>; min: NodeWithDisplacement<TDisplacement> } | null {
  if (storyNodes.length === 0) return null;

  let max = storyNodes[0];
  let min = storyNodes[0];
  let maxValue = getComponent(max.displacement);
  let minValue = getComponent(min.displacement);

  for (const entry of storyNodes) {
    const value = getComponent(entry.displacement);
    if (value > maxValue) {
      max = entry;
      maxValue = value;
    }
    if (value < minValue) {
      min = entry;
      minValue = value;
    }
  }

  return { max, min };
}
