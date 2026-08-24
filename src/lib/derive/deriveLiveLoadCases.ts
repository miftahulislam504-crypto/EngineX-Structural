/**
 * deriveLiveLoadCases.ts — সব Slab element-এ occupancy live load
 * (UniformAreaLoadCase) auto-generate করে।
 * ------------------------------------------------------------------
 * deriveLiveLoad.ts (আগে থেকেই আছে) শুধু Hub-এর BNBC settings থেকে
 * একটা scalar occupancy value (kN/m²) বের করে — কোনো element-level
 * LoadCase তৈরি করে না। deriveSelfWeightLoads.ts যেভাবে element
 * geometry থেকে সরাসরি UniformLineLoadCase[] তৈরি করে, এই ফাইল ঠিক
 * সেই একই কাজ Slab-এর জন্য করে, deriveLiveLoad.ts এর scalar value
 * ইনপুট হিসেবে ব্যবহার করে।
 *
 * সততার সাথে সীমাবদ্ধতা:
 *   - ডিফল্টভাবে সব Slab-এ একই occupancy value apply হয় (Hub-এর
 *     bnbc_settings প্রজেক্ট-লেভেল একটাই occupancy type ধরে নেয়)।
 *     কোনো নির্দিষ্ট Slab-এ ভিন্ন occupancy দরকার হলে (যেমন একই
 *     ভবনে residential + parking + roof) SlabElement.liveLoadOverride
 *     (kN/m²) সেট করা যায় — সেট থাকলে সেই slab এ project-wide default
 *     এর বদলে override মান ব্যবহার হয় (২০২৬-০৮ যোগ হলো)। override
 *     ব্যবহারকারীর সরাসরি ইনপুট, তাই এটাকে "auto" না, তবু auto-sync
 *     এর অংশ হিসেবেই resulting LoadCase-এ source: "auto" থাকে —
 *     কারণ LoadCase নিজেই এখনো auto-derive/re-sync হওয়া (element
 *     ডিলিট/geometry বদলালে recompute), শুধু magnitude-এর উৎস আলাদা।
 *   - intensity ঋণাত্মক (গ্র্যাভিটি লোড, deriveSelfWeightLoads.ts এর
 *     একই Y-অক্ষ কনভেনশন)।
 */

import type { StructuralElement, SlabElement } from "@/lib/types/element";
import { computePolygonPlanArea } from "@/lib/types/element";
import type { UniformAreaLoadCase } from "@/lib/types/load";
import { createUniformAreaLoad } from "@/lib/types/load";
import type { HubBnbcSettingsData } from "@/lib/hub/hub-module-shapes";
import { deriveLiveLoad } from "@/lib/derive/deriveLiveLoad";

export interface DeriveLiveLoadCasesResult {
  loadCases: UniformAreaLoadCase[];
  liveLoadValueKnM2: number;
  skipped: { elementId: string; label: string; reason: string }[];
  warnings: string[];
}

/**
 * সব Slab element-এ occupancy live load case বানায়। plan area শূন্য
 * বা অবৈধ (vertices < 3) হলে সেই slab বাদ পড়ে (skipped এ কারণসহ)।
 * প্রতিটা slab-এর liveLoadOverride সেট থাকলে সেই মান ব্যবহার হয়,
 * না থাকলে project-wide derivedValue (Hub থেকে)।
 *
 * @param livePatternId - যে LoadPattern-এ এই load case গুলো যুক্ত হবে (category "live" হওয়া উচিত, caller নিশ্চিত করবে)
 */
export function deriveLiveLoadCases(
  elements: StructuralElement[],
  livePatternId: string,
  hubBnbcSettings?: Pick<HubBnbcSettingsData, "liveLoadType" | "liveLoadValue">
): DeriveLiveLoadCasesResult {
  const warnings: string[] = [];
  const skipped: DeriveLiveLoadCasesResult["skipped"] = [];
  const loadCases: UniformAreaLoadCase[] = [];

  const derivedValue = deriveLiveLoad(hubBnbcSettings);
  warnings.push(...derivedValue.warnings);

  const slabs = elements.filter((e): e is SlabElement => e.category === "slab");

  const slabsWithOverride = slabs.filter((s) => s.liveLoadOverride !== undefined && s.liveLoadOverride !== null);
  if (slabsWithOverride.length > 0) {
    warnings.push(
      `${slabsWithOverride.length}টা Slab-এ নিজস্ব liveLoadOverride সেট আছে — ঐ slab গুলোতে project-wide default (${derivedValue.liveLoadValueKnM2.toFixed(2)} kN/m²) এর বদলে তাদের নিজস্ব মান ব্যবহার হয়েছে।`
    );
  }

  if (derivedValue.liveLoadValueKnM2 <= 0 && slabsWithOverride.length === 0) {
    warnings.push("Live load value শূন্য বা অনুপস্থিত — কোনো Slab এ auto live load বসানো হয়নি।");
    return { loadCases, liveLoadValueKnM2: derivedValue.liveLoadValueKnM2, skipped, warnings };
  }

  for (const slab of slabs) {
    const effectiveValue = slab.liveLoadOverride !== undefined && slab.liveLoadOverride !== null
      ? slab.liveLoadOverride
      : derivedValue.liveLoadValueKnM2;

    if (effectiveValue <= 0) {
      // এই slab এ কোনো override নেই এবং project-wide default-ও শূন্য/অনুপস্থিত।
      continue;
    }

    const areaM2 = computePolygonPlanArea(slab.vertices);
    if (areaM2 <= 0) {
      skipped.push({
        elementId: slab.elementId,
        label: slab.label,
        reason: "Plan area শূন্য বা অবৈধ (কমপক্ষে ৩টা বৈধ vertex দরকার)।",
      });
      continue;
    }

    loadCases.push(
      createUniformAreaLoad({
        patternId: livePatternId,
        elementId: slab.elementId,
        intensity: -effectiveValue,
        source: "auto",
      })
    );
  }

  return { loadCases, liveLoadValueKnM2: derivedValue.liveLoadValueKnM2, skipped, warnings };
}
