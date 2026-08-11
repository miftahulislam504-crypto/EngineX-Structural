/**
 * deriveLiveLoad — Hub-এর LIVE_LOAD_TYPES টেবিল Structural-এ একীভূত।
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 3 আইটেম: "Hub-এর ... LIVE_LOAD_TYPES লজিক ...
 * Structural-এর সাথে একীভূত করে একটাই entry point বানানো।"
 *
 * Structural app-এ এখন পর্যন্ত নিজস্ব কোনো live-load-type টেবিল নেই
 * (grep করে verify করা হয়েছে — src/lib/loads/ এ কোনো liveLoad
 * reference নেই)। তাই এখানে duplicate/reconcile করার কিছু নেই —
 * সরাসরি Hub-এর টেবিল (lib/types/bnbc.types.ts, LIVE_LOAD_TYPES,
 * BNBC 2020 Table 6.2.1) পোর্ট করা হলো।
 *
 * Hub-এর HubBnbcSettingsData ইতিমধ্যে liveLoadType (label) ও
 * liveLoadValue (kN/m², pre-computed) দুটোই পাঠায় — তাই সরাসরি Hub
 * data থাকলে value recompute করার দরকার নেই, শুধু cross-check করে
 * সামঞ্জস্য যাচাই করা হয়। এই টেবিল মূলত standalone ব্যবহারের জন্য
 * (Hub data অনুপস্থিত থাকলে) এবং validation-এর জন্য।
 */

import type { HubBnbcSettingsData } from "@/lib/hub/hub-module-shapes";

/** Hub-এর lib/types/bnbc.types.ts এর LIVE_LOAD_TYPES এর সাথে হুবহু মেলানো (label ও value দুটোই), BNBC 2020 Table 6.2.1। */
export const LIVE_LOAD_TYPES = [
  { label: "আবাসিক (Residential)", value: 2.0 },
  { label: "অফিস (Office)", value: 2.5 },
  { label: "শ্রেণিকক্ষ (Classroom)", value: 3.0 },
  { label: "দোকান / বাণিজ্যিক (Commercial)", value: 4.0 },
  { label: "গুদাম হালকা (Light Storage)", value: 6.0 },
  { label: "গুদাম ভারী (Heavy Storage)", value: 12.0 },
  { label: "হাসপাতাল (Hospital)", value: 3.0 },
  { label: "হোটেল (Hotel)", value: 2.0 },
  { label: "ছাদ (Roof — Accessible)", value: 1.5 },
  { label: "ছাদ (Roof — Inaccessible)", value: 0.75 },
  { label: "সিঁড়ি (Staircase)", value: 3.0 },
  { label: "সমাবেশ (Assembly)", value: 5.0 },
] as const;

export type LiveLoadTypeLabel = (typeof LIVE_LOAD_TYPES)[number]["label"];

export interface DerivedLiveLoad {
  liveLoadValueKnM2: number;
  source: "hub" | "local-table" | "hub-mismatch-local-used";
  warnings: string[];
}

/**
 * label থেকে স্থানীয় টেবিলের value খুঁজে বের করে। label না মিললে
 * (Hub-এর টেবিল ভবিষ্যতে বদলালে, বা free-text ভিন্ন হলে) undefined।
 */
function lookupLocalValue(label: string): number | undefined {
  return LIVE_LOAD_TYPES.find((t) => t.label === label)?.value;
}

/**
 * Live load value derive করে — Hub থেকে bnbcSettings পাওয়া গেলে
 * সেটার liveLoadValue-কে primary ধরে, শুধু local টেবিলের সাথে
 * cross-check করে সামঞ্জস্য যাচাই করে (mismatch হলে warn করে কিন্তু
 * তবুও Hub-এর মানই ব্যবহার করে — Hub-এর ডেটা project-specific হতে
 * পারে, স্থানীয় টেবিল শুধু BNBC-এর সাধারণ reference)।
 */
export function deriveLiveLoad(hubBnbcSettings?: Pick<HubBnbcSettingsData, "liveLoadType" | "liveLoadValue">): DerivedLiveLoad {
  const warnings: string[] = [];

  if (hubBnbcSettings) {
    const localValue = lookupLocalValue(hubBnbcSettings.liveLoadType);

    if (localValue === undefined) {
      warnings.push(
        `Hub-এর liveLoadType লেবেল ("${hubBnbcSettings.liveLoadType}") স্থানীয় BNBC টেবিলে পাওয়া যায়নি — Hub-এর সরাসরি মান (${hubBnbcSettings.liveLoadValue} kN/m²) ব্যবহার করা হলো, কিন্তু টেবিল mismatch হতে পারে (Hub-এর টেবিল আপডেট হয়ে থাকতে পারে)।`
      );
      return { liveLoadValueKnM2: hubBnbcSettings.liveLoadValue, source: "hub", warnings };
    }

    if (Math.abs(localValue - hubBnbcSettings.liveLoadValue) > 0.01) {
      warnings.push(
        `Hub-এর liveLoadValue (${hubBnbcSettings.liveLoadValue} kN/m²) স্থানীয় BNBC টেবিলের মান (${localValue} kN/m², "${hubBnbcSettings.liveLoadType}") থেকে ভিন্ন — Hub-এর মানই ব্যবহার করা হলো (সম্ভবত ইঞ্জিনিয়ার Hub-এ manual override করেছেন), যাচাই করুন।`
      );
      return { liveLoadValueKnM2: hubBnbcSettings.liveLoadValue, source: "hub-mismatch-local-used", warnings };
    }

    return { liveLoadValueKnM2: hubBnbcSettings.liveLoadValue, source: "hub", warnings };
  }

  warnings.push("Hub bnbc_settings পাওয়া যায়নি — কোনো ডিফল্ট live load value নির্ধারণ করা যায়নি, ইঞ্জিনিয়ারকে ম্যানুয়ালি একটা occupancy type বেছে নিতে হবে।");
  return { liveLoadValueKnM2: 0, source: "local-table", warnings };
}
