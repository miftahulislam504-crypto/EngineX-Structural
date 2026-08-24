/**
 * deriveWindLoad.ts — Hub-এর BNBC settings + এই App-এর নিজস্ব geometry
 * (grids/stories) থেকে WindLoadInput তৈরি করে computeWindLoad() কল করার
 * pure derivation layer।
 * ------------------------------------------------------------------
 * আগে WindLoadPanel.tsx ছিল শুধু একটা ম্যানুয়াল calculator — ইঞ্জিনিয়ার
 * নিজে হাতে Basic Wind Speed/Exposure/Height/Width টাইপ করতেন। Miftahul
 * এর অনুরোধ ("wind ও earthquake এর ইনফরমেশন গুলো Hub থেকে আসবে তাহলেই
 * অটোমেটিক হয়ে যাবে") অনুযায়ী এই ফাইল সেই ম্যানুয়াল ইনপুট গুলো Hub +
 * geometry থেকে auto-derive করে।
 *
 * Unit conversion — গুরুত্বপূর্ণ:
 *   HubBnbcSettingsData.basicWindSpeed একক km/h (hub-module-shapes.ts
 *   এর কমেন্ট দেখুন), কিন্তু WindLoadInput.basicWindSpeed একক m/s
 *   (windLoad.ts)। এই ফাইলেই convert করা হচ্ছে (1 km/h = 1000/3600 m/s)।
 *
 * exposureCategory ম্যাপিং:
 *   Hub-এ কোনো সরাসরি "Exposure Category (A-D)" field নেই — শুধু
 *   windZone ("A"|"B"|"C", BNBC-এর wind zone map অনুযায়ী ভৌগোলিক এলাকা,
 *   ASCE-এর terrain-based Exposure Category থেকে ভিন্ন concept)।
 *   windZone থেকে exposureCategory অনুমান করার কোনো নির্ভরযোগ্য rule
 *   নেই (windZone উপকূল/সমতল অনুযায়ী wind speed নির্ধারণ করে, exposure
 *   category করে না — এই দুইটা independent parameter, একটা থেকে
 *   আরেকটা derive করা BNBC 2020 Chapter 2 তে সংজ্ঞায়িত না)। তাই
 *   এখানে সবচেয়ে প্রচলিত বাংলাদেশি শহুরে/উপশহুরে প্রেক্ষাপট (Exposure
 *   B) কে conservative-না-হয়েও reasonable default হিসেবে ব্যবহার করা
 *   হয়েছে, always "approximate" confidence flag সহ — geotechnical/
 *   site survey না থাকলে ইঞ্জিনিয়ারের এটা যাচাই করা উচিত।
 *
 * buildingWidth — grid coordinates থেকে (Hub-এর buildingWidth optional
 * field-এর ওপর নির্ভর না করে, Miftahul এর পছন্দ অনুযায়ী)।
 *
 * ২০২৬-০৮ পর্যন্ত: X ও Y span-এর মধ্যে ছোটটাকে একটাই "width" ধরে
 * Wind X ও Wind Y উভয় pattern-এ একই magnitude বসানো হতো — এটা
 * non-square (asymmetric plan) building-এ ভুল ছিল, কারণ একটা দিকের
 * windward face আরেক দিকের চেয়ে বাস্তবে বেশি চওড়া/সরু হতে পারে।
 *
 * এখন direction-aware: Wind পরিভাষা distributeStoryForceToColumns.ts
 * এর কনভেনশন অনুসরণ করে (forceX প্রযুক্ত হয় direction "X" এ, forceZ
 * "Y" তে) — মানে বাতাস X-অক্ষ বরাবর বইলে সেটা windward face আঘাত করে
 * যার width আসে Y-span থেকে (আর উল্টোটা Y-direction এর জন্য)। তাই:
 *   Wind X (বাতাস X বরাবর) → buildingWidth = spanY
 *   Wind Y (বাতাস Y বরাবর) → buildingWidth = spanX
 * deriveWindLoadInput() এখন direction parameter নেয় ("X"|"Y") এবং সেই
 * direction অনুযায়ী সঠিক perpendicular span বেছে computeWindLoad() এর
 * জন্য buildingWidth ঠিক করে; deriveWindLoadBothDirections() উভয়
 * direction একসাথে derive করে {x, y} shape এ রিটার্ন করে —
 * autoGenerateWindSeismicPatterns.ts এখন সেই {x, y} গ্রহণ করে।
 */

import type { WindLoadInput, WindLoadResult } from "@/lib/loads/windLoad";
import { computeWindLoad } from "@/lib/loads/windLoad";
import type { HubBnbcSettingsData } from "@/lib/hub/hub-module-shapes";
import type { GeometryCore } from "@/lib/types/geometry";

export type DerivationConfidence = "confirmed" | "approximate" | "insufficient-data";

export interface DerivedWindLoadInput {
  input: WindLoadInput | null;
  confidence: DerivationConfidence;
  warnings: string[];
}

export interface DerivedWindLoadResult extends DerivedWindLoadInput {
  result: WindLoadResult | null;
}

/** X ও Y direction — উভয়ের জন্য আলাদা buildingWidth ব্যবহার করে derive করা result। */
export interface DerivedWindLoadByDirection {
  x: DerivedWindLoadResult;
  y: DerivedWindLoadResult;
}

const KMH_TO_MS = 1000 / 3600;

/** grid coordinates থেকে building এর X/Y span (মিটার) বের করে। */
function computeBuildingFootprint(geometry: GeometryCore): { spanX: number; spanY: number } | null {
  const xCoords = geometry.grids.filter((g) => g.direction === "Y").map((g) => g.coordinate); // Y-direction grid লাইন গুলোর X-অক্ষ বরাবর অবস্থান
  const yCoords = geometry.grids.filter((g) => g.direction === "X").map((g) => g.coordinate); // X-direction grid লাইন গুলোর Y-অক্ষ বরাবর অবস্থান

  if (xCoords.length < 2 || yCoords.length < 2) return null;

  const spanX = Math.max(...xCoords) - Math.min(...xCoords);
  const spanY = Math.max(...yCoords) - Math.min(...yCoords);

  if (spanX <= 0 || spanY <= 0) return null;
  return { spanX, spanY };
}

/** stories থেকে building height (মিটার) ও storey count বের করে। */
function computeBuildingHeight(geometry: GeometryCore): { height: number; numberOfStories: number } | null {
  if (geometry.stories.length === 0) return null;

  const topStory = geometry.stories.reduce((top, s) => (s.elevation > top.elevation ? s : top));
  const height = topStory.elevation + topStory.height;
  const numberOfStories = geometry.stories.filter((s) => !s.isBaseLevel).length || geometry.stories.length;

  if (height <= 0) return null;
  return { height, numberOfStories };
}

/**
 * Hub BNBC settings + geometry থেকে একটা নির্দিষ্ট direction-এর জন্য
 * WindLoadInput derive করে। প্রয়োজনীয় ডেটা (grid span কমপক্ষে ২টা
 * লাইন প্রতি দিকে, কমপক্ষে ১টা story) না থাকলে input: null,
 * confidence: "insufficient-data" — caller তখন pattern তৈরি করবে
 * না, শুধু ব্যবহারকারীকে geometry সম্পূর্ণ করতে বলবে।
 *
 * @param direction - "X" মানে বাতাস X-অক্ষ বরাবর বইছে (windward face
 *   আঘাত পায় Y-span বরাবর, তাই buildingWidth = spanY), "Y" এর জন্য
 *   উল্টো (buildingWidth = spanX)। distributeStoryForceToColumns.ts
 *   এর direction কনভেনশনের সাথে সঙ্গতিপূর্ণ।
 */
export function deriveWindLoadInput(
  hubBnbc: HubBnbcSettingsData,
  geometry: GeometryCore,
  direction: "X" | "Y"
): DerivedWindLoadInput {
  const warnings: string[] = [];

  const footprint = computeBuildingFootprint(geometry);
  const heightInfo = computeBuildingHeight(geometry);

  if (!footprint) {
    return {
      input: null,
      confidence: "insufficient-data",
      warnings: ["Wind load auto-calculate করতে প্রতিটা দিকে (X ও Y) কমপক্ষে ২টা grid line দরকার — Geometry ট্যাবে grid যোগ করুন।"],
    };
  }
  if (!heightInfo) {
    return {
      input: null,
      confidence: "insufficient-data",
      warnings: ["Wind load auto-calculate করতে কমপক্ষে ১টা story দরকার — Geometry ট্যাবে story যোগ করুন।"],
    };
  }

  // direction-aware building width: বাতাস X বরাবর বইলে windward face
  // এর width আসে Y-span থেকে (আর উল্টোটা Y-direction এর জন্য) — উপরের
  // হেডার কমেন্টে ব্যাখ্যা করা হয়েছে। আগে দুই span এর মধ্যে ছোটটা
  // উভয় direction-এ ব্যবহার করা হতো, যা asymmetric plan-এ ভুল ছিল।
  const buildingWidth = direction === "X" ? footprint.spanY : footprint.spanX;
  warnings.push(
    `Wind ${direction} building width (${buildingWidth.toFixed(1)}m) grid span থেকে অনুমান করা হয়েছে (দুই দিকের span: ${footprint.spanX.toFixed(1)}m × ${footprint.spanY.toFixed(1)}m)। ভবনের প্রকৃত orientation grid থেকে নিশ্চিতভাবে জানা যায় না, তাই grid-axis-aligned rectangular footprint ধরে নেওয়া হয়েছে।`
  );

  // exposureCategory — উপরের হেডার কমেন্টে ব্যাখ্যা করা হয়েছে কেন এটা
  // সবসময় approximate।
  const exposureCategory: WindLoadInput["exposureCategory"] = "B";
  warnings.push(
    "Exposure Category 'B' (শহুরে/উপশহুরে) ডিফল্ট ধরা হয়েছে — BNBC এ windZone থেকে সরাসরি exposure category নির্ণয়ের কোনো rule নেই। প্রকৃত সাইট অনুযায়ী ভিন্ন হলে ম্যানুয়ালি বদলান।"
  );

  const input: WindLoadInput = {
    basicWindSpeed: hubBnbc.basicWindSpeed * KMH_TO_MS,
    exposureCategory,
    buildingHeight: heightInfo.height,
    buildingWidth,
    importanceFactor: hubBnbc.importanceFactor,
    structureType: heightInfo.height / buildingWidth > 4 ? "flexible" : "rigid", // BNBC 2020 এর সাধারণ rigid/flexible screening criterion (h/w > 4 হলে dynamic sensitivity বিবেচনায় নেওয়া উচিত)
    numberOfStories: heightInfo.numberOfStories,
  };

  return { input, confidence: "approximate", warnings };
}

/** derive + compute একসাথে (একটা direction) — caller সরাসরি ফলাফল ব্যবহার করতে পারবে। */
export function deriveWindLoad(
  hubBnbc: HubBnbcSettingsData,
  geometry: GeometryCore,
  direction: "X" | "Y"
): DerivedWindLoadResult {
  const derived = deriveWindLoadInput(hubBnbc, geometry, direction);
  if (!derived.input) {
    return { ...derived, result: null };
  }
  return { ...derived, result: computeWindLoad(derived.input) };
}

/** উভয় direction (X ও Y) একসাথে derive করে — useAutoLoadSync.ts এর মূল entry point। */
export function deriveWindLoadBothDirections(
  hubBnbc: HubBnbcSettingsData,
  geometry: GeometryCore
): DerivedWindLoadByDirection {
  return {
    x: deriveWindLoad(hubBnbc, geometry, "X"),
    y: deriveWindLoad(hubBnbc, geometry, "Y"),
  };
}
