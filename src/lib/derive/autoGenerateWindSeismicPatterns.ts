/**
 * autoGenerateWindSeismicPatterns.ts — deriveWindLoad/deriveSeismicLoad
 * এর ফলাফল থেকে Wind X/Y ও EQ X/Y LoadPattern তৈরি করে।
 * ------------------------------------------------------------------
 * Dead/Live pattern createDefaultLoadPatternLibrary() (loads/firestore.ts)
 * এ ফিক্সড আইডি দিয়ে প্রজেক্ট শুরুতেই auto-create হয়। Wind/Seismic
 * pattern একই স্টাইলের ফিক্সড আইডি ব্যবহার করে (patternId বদলায় না,
 * শুধু value recompute হয়) — কিন্তু শুরুতেই না, কারণ এর জন্য Hub sync
 * + geometry + (seismic এর ক্ষেত্রে) অন্তত একটা element দরকার।
 *
 * এই ফাইল ইচ্ছাকৃতভাবে শুধু LoadPattern object তৈরি করে, Firestore এ
 * write করে না (pure function, deriveSelfWeightLoads.ts এর প্যাটার্নে)
 * — caller (useAutoLoadSync hook, Step 3) write এর সিদ্ধান্ত নেবে।
 *
 * element-level এ story force কীভাবে distribute হবে (কোন column গুলোতে,
 * কী অনুপাতে) — সেই সিদ্ধান্ত ইচ্ছাকৃতভাবে এই ফাইলের বাইরে রাখা হয়েছে।
 * এখানে শুধু pattern (নাম, category) + প্রতি story এর net force
 * তথ্য রিটার্ন করা হচ্ছে; element এ কেসিং বসানো Step 3 এ আলাদা করে
 * ডিজাইন করা হবে, কারণ distribution rule (equal vs stiffness-
 * proportional vs tributary-area) একটা স্বতন্ত্র প্রকৌশল সিদ্ধান্ত।
 */

import type { LoadPattern } from "@/lib/types/load";
import type { DerivedWindLoadByDirection } from "@/lib/derive/deriveWindLoad";
import type { DerivedSeismicLoadResult } from "@/lib/derive/deriveSeismicLoad";
import type { WindLoadResult } from "@/lib/loads/windLoad";
import type { SeismicLoadResult } from "@/lib/loads/seismicLoad";

export interface AutoWindSeismicPatternsResult {
  patterns: LoadPattern[];
  /** প্রতিটা pattern এর প্রতি-story নেট force (kN) — Step 3 এ element-distribution এর ইনপুট হবে। */
  windStoryForces: { patternId: string; direction: "X" | "Y"; forces: WindLoadResult["storyForces"] }[];
  seismicStoryForces: { patternId: string; direction: "X" | "Y"; forces: SeismicLoadResult["storyForces"] }[];
  warnings: string[];
}

const WIND_X_PATTERN_ID = "pattern-auto-wind-x";
const WIND_Y_PATTERN_ID = "pattern-auto-wind-y";
const EQ_X_PATTERN_ID = "pattern-auto-eq-x";
const EQ_Y_PATTERN_ID = "pattern-auto-eq-y";

function makePattern(patternId: string, name: string, category: "wind" | "earthquake", now: string): LoadPattern {
  return { patternId, name, category, createdAt: now, updatedAt: now };
}

/**
 * Wind ও Seismic derive ফলাফল থেকে ৪টা pattern (Wind X, Wind Y, EQ X,
 * EQ Y) তৈরি করে — BNBC 2020 এ উভয় প্রধান axis এ আলাদাভাবে লোড
 * প্রয়োগ বাধ্যতামূলক।
 *
 * Wind: এখন সত্যিকারের direction-aware (deriveWindLoad.ts, ২০২৬-০৮) —
 * windResult.x ও windResult.y আলাদাভাবে computeWindLoad() কল করে
 * আসে (প্রতিটার নিজস্ব perpendicular buildingWidth সহ), তাই asymmetric
 * plan-এ Wind X ও Wind Y ভিন্ন magnitude পায় (আগে একই magnitude
 * দুই axis এ বসানো হতো)।
 *
 * Seismic: ইচ্ছাকৃতভাবে এখনো একই magnitude দুই axis এ (এটা bug না) —
 * BNBC 2020 Equivalent Lateral Force (ELF) পদ্ধতিতে base shear মূলত
 * seismicWeight/fundamentalPeriod/zone/site-class এর ফাংশন, building
 * plan width-এর সরাসরি ফাংশন না (wind pressure-এর মতো width দিয়ে
 * গুণ হয় না) — তাই একই ভবনের X ও Y direction-এ magnitude একই থাকাটা
 * ELF-এর normal, প্রত্যাশিত আচরণ, wind-এর মতো width-সংক্রান্ত সীমাবদ্ধতা
 * না। (বাস্তবে asymmetric building-এ actual response ভিন্ন হতে পারে
 * torsional effect/irregular mass distribution এর কারণে, কিন্তু সেটা
 * ELF-এর base-shear magnitude সূত্রের সীমাবদ্ধতা না, বরং Irregularity
 * Check/Torsion Check মডিউলের scope — যা এই ফাইলের বাইরে।)
 *
 * derive ফলাফল অনুপস্থিত (input: null) হলে সংশ্লিষ্ট pattern তৈরি হয়
 * না — শুধু warning যোগ হয়। Wind X ও Wind Y এখন independent, তাই
 * একটা insufficient-data হলেও আরেকটা তৈরি হতে পারে (উদাহরণ: X-direction
 * এ grid সম্পূর্ণ কিন্তু Y-direction এ না, যদিও বাস্তবে computeBuildingFootprint
 * উভয় span-ই একসাথে দরকার করে, তাই এই case বিরল)।
 */
export function autoGenerateWindSeismicPatterns(
  windResult: DerivedWindLoadByDirection,
  seismicResult: DerivedSeismicLoadResult
): AutoWindSeismicPatternsResult {
  const now = new Date().toISOString();
  const patterns: LoadPattern[] = [];
  const windStoryForces: AutoWindSeismicPatternsResult["windStoryForces"] = [];
  const seismicStoryForces: AutoWindSeismicPatternsResult["seismicStoryForces"] = [];
  const warnings: string[] = [...windResult.x.warnings, ...windResult.y.warnings, ...seismicResult.warnings];

  if (windResult.x.result) {
    patterns.push(makePattern(WIND_X_PATTERN_ID, "Wind X (WX) — Auto", "wind", now));
    windStoryForces.push({ patternId: WIND_X_PATTERN_ID, direction: "X", forces: windResult.x.result.storyForces });
  } else {
    warnings.push("Wind X pattern তৈরি হয়নি — উপরের warning অনুযায়ী প্রয়োজনীয় geometry/Hub ডেটা পূরণ করুন।");
  }

  if (windResult.y.result) {
    patterns.push(makePattern(WIND_Y_PATTERN_ID, "Wind Y (WY) — Auto", "wind", now));
    windStoryForces.push({ patternId: WIND_Y_PATTERN_ID, direction: "Y", forces: windResult.y.result.storyForces });
  } else {
    warnings.push("Wind Y pattern তৈরি হয়নি — উপরের warning অনুযায়ী প্রয়োজনীয় geometry/Hub ডেটা পূরণ করুন।");
  }

  if (seismicResult.result) {
    patterns.push(makePattern(EQ_X_PATTERN_ID, "Seismic X (EQX) — Auto", "earthquake", now));
    patterns.push(makePattern(EQ_Y_PATTERN_ID, "Seismic Y (EQY) — Auto", "earthquake", now));
    seismicStoryForces.push(
      { patternId: EQ_X_PATTERN_ID, direction: "X", forces: seismicResult.result.storyForces },
      { patternId: EQ_Y_PATTERN_ID, direction: "Y", forces: seismicResult.result.storyForces }
    );
  } else {
    warnings.push("Seismic pattern তৈরি হয়নি — উপরের warning অনুযায়ী প্রয়োজনীয় geometry/element ডেটা পূরণ করুন।");
  }

  return { patterns, windStoryForces, seismicStoryForces, warnings };
}
