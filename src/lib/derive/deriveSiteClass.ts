/**
 * deriveSiteClass — Hub-এর soilType (S1-S4) → এই App-এর SiteClass (SA-SE)
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 1 আইটেম: "Hub-এর S1-S4 → Structural-এর SA-SE conversion
 * (এই দুটো টাইপ সরাসরি মেলে না)।"
 *
 * ⚠️ গুরুত্বপূর্ণ — এই দুটো নামকরণ ভিন্ন উৎসের, সরাসরি rename না:
 *
 * Hub-এর SiteInfo.soilType ('S1'-'S4', src/lib/hub/hub-module-shapes.ts
 * এর HubSiteInfoData দেখুন) একটা ৪-ধাপের shear-wave-velocity (vs)
 * classification, Hub-এর নিজের site-info.types.ts এ সংজ্ঞায়িত:
 *   S1 (শক্ত পাথর):        vs > 800 m/s
 *   S2 (খুব ঘন/নরম পাথর):  360 < vs ≤ 800 m/s
 *   S3 (শক্ত মাটি):         180 < vs ≤ 360 m/s
 *   S4 (নরম কাদামাটি):      vs ≤ 180 m/s
 *
 * এই App-এর SiteClass ('SA'-'SE', lib/loads/seismicLoad.ts) হলো BNBC
 * 2020 Table 6.2.13-এর নিজস্ব ৭-ধাপের site classification (SA/SB/SC/SD/
 * SE + বিশেষ S1/S2 — হ্যাঁ, BNBC নিজেও "S1"/"S2" নাম ব্যবহার করে, কিন্তু
 * Hub-এর S1-S4 থেকে সম্পূর্ণ ভিন্ন জিনিস বোঝাতে — বিভ্রান্তি এড়াতে এই
 * ফাইলে সবসময় "BNBC S1/S2" বলে স্পষ্ট করা হয়েছে)। BNBC 2020-এর মূল
 * table (UBC 1997-এর same numeric boundary অনুসরণ করে):
 *   SA (Hard Rock):        vs > 1500 m/s
 *   SB (Rock):              760 < vs ≤ 1500 m/s
 *   SC (Very Dense/Soft Rock): 360 < vs ≤ 760 m/s
 *   SD (Stiff Soil):        180 < vs ≤ 360 m/s
 *   SE (Soft Soil):          vs ≤ 180 m/s (বা নির্দিষ্ট alluvium-over-rock প্রোফাইল)
 *   BNBC S1 (Soft Soil, special study প্রয়োজন): PI ≥ 40, উচ্চ পানির পরিমাণ, খুব কম vs (নির্দেশক vs < 100 m/s)
 *   BNBC S2 (Liquefiable/Sensitive Soil, special study প্রয়োজন): liquefiable বা sensitive clay — কোনো নির্দিষ্ট vs রেঞ্জ নেই, geotechnical বিচার প্রয়োজন
 *
 * Hub-এর ৪-ধাপ কম granular — Hub-এর boundary গুলো BNBC-এর boundary এর
 * সাথে আংশিক মেলে (Hub S3 এর 180-360 = BNBC SD এর সাথে হুবহু মেলে) কিন্তু
 * Hub-এর S1/S2 প্রতিটাই BNBC-এর একাধিক class কভার করে (Hub S1 এর ">800"
 * BNBC-এর SA ">1500" আর SB-এর একটা অংশ "760-1500" দুটোই কভার করে,
 * নির্দিষ্টভাবে আলাদা করার তথ্য নেই)। তাই এই conversion কখনোই ১০০%
 * নিশ্চিত হতে পারবে না vs-এর প্রকৃত সংখ্যা (Hub এখন শুধু bucket পাঠায়,
 * সংখ্যা না) না জানা পর্যন্ত — প্রতিটা ফলাফলে confidence flag আবশ্যক।
 */

import type { SiteClass } from "@/lib/loads/seismicLoad";
import type { HubSiteInfoData } from "@/lib/hub/hub-module-shapes";

export type SiteClassConfidence = "confirmed" | "approximate";

export interface DerivedSiteClass {
  siteClass: SiteClass;
  confidence: SiteClassConfidence;
  /** ইঞ্জিনিয়ারকে দেখানোর জন্য — কেন এই confidence, কী যাচাই করা উচিত। */
  note: string;
}

/**
 * Hub-এর ৪-ধাপ soilType কে এই App-এর SiteClass-এ map করে।
 *
 * শুধু Hub-এর S3 (180 < vs ≤ 360) BNBC-এর SD (180 < vs ≤ 360)-এর সাথে
 * exact boundary মেলে — তাই এটাই একমাত্র 'confirmed' ফলাফল। বাকি তিনটা
 * (S1, S2, S4) Hub-এর bucket-এর মধ্যে BNBC-এর একাধিক class পড়তে পারে,
 * তাই সেই bucket-এর মধ্যে সবচেয়ে সাধারণ/প্রচলিত sub-class বেছে নেওয়া
 * হয়েছে conservative না হয়ে বাস্তবসম্মত দিকে (দেখুন প্রতিটা case-এর
 * কমেন্ট) — কিন্তু 'approximate' flag সহ, যাতে ইঞ্জিনিয়ার geotechnical
 * report থেকে প্রকৃত vs/N-value দেখে override করতে পারেন।
 */
export function deriveSiteClass(soilType: HubSiteInfoData["soilType"]): DerivedSiteClass {
  switch (soilType) {
    case "S1":
      // Hub: vs > 800 m/s. BNBC-এর SA (>1500) ও SB-এর ওপরের অংশ
      // (760-1500) দুটোই এই রেঞ্জে পড়ে। বাংলাদেশে vs > 1500 m/s (true
      // hard rock, SA) খুবই বিরল (পার্বত্য চট্টগ্রাম/সিলেটের কিছু
      // pocket ছাড়া) — তাই বেশিরভাগ বাস্তব "S1" সাইট আসলে SB রেঞ্জে
      // পড়ে। conservative দিকে (SB, কম R না বাড়ানো) বেছে নেওয়া হয়েছে।
      return {
        siteClass: "SB",
        confidence: "approximate",
        note: "Hub 'S1' (vs > 800 m/s) BNBC-এর SA ও SB দুটোতেই পড়তে পারে — SB (760-1500 m/s) ধরা হয়েছে সাধারণ ক্ষেত্রে বেশি প্রযোজ্য বলে। প্রকৃত geotechnical report-এ vs > 1500 m/s নিশ্চিত হলে SA-তে পরিবর্তন করুন।",
      };
    case "S2":
      // Hub: 360 < vs ≤ 800 m/s. BNBC-এর SB-এর নিচের অংশ (760-800) ও
      // পুরো SC (360-760) কভার করে। রেঞ্জের সিংহভাগ SC-তে পড়ে (360-760
      // বনাম 760-800), তাই SC বেছে নেওয়া হয়েছে।
      return {
        siteClass: "SC",
        confidence: "approximate",
        note: "Hub 'S2' (360 < vs ≤ 800 m/s) মূলত BNBC-এর SC (360-760 m/s) রেঞ্জের সাথে মেলে, রেঞ্জের ওপরের প্রান্তে (760-800) সামান্য SB-তে গেলেও। প্রকৃত geotechnical report-এ vs > 760 m/s নিশ্চিত হলে SB-তে পরিবর্তন করুন।",
      };
    case "S3":
      // Hub: 180 < vs ≤ 360 m/s — BNBC-এর SD (180 < vs ≤ 360) এর
      // সাথে exact মেলে, কোনো সীমারেখা ভিন্নতা নেই।
      return {
        siteClass: "SD",
        confidence: "confirmed",
        note: "Hub 'S3' (180 < vs ≤ 360 m/s) BNBC-এর SD (180 < vs ≤ 360 m/s) এর সাথে সীমারেখা-অনুযায়ী হুবহু মেলে।",
      };
    case "S4":
      // Hub: vs ≤ 180 m/s. BNBC-এর SE (vs ≤ 180, সাধারণ soft soil) ও
      // বিশেষ BNBC S1 (খুব কম vs, PI ≥ 40 হলে, indicative vs < 100)
      // দুটোই এই রেঞ্জে পড়তে পারে। BNBC S1/S2 প্রতিটাই mandatory
      // site-specific geotechnical study দাবি করে (শুধু classification
      // দিয়ে design করা যায় না) — তাই Hub S4-কে নিরাপদ default হিসেবে
      // সাধারণ SE ধরা হয়েছে, কিন্তু warning-এ special-study সম্ভাবনার
      // কথা স্পষ্টভাবে বলা হয়েছে যাতে ইঞ্জিনিয়ার ভুলবশত এড়িয়ে না যান।
      return {
        siteClass: "SE",
        confidence: "approximate",
        note: "Hub 'S4' (vs ≤ 180 m/s) সাধারণত BNBC-এর SE ধরা হয়েছে। কিন্তু যদি geotechnical report-এ উচ্চ plasticity clay (PI ≥ 40) বা liquefiable soil ধরা পড়ে, BNBC-এর বিশেষ S1/S2 শ্রেণী প্রযোজ্য হতে পারে — এক্ষেত্রে site-specific special study বাধ্যতামূলক (শুধু এই ৪-ধাপ Hub শ্রেণীবিভাগ দিয়ে design করা BNBC 2020 অনুযায়ী গ্রহণযোগ্য না)। একজন geotechnical ইঞ্জিনিয়ারের যাচাই অপরিহার্য।",
      };
    default:
      // Hub-এর টাইপ system অনুযায়ী এই branch পৌঁছানো উচিত না, কিন্তু
      // runtime-এ malformed/unexpected ডেটা এলে (Hub-এর schema বদলালে,
      // বা partial/corrupt document) crash না করে নিরাপদ, স্পষ্টভাবে
      // "যাচাই ছাড়া ব্যবহার করবেন না" ধরনের ফলব্যাক দেওয়া হচ্ছে।
      return {
        siteClass: "SD",
        confidence: "approximate",
        note: `অপরিচিত Hub soilType মান: "${String(soilType)}" — কোনো conversion rule নেই। নিরাপদ মধ্যবর্তী ডিফল্ট (SD) বসানো হয়েছে, কিন্তু এটা অগ্রহণযোগ্য অনুমান — geotechnical report থেকে সরাসরি সঠিক SiteClass ইঞ্জিনিয়ারকে ম্যানুয়ালি বসাতে হবে।`,
      };
  }
}
