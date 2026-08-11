/**
 * deriveFoundationTypeSuggestion — bearingCapacity ও loads থেকে
 * প্রাথমিক foundation type সাজেশন।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 3 আইটেম: "deriveFoundationTypeSuggestion(bearing
 * Capacity, loads)"।
 *
 * ⚠️ সততার সাথে সীমাবদ্ধতা — এটা একটা preliminary heuristic, চূড়ান্ত
 * geotechnical সিদ্ধান্ত না। প্রকৃত foundation type নির্বাচন করতে
 * লাগে: settlement analysis, groundwater level, adjacent structure
 * প্রভাব, cost trade-off — এসব এই ফাংশনে নেই। উদ্দেশ্য শুধু ইঞ্জিনিয়ারকে
 * একটা starting point দেওয়া (কোন foundation optimization module
 * (existing: foundationOptimization.ts, FoundationType) প্রথমে try
 * করবেন), চূড়ান্ত সিদ্ধান্ত না।
 *
 * এই ফাইলে ব্যবহৃত FoundationType টাইপটা lib/design/
 * foundationOptimization.ts থেকে re-export করা (নতুন টাইপ বানানো
 * হয়নি) — সেই ফাইলে ইতিমধ্যে ঠিক এই ৫টা ভ্যারিয়েন্ট সংজ্ঞায়িত আছে,
 * duplicate করা হলো না।
 */

import type { FoundationType } from "@/lib/design/foundationOptimization";

export type { FoundationType };

export interface DeriveFoundationTypeSuggestionInput {
  /** BNBC/geotechnical report থেকে allowable bearing pressure — foundationOptimization.ts এর নামকরণ কনভেনশন অনুসরণ করা হয়েছে। */
  allowableBearingPressureKPa: number;
  /** প্রতিটা column-এর service axial load (unfactored) — টোটাল ভবনের জন্য একটা array, একই নামকরণ কনভেনশন (servicePointLoadKN) foundationOptimization.ts থেকে। */
  columnServiceLoadsKN: number[];
  /** টিপিক্যাল column-to-column স্প্যাসিং — একই গ্রিডে পাশাপাশি ফুটিং ওভারল্যাপ হবে কিনা আন্দাজ করার জন্য। */
  typicalColumnSpacingM: number;
  numberOfStories: number;
  /** ঐচ্ছিক — groundwater খুব কাছে (shallow) হলে mat/pile-এর দিকে ঝোঁকানো উচিত। */
  groundwaterDepthM?: number;
}

export interface FoundationTypeSuggestion {
  suggestedType: FoundationType;
  confidence: "low" | "medium";
  reasoning: string[];
  warnings: string[];
}

/**
 * প্রতিটা isolated footing-এর আনুমানিক প্রয়োজনীয় প্লান-এরিয়া বের করে
 * (load / allowable pressure), safety margin হিসেবে ১.১ ফ্যাক্টর যোগ
 * করে ফুটিং-এর নিজের self-weight আনুমানিক ধরে (foundationOptimization.ts
 * এর কোনো module-এই hardcoded self-weight allowance নেই, তাই এখানে
 * একটা preliminary conservative estimate — চূড়ান্ত sizing
 * footingDesign.ts/matFoundationSizing.ts করবে)।
 */
function estimateFootingSideM(loadKN: number, allowableBearingPressureKPa: number): number {
  const selfWeightFactor = 1.1;
  const requiredAreaM2 = (loadKN * selfWeightFactor) / allowableBearingPressureKPa;
  return Math.sqrt(requiredAreaM2);
}

/**
 * bearingCapacity ও loads থেকে preliminary foundation type সাজেস্ট
 * করে। মূল যুক্তি — standard geotechnical practice-এ প্রচলিত ধাপ:
 *
 *   ১. খুব কম bearing capacity (< 75 kPa, সাধারণত নরম Dhaka clay) —
 *      isolated/combined footing অবাস্তব বড় হয়ে যাবে, pile বা mat দিকে।
 *   ২. আনুমানিক isolated footing-এর সাইজ column spacing-এর তুলনায়
 *      বড় হয়ে গেলে (ফুটিং একে অপরের সাথে ওভারল্যাপ করবে) — mat
 *      foundation-এর দিকে (অথবা প্রতিবেশী column জোড়া হলে combined)।
 *   ৩. উঁচু ভবন (৮+ তলা) + মাঝারি-নিম্ন bearing capacity একসাথে হলে —
 *      pile foundation বিবেচনা করা উচিত, লোড concentration বেশি।
 *   ৪. অন্যথায় — isolated footing (সবচেয়ে অর্থনৈতিক, default)।
 *
 * প্রতিটা branch-এ reasoning[] এ ব্যাখ্যা যোগ করা হয় যাতে ইঞ্জিনিয়ার
 * বুঝতে পারেন কেন এই সাজেশন এসেছে, blindly trust না করে যাচাই করেন।
 */
export function deriveFoundationTypeSuggestion(input: DeriveFoundationTypeSuggestionInput): FoundationTypeSuggestion {
  const reasoning: string[] = [];
  const warnings: string[] = [];

  if (input.columnServiceLoadsKN.length === 0) {
    return {
      suggestedType: "isolated-footing",
      confidence: "low",
      reasoning: [],
      warnings: ["কোনো column load দেওয়া হয়নি — ডিফল্ট isolated-footing সাজেশন, কোনো প্রকৃত বিশ্লেষণ ছাড়া।"],
    };
  }

  const maxLoadKN = Math.max(...input.columnServiceLoadsKN);
  const avgLoadKN = input.columnServiceLoadsKN.reduce((a, b) => a + b, 0) / input.columnServiceLoadsKN.length;

  // ধাপ ১ — খুব কম bearing capacity
  const VERY_LOW_BEARING_KPA = 75; // Dhaka-র নরম clay এলাকায় সাধারণ নিম্নসীমা
  if (input.allowableBearingPressureKPa < VERY_LOW_BEARING_KPA) {
    reasoning.push(
      `Allowable bearing pressure (${input.allowableBearingPressureKPa} kPa) খুবই কম (< ${VERY_LOW_BEARING_KPA} kPa, সাধারণত নরম কাদামাটি) — isolated/combined footing এই মাটিতে অবাস্তব বড় হয়ে যাবে। Pile foundation বিবেচনা করুন।`
    );
    warnings.push("এই bearing capacity-তে অবশ্যই একটা geotechnical report থেকে pile capacity ভ্যালু (skin friction/end bearing) যাচাই করে নিন — এই ফাংশন সেটা হিসাব করে না।");
    return { suggestedType: "pile-cap", confidence: "medium", reasoning, warnings };
  }

  // ধাপ ২ — আনুমানিক ফুটিং সাইজ vs column spacing
  const estimatedSideM = estimateFootingSideM(maxLoadKN, input.allowableBearingPressureKPa);
  const OVERLAP_MARGIN = 0.7; // ফুটিং সাইজ spacing-এর ৭০%-এর বেশি হলে ওভারল্যাপ ঝুঁকি ধরা হচ্ছে (edge distance/clearance বাদ দিয়ে conservative)
  if (estimatedSideM > input.typicalColumnSpacingM * OVERLAP_MARGIN) {
    reasoning.push(
      `সবচেয়ে ভারী column-এর (${maxLoadKN.toFixed(0)} kN) আনুমানিক isolated footing সাইজ ≈ ${estimatedSideM.toFixed(2)}m × ${estimatedSideM.toFixed(2)}m, যা typical column spacing-এর (${input.typicalColumnSpacingM}m) তুলনায় বড় — পাশাপাশি ফুটিং ওভারল্যাপ করতে পারে। Mat foundation বিবেচনা করুন (অথবা নির্দিষ্ট জোড়া column-এ combined footing)।`
    );
    warnings.push("এই estimate শুধু sqrt(load/pressure) থেকে — প্রকৃত footingDesign.ts/matFoundationSizing.ts দিয়ে যাচাই করুন।");
    return { suggestedType: "mat-foundation", confidence: "medium", reasoning, warnings };
  }

  // ধাপ ৩ — উঁচু ভবন + মাঝারি-নিম্ন bearing capacity
  const TALL_BUILDING_STORIES = 8;
  const MODERATE_BEARING_KPA = 150;
  if (input.numberOfStories >= TALL_BUILDING_STORIES && input.allowableBearingPressureKPa < MODERATE_BEARING_KPA) {
    reasoning.push(
      `${input.numberOfStories} তলা ভবন (≥ ${TALL_BUILDING_STORIES}) + মাঝারি-নিম্ন bearing pressure (${input.allowableBearingPressureKPa} kPa < ${MODERATE_BEARING_KPA} kPa) — লোড concentration বেশি হওয়ায় pile foundation বেশি নির্ভরযোগ্য হতে পারে shallow foundation-এর তুলনায়।`
    );
    warnings.push("এটা একটা সাধারণ সতর্কতা, চূড়ান্ত সিদ্ধান্ত না — settlement analysis ছাড়া নিশ্চিত হওয়া যায় না।");
    return { suggestedType: "pile-cap", confidence: "low", reasoning, warnings };
  }

  if (input.groundwaterDepthM !== undefined && input.groundwaterDepthM < 1.5) {
    warnings.push(
      `Groundwater level খুব কাছে (${input.groundwaterDepthM}m) — shallow foundation-এ dewatering/waterproofing বিবেচনা প্রয়োজন হতে পারে, foundation type সাজেশনে এই ফ্যাক্টর হিসাব করা হয়নি।`
    );
  }

  // ধাপ ৪ — default
  reasoning.push(
    `Bearing pressure (${input.allowableBearingPressureKPa} kPa) পর্যাপ্ত এবং আনুমানিক footing সাইজ (≈${estimatedSideM.toFixed(2)}m) column spacing-এর (${input.typicalColumnSpacingM}m) তুলনায় যুক্তিসঙ্গত — isolated footing সবচেয়ে অর্থনৈতিক default অপশন।`
  );
  warnings.push(`গড় column load ${avgLoadKN.toFixed(0)} kN, সবচেয়ে ভারী ${maxLoadKN.toFixed(0)} kN — বড় তারতম্য থাকলে ভারী column-গুলোর জন্য আলাদাভাবে combined footing বিবেচনা করুন।`);

  return { suggestedType: "isolated-footing", confidence: "medium", reasoning, warnings };
}
