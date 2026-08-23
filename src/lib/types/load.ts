/**
 * Load Management Types (Phase 3 — Section 5)
 *
 * Master Plan-এর সম্পূর্ণ তালিকা: Dead, Live, Wind, Earthquake, Snow,
 * Rain, Temperature, Settlement, Moving Load, Vehicle Load, Bridge
 * Load, Hydrostatic Load, Soil Pressure, Blast, Impact, Dynamic Load,
 * Construction Load, Equipment Load, Custom Load।
 *
 * এর মধ্যে তিনটা — Bridge Load, Vehicle/Moving Load, Blast Load —
 * ইচ্ছাকৃতভাবে শুধু placeholder টাইপ হিসেবে আছে, কোনো UI ফর্ম নেই।
 * কারণ:
 *   - Bridge/Vehicle/Moving Load: influence-line analysis দাবি করে
 *     (একটা moving point load যখন span বরাবর চলে, তখন প্রতিটা
 *     অবস্থানে critical force আলাদা — এটা bridge engineering-এর
 *     নিজস্ব একটা বড় calculation domain, static point/uniform load
 *     এর মতো সরাসরি প্রয়োগযোগ্য না)
 *   - Blast Load: pressure-time history নির্ভর, যা standoff distance,
 *     charge weight, এবং reflection/diffraction geometry থেকে হিসাব
 *     করতে হয় (ConWep বা অনুরূপ empirical model) — এটা pure input
 *     সংখ্যা হিসেবে দেওয়ার মতো সরল না, এবং ভুল হলে বিপজ্জনক হতে পারে
 * এই তিনটার জন্য এখন কোনো সংখ্যা না দিয়ে explicit "not yet supported"
 * থাকাই honest এবং নিরাপদ, ভুল/অসম্পূর্ণ ফলাফল দেওয়ার চেয়ে।
 *
 * বাকি সব লোড টাইপ (Dead, Live, Wind, Earthquake, Snow, Rain,
 * Temperature, Settlement, Hydrostatic, Soil Pressure, Impact,
 * Dynamic, Construction, Equipment, Custom) পূর্ণাঙ্গ ফাংশনাল —
 * uniform/point/area load হিসেবে প্রয়োগযোগ্য, এবং Wind/Earthquake
 * এর জন্য আলাদা BNBC 2020 ELF calculation module আছে
 * (src/lib/loads/windLoad.ts, src/lib/loads/seismicLoad.ts)।
 */

export type LoadCategory =
  | "dead"
  | "live"
  | "wind"
  | "earthquake"
  | "snow"
  | "rain"
  | "temperature"
  | "settlement"
  | "hydrostatic"
  | "soil-pressure"
  | "impact"
  | "dynamic"
  | "construction"
  | "equipment"
  | "custom"
  // Placeholder categories — নিচে বিস্তারিত কারণ
  | "moving-vehicle"
  | "bridge"
  | "blast";

export const PLACEHOLDER_LOAD_CATEGORIES: ReadonlySet<LoadCategory> = new Set([
  "moving-vehicle",
  "bridge",
  "blast",
]);

/**
 * Load Pattern — একটা নির্দিষ্ট লোড টাইপের একটা named group, ঠিক
 * যেমন ETABS/SAP2000-এ "Load Pattern" কনসেপ্ট। একাধিক Load Case
 * (নিচে) একটা প্যাটার্নের অংশ হতে পারে — যেমন "Live Load" প্যাটার্নে
 * একাধিক ভিন্ন স্প্যানে ভিন্ন Live Load case থাকতে পারে।
 */
export interface LoadPattern {
  patternId: string;
  name: string; // যেমন "Dead Load (DL)", "Live Load (LL)", "Wind X (WX)"
  category: LoadCategory;
  selfWeightMultiplier?: number; // শুধু "dead" ক্যাটাগরির জন্য প্রাসঙ্গিক — সাধারণত 1.0 (structural self-weight যোগ করতে)
  createdAt: string;
  updatedAt: string;
}

export type LoadApplicationType = "point" | "uniform-line" | "uniform-area" | "temperature-change";

interface BaseLoadCase {
  loadCaseId: string;
  patternId: string; // LoadPattern রেফারেন্স করে
  elementId: string; // যে element-এ প্রয়োগ হচ্ছে (Beam/Column/Slab/Wall ইত্যাদি)
  applicationType: LoadApplicationType;
  /**
   * "auto" — useAutoLoadSync (Phase: real-time load sync) দ্বারা
   * স্বয়ংক্রিয়ভাবে তৈরি/আপডেট করা (self-weight, occupancy live load,
   * wind/seismic story-force distribution)। প্রতিবার sync চলার সময়
   * শুধু "auto" ট্যাগের case গুলো replace হয় — ইঞ্জিনিয়ারের নিজের
   * হাতে বসানো "manual" case কখনো auto-sync দ্বারা মুছে/বদলে যায় না।
   * অনুপস্থিত/undefined মানে "manual" (পুরোনো ডেটা, এই ফিল্ড আসার
   * আগে তৈরি — backward compatible ডিফল্ট)।
   */
  source?: "auto" | "manual";
  createdAt: string;
  updatedAt: string;
}

/**
 * Point Load — Beam/Column-এর উপর একটা নির্দিষ্ট বিন্দুতে (বা Footing
 * এর মতো point element-এ) প্রযুক্ত বল। force তিনটা অক্ষেই থাকতে পারে
 * (সাধারণত gravity load শুধু Y-দিকে negative হয়, কিন্তু equipment
 * load-এর মতো ক্ষেত্রে lateral component-ও থাকতে পারে)।
 */
export interface PointLoadCase extends BaseLoadCase {
  applicationType: "point";
  forceX: number; // kN
  forceY: number; // kN (gravity load সাধারণত এখানে negative মান)
  forceZ: number; // kN
  positionRatio: number; // 0 থেকে 1, element-এর start থেকে কত ভগ্নাংশ দূরে (line element-এর জন্য প্রযোজ্য; point element এ 0)
}

/**
 * Uniform Line Load — Beam-এর পুরো length জুড়ে সমানভাবে বিতরিত লোড
 * (সবচেয়ে সাধারণ dead/live load application, যেমন floor slab থেকে
 * beam-এ transfer হওয়া লোড)।
 */
export interface UniformLineLoadCase extends BaseLoadCase {
  applicationType: "uniform-line";
  intensityY: number; // kN/m — সাধারণত gravity load (negative = নিচের দিকে)
  intensityX?: number; // kN/m — lateral component (optional, বেশিরভাগ ক্ষেত্রে অপ্রাসঙ্গিক)
  intensityZ?: number; // kN/m
}

/** Uniform Area Load — Slab/Wall-এর পুরো এলাকা জুড়ে সমানভাবে বিতরিত লোড। */
export interface UniformAreaLoadCase extends BaseLoadCase {
  applicationType: "uniform-area";
  intensity: number; // kN/m² — সাধারণত gravity load, স্ল্যাবের plan area-র উপর প্রযুক্ত
}

/**
 * Temperature Change — সমগ্র element-এ uniform temperature rise/fall,
 * যা thermal strain সৃষ্টি করে (elongation/contraction, restrained
 * হলে internal force)।
 */
export interface TemperatureChangeLoadCase extends BaseLoadCase {
  applicationType: "temperature-change";
  temperatureChange: number; // °C, positive = rise, negative = fall
}

export type LoadCase =
  | PointLoadCase
  | UniformLineLoadCase
  | UniformAreaLoadCase
  | TemperatureChangeLoadCase;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** নতুন Load Pattern তৈরির হেল্পার। */
export function createLoadPattern(params: {
  name: string;
  category: LoadCategory;
  selfWeightMultiplier?: number;
}): LoadPattern {
  const now = new Date().toISOString();
  return {
    patternId: makeId("pattern"),
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Point Load Case তৈরির হেল্পার। */
export function createPointLoad(params: {
  patternId: string;
  elementId: string;
  forceX: number;
  forceY: number;
  forceZ: number;
  positionRatio?: number;
  source?: "auto" | "manual";
}): PointLoadCase {
  const now = new Date().toISOString();
  return {
    loadCaseId: makeId("load"),
    applicationType: "point",
    positionRatio: 0.5,
    source: "manual",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Uniform Line Load Case তৈরির হেল্পার। */
export function createUniformLineLoad(params: {
  patternId: string;
  elementId: string;
  intensityY: number;
  intensityX?: number;
  intensityZ?: number;
  source?: "auto" | "manual";
}): UniformLineLoadCase {
  const now = new Date().toISOString();
  return {
    loadCaseId: makeId("load"),
    applicationType: "uniform-line",
    source: "manual",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Uniform Area Load Case তৈরির হেল্পার। */
export function createUniformAreaLoad(params: {
  patternId: string;
  elementId: string;
  intensity: number;
  source?: "auto" | "manual";
}): UniformAreaLoadCase {
  const now = new Date().toISOString();
  return {
    loadCaseId: makeId("load"),
    applicationType: "uniform-area",
    source: "manual",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/** নতুন Temperature Change Load Case তৈরির হেল্পার। */
export function createTemperatureChangeLoad(params: {
  patternId: string;
  elementId: string;
  temperatureChange: number;
}): TemperatureChangeLoadCase {
  const now = new Date().toISOString();
  return {
    loadCaseId: makeId("load"),
    applicationType: "temperature-change",
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * একটা Uniform Line Load-কে equivalent total force-এ রূপান্তর করে
 * (Beam-এর length জানা থাকলে)। এটা Load Combination বা quick-check
 * এর জন্য কাজে লাগবে — পুরো FE analysis (Phase 4) ছাড়াই একটা মোটামুটি
 * ধারণা পাওয়া যায়।
 */
export function computeTotalForceFromUniformLine(
  load: UniformLineLoadCase,
  elementLengthM: number
): number {
  return load.intensityY * elementLengthM;
}
