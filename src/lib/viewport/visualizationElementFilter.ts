import type { StructuralElement } from "@/lib/types/element";

/**
 * Phase 10i — একটা element কোন story-র সাথে সম্পর্কিত সেটা বের করা।
 *
 * সব element category-র storyId ফিল্ড optional (BaseElement এ
 * সংজ্ঞায়িত) — Line/Area element এর জন্য সাধারণত সেট থাকে, কিন্তু
 * foundation-level element (Footing, Combined/Strip Footing, Mat
 * Foundation, Pile, Pile Group, Pile Cap) সাধারণত base level এ থাকে
 * এবং storyId undefined/base-story রেফারেন্স দুটোই বাস্তবে হতে পারে
 * — তাই এখানে element.storyId যা আছে তাই ফেরত দেওয়া হয়, কোনো
 * অনুমান করা হয় না।
 */
export function getElementStoryId(element: StructuralElement): string | undefined {
  return element.storyId;
}

export interface VisualizationRenderState {
  /** viewport এ mesh mount করা হবে কিনা। false হলে element সম্পূর্ণ বাদ। */
  visible: boolean;
  /**
   * 0-1, material opacity multiplier। isolate করা story-র বাইরের
   * element fadeNonIsolated=true হলে এই কম opacity তে দেখানো হয়,
   * fadeNonIsolated=false হলে সেগুলো visible=false হয়ে যায় (এই
   * ফাংশনই সেই সিদ্ধান্ত নেয়, তাই caller কে আলাদা logic লিখতে হয় না)।
   */
  opacityMultiplier: number;
}

const FADED_OPACITY_MULTIPLIER = 0.12;

/**
 * একটা element category visibility toggle ও story isolation state
 * থেকে সিদ্ধান্ত নেয় সেই element এই মুহূর্তে viewport এ কীভাবে
 * দেখানো উচিত। Category হাইড থাকলে isolation state যাই হোক, element
 * সবসময় হাইড — category visibility সবার আগে চেক হয়।
 */
export function computeVisualizationRenderState(
  element: StructuralElement,
  params: {
    categoryVisible: boolean;
    isolatedStoryId: string | null;
    fadeNonIsolated: boolean;
  }
): VisualizationRenderState {
  if (!params.categoryVisible) {
    return { visible: false, opacityMultiplier: 1 };
  }

  if (params.isolatedStoryId === null) {
    return { visible: true, opacityMultiplier: 1 };
  }

  const belongsToIsolatedStory = getElementStoryId(element) === params.isolatedStoryId;

  if (belongsToIsolatedStory) {
    return { visible: true, opacityMultiplier: 1 };
  }

  if (params.fadeNonIsolated) {
    return { visible: true, opacityMultiplier: FADED_OPACITY_MULTIPLIER };
  }

  return { visible: false, opacityMultiplier: 1 };
}
