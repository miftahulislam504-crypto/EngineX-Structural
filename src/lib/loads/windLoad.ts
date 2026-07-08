/**
 * BNBC 2020 Wind Load — Equivalent Static Wind Force পদ্ধতি
 * (BNBC 2020, Part 6, Chapter 2 অনুযায়ী, ASCE 7 এর সরলীকৃত পদ্ধতির
 * সাথে সাদৃশ্যপূর্ণ)।
 *
 * সততার সাথে একটা গুরুত্বপূর্ণ সীমাবদ্ধতা বলা দরকার: এই মডিউলটা
 * BNBC 2020-এর **সরলীকৃত/প্রাথমিক ডিজাইন পদ্ধতি** বাস্তবায়ন করে —
 * বেসিক wind speed থেকে design wind pressure পর্যন্ত মূল সূত্রগুলো।
 * এটা BNBC 2020-এর সম্পূর্ণ Chapter 2 না — Gust Effect Factor-এর
 * পূর্ণাঙ্গ dynamic/resonant calculation (buildings with h > 60m বা
 * flexible structures এর জন্য প্রয়োজনীয়), Directionality Factor-এর
 * সব case, এবং Topographic Factor Kzt এর পূর্ণাঙ্গ hill/ridge geometry
 * bad এখানে সরলীকৃত (rigid structure, flat terrain ধরে নেওয়া হয়েছে)।
 * একটা rigid, নিয়মিত আকৃতির (< 60m উঁচু) building-এর preliminary
 * design-এর জন্য এই হিসাব যথেষ্ট নির্ভরযোগ্য, কিন্তু চূড়ান্ত ডিজাইনের
 * আগে একজন লাইসেন্সপ্রাপ্ত ইঞ্জিনিয়ারের ফুল BNBC/ASCE 7 চেক করা উচিত।
 */

export interface WindLoadInput {
  basicWindSpeed: number; // V, m/s — BNBC 2020 wind zone map থেকে (ঢাকার জন্য সাধারণত 47-50 m/s এর কাছাকাছি রেঞ্জে, কিন্তু জোন অনুযায়ী ভিন্ন হয়, ব্যবহারকারীকে সাইট-নির্দিষ্ট মান দিতে হবে)
  exposureCategory: "A" | "B" | "C" | "D"; // BNBC 2020 Terrain Exposure — A: বড় শহরের কেন্দ্র, B: শহুরে/উপশহুরে, C: খোলা এলাকা, D: উপকূলীয়/সমতল জলাশয়ের ধারে
  buildingHeight: number; // মিটার, mean roof height
  buildingWidth: number; // মিটার, wind এর perpendicular দিকের প্রস্থ (windward face width)
  importanceFactor: number; // BNBC 2020 Table 6.2.9 অনুযায়ী — সাধারণ ভবন: 1.0, জরুরি সেবা ভবন (হাসপাতাল ইত্যাদি): 1.15
  structureType: "rigid" | "flexible"; // flexible হলে (h/w > 4, বা natural period > 1 sec) dynamic gust effect লাগে যা এই মডিউলে সরলীকৃত করা হয়নি
}

export interface WindLoadResult {
  velocityPressure: number; // qz, kN/m² — reference velocity pressure, mean roof height এ
  gustEffectFactor: number; // G — rigid structure এর জন্য BNBC 2020 এ সাধারণত 0.85 ব্যবহৃত হয় (simplified)
  designWindPressure: number; // p = qz * G * Cp, kN/m² (windward face, Cp ধরা হয়েছে 0.8 — BNBC Table অনুযায়ী rectangular building windward wall)
  totalBaseShearEstimate: number; // kN — designWindPressure * buildingHeight * buildingWidth (একটা rough estimate, actual distribution Phase 8 এ বিস্তারিত হবে)
  warnings: string[];
}

/**
 * Exposure Category অনুযায়ী terrain exposure constant Kz (simplified,
 * mean roof height ভিত্তিক, BNBC 2020 Table 6.2.10 এর একটা সরলীকৃত
 * approximation)। পূর্ণাঙ্গ BNBC টেবিলে height-varying Kz profile
 * আছে, এখানে mean roof height এ single-point মান ব্যবহার করা হচ্ছে
 * (rigid, নিয়মিত আকৃতির building-এর preliminary check এর জন্য যথেষ্ট)।
 */
function getExposureConstant(exposureCategory: WindLoadInput["exposureCategory"], height: number): number {
  // এই মানগুলো BNBC 2020 / ASCE 7 এর Kz টেবিলের mean roof height
  // অংশের কাছাকাছি approximation, exact table interpolation না।
  const baseKz: Record<WindLoadInput["exposureCategory"], number> = {
    A: 0.64,
    B: 0.85,
    C: 1.0,
    D: 1.15,
  };

  const heightFactor = height <= 15 ? 1.0 : 1.0 + (height - 15) * 0.008; // উচ্চতার সাথে সামান্য বৃদ্ধি, rough approximation
  return baseKz[exposureCategory] * heightFactor;
}

/**
 * BNBC 2020 এর সরলীকৃত wind load সূত্র প্রয়োগ করে।
 * qz = 0.613 * Kz * Kzt * Kd * V² (Pa এককে, তারপর kN/m² এ রূপান্তর)
 * এখানে Kzt (topographic) = 1.0 এবং Kd (directionality) = 0.85 ধরে
 * নেওয়া হয়েছে (rectangular building, flat terrain এর জন্য প্রচলিত
 * ডিফল্ট মান)।
 */
export function computeWindLoad(input: WindLoadInput): WindLoadResult {
  const warnings: string[] = [];

  if (input.structureType === "flexible") {
    warnings.push(
      "⚠️ Flexible structure নির্বাচিত হয়েছে — এই মডিউল dynamic/resonant gust effect factor হিসাব করে না। h/w > 4 বা natural period > 1 sec হলে একজন ইঞ্জিনিয়ারের পূর্ণাঙ্গ BNBC 2020 Chapter 2 dynamic analysis করা উচিত।"
    );
  }

  if (input.buildingHeight > 60) {
    warnings.push(
      "⚠️ Building height 60m এর বেশি — BNBC 2020 এ এই উচ্চতার ভবনের জন্য আরও বিস্তারিত wind tunnel study বা dynamic analysis সুপারিশ করা হয়। এই সরলীকৃত হিসাব preliminary estimate হিসেবেই ব্যবহার করুন।"
    );
  }

  const Kz = getExposureConstant(input.exposureCategory, input.buildingHeight);
  const Kzt = 1.0; // topographic factor — সমতল ভূমি ধরে নেওয়া হয়েছে
  const Kd = 0.85; // directionality factor — rectangular building এর প্রচলিত মান

  // qz = 0.613 * Kz * Kzt * Kd * V² — এই সূত্রের 0.613 constant SI
  // এককে (V m/s এ, ফলাফল Pa তে) ASCE 7 / BNBC 2020 এর প্রচলিত মান।
  const velocityPressurePa =
    0.613 * Kz * Kzt * Kd * input.basicWindSpeed ** 2 * input.importanceFactor;
  const velocityPressure = velocityPressurePa / 1000; // Pa → kN/m²

  const gustEffectFactor = input.structureType === "rigid" ? 0.85 : 1.0; // flexible এর জন্য এখানে রক্ষণশীলভাবে 1.0 ব্যবহার করা হচ্ছে যতক্ষণ না প্রকৃত dynamic factor হিসাব করা হয়, কিন্তু এটা underestimate হতে পারে — তাই উপরের warning গুরুত্বপূর্ণ

  const Cp = 0.8; // windward wall pressure coefficient, rectangular building এর প্রচলিত মান (BNBC Table)

  const designWindPressure = velocityPressure * gustEffectFactor * Cp;
  const totalBaseShearEstimate = designWindPressure * input.buildingHeight * input.buildingWidth;

  return {
    velocityPressure,
    gustEffectFactor,
    designWindPressure,
    totalBaseShearEstimate,
    warnings,
  };
}
