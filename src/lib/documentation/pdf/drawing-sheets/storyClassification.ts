/**
 * storyClassification helper — Phase 11h
 *
 * Grade Beam (S-06) vs Typical Floor Beam (S-08) vs Roof Floor Beam
 * (S-13) — সবগুলোই category==="beam", storyId অনুযায়ী আলাদা sheet।
 * StructuralStory এ isBaseLevel/order/elevation কনফার্ম
 * (SectionC_GeneralInformation.tsx থেকে)।
 *
 * গুরুত্বপূর্ণ সংশোধন — storyId সরাসরি StructuralElement এ কনফার্ম
 * হয়নি; CalcSheetHeader.tsx থেকে কনফার্ম যে storyId আসলে DesignResult
 * এ থাকে (`result.storyId`), element এ না। তাই একটা beam element কে
 * grade/typical/roof এ classify করতে হলে সেই element এর elementId
 * দিয়ে matching DesignResult খুঁজে তার storyId ব্যবহার করতে হবে —
 * element নিজে থেকে না। যে beam এর কোনো DesignResult নেই (storyId
 * resolve করা যায় না), সেটাকে কোনো story bucket এ রাখা সম্ভব না —
 * caller কে সেই case honest ভাবে handle করতে হবে (চুপচাপ কোনো একটা
 * bucket এ ফেলে দেওয়া ভুল হবে)।
 *
 * কোনো story.type/story.role ফিল্ড কোথাও কনফার্ম হয়নি — তাই
 * classification geometry থেকে reasonable inference:
 *   - grade level = isBaseLevel: true story
 *   - roof level = সর্বোচ্চ order এর story
 *   - typical floor = বাকি সব story (base ও top বাদে)
 * এটা একটা সাধারণ ইঞ্জিনিয়ারিং ধারণা, কোনো explicit story-role field
 * না থাকায় এটাও একটা honest gap হিসেবে চিহ্নিত।
 */

import type { GeometryCore } from "@/lib/types/geometry";

export function classifyStories(geometry: GeometryCore) {
  const stories = [...geometry.stories].sort((a, b) => a.order - b.order);
  const baseStory = stories.find((s) => s.isBaseLevel) ?? stories[0] ?? null;
  const roofStory = stories.length > 0 ? stories[stories.length - 1] : null;
  const typicalStoryIds = stories
    .filter((s) => s.storyId !== baseStory?.storyId && s.storyId !== roofStory?.storyId)
    .map((s) => s.storyId);

  return {
    baseStoryId: baseStory?.storyId ?? null,
    roofStoryId: roofStory?.storyId ?? null,
    typicalStoryIds,
  };
}

/** element এর elementId দিয়ে matching DesignResult খুঁজে তার storyId ফেরত দেয় — element নিজে থেকে storyId পড়ে না (উপরের docblock দেখুন)। DesignResult না পেলে null। */
export function resolveElementStoryId(
  designResults: import("@/lib/design/firestore").DesignResult[],
  elementId: string
): string | null {
  return designResults.find((r) => r.elementId === elementId)?.storyId ?? null;
}
