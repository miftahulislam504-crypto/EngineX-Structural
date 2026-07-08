/**
 * BNBC 2020 Seismic Load — Equivalent Lateral Force (ELF) পদ্ধতি
 * (BNBC 2020, Part 6, Chapter 2, Section 2.5 অনুযায়ী)।
 *
 * সততার সাথে সীমাবদ্ধতা: এটা BNBC 2020-এর ELF পদ্ধতির মূল সূত্র
 * (base shear, vertical distribution) বাস্তবায়ন করে — কিন্তু
 * Irregularity Check, Soft Story Detection, Torsion Check (এগুলো
 * Phase 8 এর Earthquake Engineering মডিউলে), এবং Response Spectrum/
 * Time History (Phase 4/6) এখানে নেই। ELF পদ্ধতি নিজেই BNBC 2020
 * অনুযায়ী শুধু নিয়মিত, নির্দিষ্ট উচ্চতার নিচের ভবনে প্রযোজ্য —
 * irregular বা উঁচু ভবনে Dynamic Analysis (Response Spectrum) বাধ্যতামূলক
 * হতে পারে, যা এই মডিউল হিসাব করে না।
 */

export type SeismicZone = "1" | "2" | "3" | "4"; // BNBC 2020 এ বাংলাদেশ ৪টা সিসমিক জোনে বিভক্ত, জোন ৪ সবচেয়ে বেশি ঝুঁকিপূর্ণ (সিলেট/চট্টগ্রামের কিছু অংশ)
export type SiteClass = "SA" | "SB" | "SC" | "SD" | "SE"; // BNBC 2020 Table 6.2.13 — মাটির শ্রেণী, SA সবচেয়ে শক্ত (rock), SE সবচেয়ে নরম
export type StructuralSystem =
  | "moment-frame-concrete"
  | "moment-frame-steel"
  | "shear-wall-concrete"
  | "dual-system";
export type OccupancyCategory = "I" | "II" | "III" | "IV"; // BNBC 2020 — IV সবচেয়ে গুরুত্বপূর্ণ (হাসপাতাল, জরুরি সেবা)

export interface SeismicLoadInput {
  seismicZone: SeismicZone;
  siteClass: SiteClass;
  structuralSystem: StructuralSystem;
  occupancyCategory: OccupancyCategory;
  buildingHeight: number; // মিটার
  seismicWeight: number; // kN — সাধারণত dead load + একাংশ live load (BNBC অনুযায়ী storage এর জন্য 25%, বাকিতে সাধারণত 0%)
  numberOfStories: number;
}

export interface SeismicLoadResult {
  seismicZoneCoefficient: number; // Z — BNBC 2020 Table 6.2.14
  responseModificationFactor: number; // R — কাঠামো সিস্টেম অনুযায়ী (ductility capacity)
  importanceFactor: number; // I — occupancy category অনুযায়ী
  seismicResponseCoefficient: number; // Cs
  fundamentalPeriod: number; // T, সেকেন্ড — approximate method (BNBC 2020 Eq. 6.2.18)
  baseShear: number; // V, kN
  storyForces: { storyIndex: number; force: number; cumulativeShear: number }[]; // Vertical distribution, story 1 = base এর ঠিক উপরের তলা
  warnings: string[];
}

/** BNBC 2020 Table 6.2.14 এর কাছাকাছি Seismic Zone Coefficient। */
function getZoneCoefficient(zone: SeismicZone): number {
  const zoneMap: Record<SeismicZone, number> = {
    "1": 0.12,
    "2": 0.2,
    "3": 0.28,
    "4": 0.36,
  };
  return zoneMap[zone];
}

/**
 * Response Modification Factor R — কাঠামো সিস্টেমের ductility capacity
 * অনুযায়ী (BNBC 2020 Table 6.2.19 এর একটা সরলীকৃত subset, সবচেয়ে
 * প্রচলিত সিস্টেমগুলোর জন্য)।
 */
function getResponseModificationFactor(system: StructuralSystem): number {
  const rMap: Record<StructuralSystem, number> = {
    "moment-frame-concrete": 8, // Special Moment Resisting Frame, ductile detailing ধরে নিয়ে
    "moment-frame-steel": 8,
    "shear-wall-concrete": 5,
    "dual-system": 7,
  };
  return rMap[system];
}

function getImportanceFactor(occupancy: OccupancyCategory): number {
  const iMap: Record<OccupancyCategory, number> = {
    I: 1.0,
    II: 1.0,
    III: 1.25,
    IV: 1.5,
  };
  return iMap[occupancy];
}

/**
 * Site Coefficient Fa/Fv এর একটা সরলীকৃত combined approximation —
 * BNBC 2020 এ এটা আসলে Ss/S1 (short/long period spectral acceleration)
 * এর উপর নির্ভরশীল একটা টেবিল-লুকআপ, কিন্তু preliminary estimate এর
 * জন্য soil class ভিত্তিক একটা single multiplier ব্যবহার করা হচ্ছে।
 */
function getSiteAmplificationFactor(siteClass: SiteClass): number {
  const factorMap: Record<SiteClass, number> = {
    SA: 0.8,
    SB: 1.0,
    SC: 1.2,
    SD: 1.5,
    SE: 2.0,
  };
  return factorMap[siteClass];
}

/**
 * BNBC 2020 Eq. 6.2.18 এর approximate fundamental period সূত্র:
 * T = Ct * h^x — কাঠামো সিস্টেম অনুযায়ী Ct ও x আলাদা। এখানে moment
 * frame concrete-এর মান ব্যবহার করা হয়েছে ডিফল্ট হিসেবে সরলতার জন্য;
 * shear wall system-এ প্রকৃতপক্ষে ভিন্ন Ct প্রযোজ্য যা এখানে
 * approximate করা হয়নি (T কে conservative দিকে সামান্য overestimate
 * করতে পারে shear wall building-এ, যা base shear-কে সামান্য
 * underestimate করতে পারে — তাই সবসময় প্রকৌশলী যাচাই প্রয়োজন)।
 */
function computeApproximatePeriod(height: number, system: StructuralSystem): number {
  const isConcreteMomentFrame = system === "moment-frame-concrete";
  const isSteelMomentFrame = system === "moment-frame-steel";

  if (isConcreteMomentFrame) {
    return 0.0466 * height ** 0.9;
  }
  if (isSteelMomentFrame) {
    return 0.0724 * height ** 0.8;
  }
  // shear-wall-concrete, dual-system — BNBC এর সাধারণ Ct=0.0488, x=0.75 ব্যবহার করা হচ্ছে
  return 0.0488 * height ** 0.75;
}

/**
 * সম্পূর্ণ BNBC 2020 ELF সিসমিক লোড হিসাব করে, base shear থেকে
 * story-wise vertical distribution পর্যন্ত (BNBC 2020 Eq. 6.2.34,
 * linear-with-height distribution, k=1 for T≤0.5s, k=2 for T≥2.5s,
 * মাঝেরটা interpolated — এই সরলীকরণ ASCE 7 এরও প্রচলিত পদ্ধতি)।
 */
export function computeSeismicLoad(input: SeismicLoadInput): SeismicLoadResult {
  const warnings: string[] = [];

  const Z = getZoneCoefficient(input.seismicZone);
  const R = getResponseModificationFactor(input.structuralSystem);
  const I = getImportanceFactor(input.occupancyCategory);
  const S = getSiteAmplificationFactor(input.siteClass);

  const T = computeApproximatePeriod(input.buildingHeight, input.structuralSystem);

  // Seismic Response Coefficient Cs = (Z * I * S) / R — BNBC 2020 এর
  // সরলীকৃত ফর্ম, period-dependent spectral shape factor বাদ দিয়ে
  // (পূর্ণাঙ্গ BNBC 2020 এ Cs আসলে T এর একটা function, খুব ছোট বা
  // খুব বড় T এ ভিন্ন limit প্রযোজ্য — এখানে mid-range T ধরে নেওয়া
  // সরলীকরণ ব্যবহার করা হয়েছে)।
  const Cs = (Z * I * S) / R;

  const baseShear = Cs * input.seismicWeight;

  if (input.buildingHeight > 40) {
    warnings.push(
      "⚠️ Building height 40m এর বেশি — BNBC 2020 অনুযায়ী এই পরিসরের ভবনে Dynamic Analysis (Response Spectrum) বাধ্যতামূলক হতে পারে, শুধু ELF যথেষ্ট নাও হতে পারে। একজন ইঞ্জিনিয়ারের যাচাই প্রয়োজন।"
    );
  }

  if (input.seismicZone === "4") {
    warnings.push(
      "⚠️ Seismic Zone 4 (সর্বোচ্চ ঝুঁকি) — বিশেষ detailing requirement এবং সম্ভবত Dynamic Analysis প্রযোজ্য হতে পারে।"
    );
  }

  // Vertical distribution — BNBC 2020 Eq. 6.2.34: Fx = Cvx * V, যেখানে
  // Cvx = (wx * hx^k) / Σ(wi * hi^k)। প্রতিটা story-র weight সমান ধরা
  // হচ্ছে এই সরলীকরণে (seismicWeight / numberOfStories) — বাস্তবে
  // প্রতিটা floor-এর ভিন্ন weight থাকতে পারে যা Phase 4+ এ element-level
  // load থেকে সঠিকভাবে হিসাব হবে।
  const k = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2; // linear interpolation, BNBC/ASCE 7 উভয়ের প্রচলিত পদ্ধতি
  const storyWeight = input.seismicWeight / input.numberOfStories;
  const storyHeight = input.buildingHeight / input.numberOfStories;

  const weightHeightProducts: number[] = [];
  for (let i = 1; i <= input.numberOfStories; i++) {
    const hx = i * storyHeight;
    weightHeightProducts.push(storyWeight * hx ** k);
  }
  const sumWeightHeightProducts = weightHeightProducts.reduce((sum, v) => sum + v, 0);

  const storyForces: SeismicLoadResult["storyForces"] = [];
  let cumulativeShear = 0;
  // উপর থেকে নিচের দিকে cumulative shear যোগ করা হচ্ছে (top story থেকে
  // শুরু, কারণ base shear top থেকে base পর্যন্ত ক্রমবর্ধমান হয়)।
  for (let i = input.numberOfStories; i >= 1; i--) {
    const Cvx = weightHeightProducts[i - 1] / sumWeightHeightProducts;
    const force = Cvx * baseShear;
    cumulativeShear += force;
    storyForces.push({ storyIndex: i, force, cumulativeShear });
  }
  storyForces.reverse(); // storyIndex 1 (নিচের তলা) আগে দেখানোর জন্য

  return {
    seismicZoneCoefficient: Z,
    responseModificationFactor: R,
    importanceFactor: I,
    seismicResponseCoefficient: Cs,
    fundamentalPeriod: T,
    baseShear,
    storyForces,
    warnings,
  };
}
