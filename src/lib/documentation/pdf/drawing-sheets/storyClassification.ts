/**
 * storyClassification helper — Phase 11h
 *
 * Grade Beam (S-06) vs Typical Floor Beam (S-08) vs Roof Floor Beam
 * (S-13) — সবগুলোই category==="beam", storyId অনুযায়ী আলাদা sheet।
 * StructuralStory এ isBaseLevel/order/elevation কনফার্ম
 * (SectionC_GeneralInformation.tsx থেকে)।
 *
 * সংশোধন (build error থেকে ধরা পড়েছে, আগের ফেজের ভুল অনুমান বাতিল) —
 * storyId আসলে StructuralElement এ সরাসরি কনফার্ম (element.ts, optional
 * ফিল্ড — foundation elements এর storyId থাকে না, ওরা base level এ)।
 * DesignResult এ storyId নেই — persistDesignResult() কল কখনো এই ফিল্ড
 * পাঠায় না। তাই grade/typical/roof classify করতে সরাসরি element.storyId
 * পড়াই সঠিক পথ, কোনো DesignResult lookup লাগে না। যে element এর
 * storyId undefined (foundation), সেটাকে কোনো story bucket এ রাখা
 * সম্ভব না — caller কে সেই case honest ভাবে handle করতে হবে।
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

/** elementId দিয়ে matching StructuralElement খুঁজে তার storyId ফেরত দেয় (উপরের docblock দেখুন)। Element না পেলে, বা element এর storyId undefined হলে (foundation) null। */
export function resolveElementStoryId(
  elements: import("@/lib/types/element").StructuralElement[],
  elementId: string
): string | null {
  return elements.find((e) => e.elementId === elementId)?.storyId ?? null;
}
