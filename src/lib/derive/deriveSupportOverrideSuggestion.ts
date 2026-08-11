/**
 * deriveSupportOverrideSuggestion — Phase 3-এর
 * deriveFoundationTypeSuggestion() থেকে একটা preliminary
 * supportType hint বের করে (Phase 5 override hook-এর ইনপুট
 * হিসেবে ব্যবহারযোগ্য)।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 5 আইটেম: "Hub-এর/Structural-এর geotechnical
 * suggestion দিয়ে hardcoded 'base = fixed' heuristic override করার
 * optional input path"।
 *
 * ⚠️ সততার সাথে সীমাবদ্ধতা — এটা কোনো rigorous geotechnical মডেল
 * না। Foundation type থেকে support boundary condition সরাসরি derive
 * করা একটা বড় সরলীকরণ:
 *   - Pile foundation মানেই automatically "pinned" support না —
 *     আসল rotational stiffness নির্ভর করে pile group configuration,
 *     pile-cap rigidity, ও soil lateral stiffness এর উপর। এখানে
 *     "pinned" শুধু একটা conservative starting suggestion (rotation
 *     capacity overestimate না করা), চূড়ান্ত মান না।
 *   - Mat foundation ও isolated footing উভয়ই "fixed" সাজেস্ট করা
 *     হয় — এটাও একটা সরলীকরণ, প্রকৃতপক্ষে rigid mat vs soft soil
 *     এর উপর ভিত্তি করে rotational spring stiffness varies করা উচিত
 *     (সেটা এই ফাংশনের স্কোপে নেই, spring/custom support type এখনো
 *     এখানে auto-generate হয় না)।
 *
 * তাই এই ফাংশন কখনো silently একটা SupportOverride "প্রয়োগ" করে না —
 * শুধু suggestion + reasoning রিটার্ন করে, চূড়ান্ত সিদ্ধান্ত ও
 * SupportOverride অবজেক্ট বানানো ইঞ্জিনিয়ারের/UI workflow এর
 * দায়িত্ব (deriveFoundationTypeSuggestion() এর মতোই একই honest
 * pattern — "suggestion" শব্দটা এই ফাইলের নামেও ইচ্ছাকৃতভাবে রাখা
 * হলো)।
 */

import type { FoundationTypeSuggestion } from "@/lib/derive/deriveFoundationTypeSuggestion";
import type { SupportType } from "@/lib/compute/client";

export interface SupportOverrideSuggestion {
  suggestedSupportType: SupportType;
  reasoning: string[];
  warnings: string[];
}

/**
 * FoundationTypeSuggestion (Phase 3) থেকে একটা preliminary
 * supportType suggestion বের করে। এই ফাংশন নিজে কোনো coordinate
 * জানে না — caller কে ঠিক করতে হবে কোন base-level node/coordinate
 * এ এই suggestion প্রয়োগ করা হবে (SupportOverride বানানোর সময়)।
 */
export function deriveSupportOverrideSuggestion(
  foundationSuggestion: FoundationTypeSuggestion
): SupportOverrideSuggestion {
  const warnings = [
    "এটা একটা preliminary suggestion, চূড়ান্ত geotechnical সিদ্ধান্ত না — pile group configuration, pile-cap rigidity, ও soil lateral stiffness বিবেচনা করা হয়নি। ইঞ্জিনিয়ারের যাচাই ছাড়া সরাসরি প্রয়োগ করবেন না।",
  ];

  if (foundationSuggestion.suggestedType === "pile-cap") {
    return {
      suggestedSupportType: "pinned",
      reasoning: [
        "Pile foundation সাজেস্ট হয়েছে — conservative starting point হিসেবে 'pinned' (rotation free) সাজেস্ট করা হলো, যাতে rotational restraint overestimate না হয়। প্রকৃত pile-cap rigidity বেশি rotational stiffness দিতে পারে, কিন্তু সেটা ধরে নেওয়া এই মুহূর্তে অনিরাপদ (unconservative)।",
      ],
      warnings,
    };
  }

  return {
    suggestedSupportType: "fixed",
    reasoning: [
      `${foundationSuggestion.suggestedType === "mat-foundation" ? "Mat foundation" : "Isolated/combined footing"} সাজেস্ট হয়েছে — shallow foundation-এ সাধারণত fully-fixed ধরা হয় (rigid base assumption), যা এই মুহূর্তে বিদ্যমান Y≈0 heuristic-এর সাথেও সামঞ্জস্যপূর্ণ।`,
    ],
    warnings,
  };
}
