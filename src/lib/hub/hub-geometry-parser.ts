/**
 * Architectural Geometry Parser (Phase 2)
 * ------------------------------------------------------------------
 * প্ল্যানের Phase 2 আইটেম: "Parse referenceGeometryUrl (IFC/JSON pointer
 * from EngineXDraw) into StructuralElement[]; Wall→Wall/ShearWall, Slab
 * boundary→AreaElement mapping rules।"
 *
 * ⚠️ সংশোধনী নোট (hub-module-shapes.ts এর file comment-এ বিস্তারিত):
 * `referenceGeometryUrl` নামটা আসলে পুরনো, dead `types/hub.ts` schema
 * থেকে এসেছিল (hubSync/incoming path, Phase 0-এ deprecated)।
 *
 * ⚠️ দ্বিতীয় সংশোধনী নোট (Hub-Structural integration bugfix, Phase 7-এর
 * আগে): এই ফাইলের একটা আগের সংস্করণে fetch mechanism হিসেবে
 * getModuleDataFile() (Phase 0, module-data.firestore.ts) ব্যবহার করা
 * হতো — Draw-এর uploadModuleData() যা Firebase Storage-এ আপলোড করতো তার
 * Firestore metadata pointer (fileUrl) থেকে JSON fetch করা। কিন্তু
 * Firebase free plan-এ Storage bucket তৈরি করা যায় না, তাই এই path
 * (দুই দিকেই — Draw-এর আপলোড আর এই App-এর ডাউনলোড) কখনোই বাস্তবে সফল
 * হতো না। বর্তমান, verified mechanism হলো Phase 0-এর pure-Firestore
 * getModuleData()/subscribeToModuleData() (hub-sdk-client.ts) —
 * projects/{id}/moduleData/architectural document সরাসরি পড়া, কোনো
 * Storage/fetch() ছাড়াই। নিচের কোড এই আসল, verified মেকানিজম ব্যবহার
 * করে (fetchLatestArchitecturalExport()/subscribeToLatestArchitecturalExport()
 * এর file comment দ্রষ্টব্য)।
 *
 * ═══════════════════════════════════════════════════════════════════
 * কোঅর্ডিনেট সিস্টেম রূপান্তর — গুরুত্বপূর্ণ, ভুল হলে পুরো মডেল ভুল বসবে
 * ═══════════════════════════════════════════════════════════════════
 * Draw-এর object-model (packages/object-model/src/geometry.ts, verified):
 *   - প্রতিটা floor-এর geometry Point2D {x, y} — floor-local, plan-view
 *     XY প্লেনে, মিটার এককে। তৃতীয় মাত্রা floor-এর নিজস্ব elevation/
 *     height (ProjectLevel) থেকে আসে, প্রতিটা element-এর geometry-তে না।
 *
 * এই App-এর element.ts (verified, ফাইলের নিজস্ব header comment):
 *   - Point3D {x, y, z} — plan geometry XZ প্লেনে থাকে, Y = elevation
 *     (দেখুন computePolygonPlanArea()-এর কমেন্ট: "XZ প্লেনে প্রজেক্ট
 *     করে, Y কে উচ্চতা হিসেবে ধরে")।
 *
 * রূপান্তর নিয়ম (এই ফাইলে সর্বত্র প্রয়োগ করা হয়েছে):
 *   Structural.x = Draw.x
 *   Structural.z = Draw.y   (Draw-এর plan-Y, এই App-এর plan-Z হয়)
 *   Structural.y = elevation  (floor-ভিত্তিক, wall/slab/column/beam-এর
 *                              নিজস্ব geometry-তে যা প্রযোজ্য: level base
 *                              elevation + element-নির্দিষ্ট offset)
 * এই mapping-টা একটা সচেতন কনভেনশন পছন্দ (X অক্ষ অপরিবর্তিত রাখা, Y↔Z
 * swap করা) — Draw-এর plan-view "north" আর এই App-এর plan-view "north"
 * একই দিকে থাকবে ধরে নেওয়া হয়েছে, কারণ দুটোই একই building-এর geometry।
 * যদি ভবিষ্যতে rotation/orientation metadata Hub-এ যোগ হয়, তখন এই
 * simple axis-swap-এর জায়গায় প্রকৃত rotation matrix বসাতে হবে।
 *
 * ═══════════════════════════════════════════════════════════════════
 * Wall → Wall/ShearWall সিদ্ধান্ত — এখন Draw-এর explicit flag থেকে আসে
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️ সংশোধনী নোট (Miftahul, 2026-08-25 — নিচের ইতিহাস প্রসঙ্গের জন্য
 * রাখা হলো, বর্তমান আচরণ না): আগে Draw-এ কোনো dedicated shear-wall flag
 * ছিল না (Wall.type শুধু architectural ব্যবহার বোঝাতো — EXTERIOR/
 * INTERIOR/PARTITION, lateral role না), আর thickness দিয়ে অনুমান করাও
 * অনির্ভরযোগ্য প্রমাণিত হয়েছিল (RC shear wall 150-400mm বনাম বাংলাদেশের
 * প্রচলিত brick/block wall 125-250mm — যথেষ্ট overlap করে)। তাই এই parser
 * তখন সবসময় category: "wall" বসাতো, thickness ভারী হলে শুধু review-
 * recommended warning যোগ করতো, আর প্রকৃত classification ছিল
 * useArchitecturalImport.ts-এর import-review UI তে ইঞ্জিনিয়ারের ম্যানুয়াল
 * চেকপয়েন্ট (ডিফল্ট un-checked, checkpoint দিলে "shear-wall" override)।
 *
 * এখন Draw-এ Wall.isShearWall (explicit boolean, ইঞ্জিনিয়ার নিজে সেট
 * করেন — geometry.ts এর ফিল্ড কমেন্ট দেখুন) যোগ হয়েছে, আর hub-write.ts
 * সেই অনুযায়ী ref.type "wall" বা "shear-wall" পাঠায়। তাই classification
 * এখন Hub-এ আসার আগেই, উৎসেই ঠিক — এই App-এ আর কোনো thickness-ভিত্তিক
 * অনুমান বা review-time checkbox override নেই। mapWall() (নিচে) সরাসরি
 * ref.type read করে category বসায়, দুই category-র geometry mapping
 * হুবহু একই (ShearWallElement জ্যামিতিকভাবে WallElement থেকে ভিন্ন না)।
 * useArchitecturalImport.ts-এও এখন wall/shear-wall উভয়ই বাকি সব
 * category-র মতোই সবসময় import হয় — কোনো wall silently বাদ পড়ে না,
 * কারণ "সাধারণ wall structural analysis model-এ থাকা উচিত না" ধারণাটাই
 * পাল্টেছে: সাধারণ wall (category "wall") এখন self-weight/dead-load
 * contributor হিসেবে সবসময় মডেল হয় (Beam/Column/Slab-এর মতোই), শুধু
 * lateral design/capacity check (Design Engine, weightOptimization.ts)
 * "shear-wall"/"core-wall" ছাড়া প্রযোজ্য হয় না — এই পার্থক্যটা category
 * ট্যাগেই ধরা আছে, import-time gate দিয়ে না।
 *
 * ═══════════════════════════════════════════════════════════════════
 * Stair mapping — mapStair() দ্রষ্টব্য
 * ═══════════════════════════════════════════════════════════════════
 * Draw-এর Stair (packages/object-model/src/geometry.ts, verified) একটা
 * ordered flights[] array পাঠায় (bottom-to-top, প্রতিটা straight run)।
 * এই App-এ কোনো dedicated multi-flight "Stair" element type নেই —
 * প্রতিটা flight structural analysis-এর জন্য একটা inclined waist-slab
 * (element.ts এর StairElement, AreaElement-ই পুনর্ব্যবহার করে) হিসেবে
 * মডেল করা হয়, তাই একটা Draw Stair থেকে ১+ StairElement আসতে পারে।
 * waist-slab thickness Draw পাঠায় না (architectural drawing-এ অপ্রাসঙ্গিক)
 * — DEFAULT_STAIR_WAIST_THICKNESS_M ধরে নেওয়া হয়, সবসময় review-recommended
 * issue সহ (thickness ইঞ্জিনিয়ারকে নিশ্চিত করতে হবে)।
 *
 * ═══════════════════════════════════════════════════════════════════
 * Parapet mapping — mapParapet() দ্রষ্টব্য
 * ═══════════════════════════════════════════════════════════════════
 * Draw-এর Parapet (packages/object-model/src/geometry.ts, Audit Gap
 * Closure Phase 5 item 16) আগে কখনো Hub-এ export হতো না (hub-write.ts
 * এ parapetCrud ছিল কিন্তু floorElements() পড়তো না) — এখন সেই gap
 * বন্ধ হয়েছে, এই ফাইলে সেই অনুযায়ী consume করা হচ্ছে।
 *
 * Wall-এর geometric mapping-ই পুনর্ব্যবহার করা হয়েছে (linear run →
 * vertical rectangular AreaElement plane) কারণ জ্যামিতিকভাবে parapet
 * একটা ছোট wall-ই। কিন্তু দুইটা গুরুত্বপূর্ণ পার্থক্য:
 *   (১) elevation — parapet floor level-এ বসে না, ছাদের কিনারায়
 *       (Draw-এর নিজস্ব `elevation` ফিল্ড থেকে আসে, Wall-এর মতো শুধু
 *       floor base elevation ধরে নেওয়া যায় না)।
 *   (২) category সবসময় "parapet" — কখনো "shear-wall" হয় না, parapet
 *       lateral system-এর অংশ বিবেচিত হয় না (mapWall()-এর মতো ref.type
 *       থেকে category নির্ণয়ের প্রয়োজন এখানে নেই, Draw কখনো parapet-কে
 *       shear-wall হিসেবে export করে না)।
 * v1 স্কোপ: শুধু modeling + self-weight/dead-load (deriveAreaSelfWeightLoads.ts
 * দেখুন) — কোনো design check parapet-এর নিজস্ব নয়, শুধু building-এর
 * overall dead load-এ contribute করে।
 */

import type { StructuralElement, Point3D, WallElement, ShearWallElement, SlabElement, StairElement, LandingElement, ParapetElement, FootingElement } from "@/lib/types/element";
import type { StructuralGrid, StructuralStory } from "@/lib/types/geometry";
import type { BuildingElementRef } from "./contract.types";
import type {
  DrawArchitecturalExport,
  DrawPoint2D,
  DrawWallGeometry,
  DrawSlabGeometry,
  DrawColumnGeometry,
  DrawBeamGeometry,
  DrawStairGeometry,
  DrawStairLandingGeometry,
  DrawParapetGeometry,
  DrawFootingGeometry,
} from "./hub-module-shapes";
import { getModuleData, subscribeToModuleData } from "./hub-sdk-client";
import { mapArchitecturalGeometry } from "./hub-module-mapper";

// ─── Fetch ────────────────────────────────────────────────────────────

export interface FetchArchitecturalExportResult {
  data: DrawArchitecturalExport;
  moduleVersion: number;
  fetchedAt: string;
}

/**
 * Draw-এর সর্বশেষ প্রকাশিত architectural model fetch করে।
 *
 * ⚠️ সংশোধনী নোট: আগে এই ফাংশন getModuleDataFile() (Phase 0,
 * module-data.firestore.ts) দিয়ে Firestore metadata document পড়ে
 * fileUrl বের করে সেই URL থেকে Firebase Storage-এ রাখা JSON file fetch
 * করতো — কিন্তু Firebase free plan-এ Storage bucket তৈরি করা যায় না,
 * তাই এই path কখনোই সফল হতো না (Draw-এর দিকে uploadModuleData()-ও একই
 * কারণে কখনো কাজ করেনি, দেখুন Draw-এর hub-write.ts এর
 * publishArchitecturalToHub() এর file comment)।
 *
 * এখন Draw pure-Firestore moduleData/architectural document-এ schedule
 * (floorAreas/roomSchedule/...) ও পূর্ণ geometry (levels/grids/
 * elements/...) দুটোই একসাথে লেখে (একই data object-এর top-level key
 * হিসেবে — merge:true নেস্টেড object-এর ভেতরের key merge করে না বলে
 * দুটো আলাদা document-এ পাঠানো যায়নি)। এই App শুধু geometry অংশ নিয়ে
 * কাজ করে, schedule field (floorAreas ইত্যাদি) ignore করে — সেগুলো
 * Estimate-এর জন্য, একই document-এ থাকলেও এই App-এর জন্য নিরীহ।
 *
 * getModuleData() (hub-sdk-client.ts, Phase 0) generic upstream-module
 * reader — এটাই এখন এই ফাংশনের একমাত্র নির্ভরতা, কোনো Storage/fetch()
 * লাগে না। কোনো model প্রকাশিত না থাকলে (Draw এখনো কিছু publish করেনি)
 * null — এটা error না, শুধু "এখনো কিছু নেই" অবস্থা।
 */
export async function fetchLatestArchitecturalExport(
  projectId: string,
): Promise<FetchArchitecturalExportResult | null> {
  const record = await getModuleData(projectId, "architectural");
  if (!record) return null;

  // record.data তে schedule ও geometry দুটোই একসাথে থাকে (Draw-এর
  // combined write) — এই App শুধু geometry key গুলো (DrawArchitecturalExport
  // shape) তুলে নেয়, floorAreas/roomSchedule/... ignore করে।
  const data = record.data as unknown as DrawArchitecturalExport;

  return {
    data,
    moduleVersion: record.version,
    fetchedAt: record.updatedAt,
  };
}

/**
 * fetchLatestArchitecturalExport()-এর real-time সংস্করণ — Draw নতুন
 * করে publish করলে (bumpModuleVersion সহ) স্বয়ংক্রিয়ভাবে callback
 * ট্রিগার করে (Phase 7 — Real-time Listener + Auto Reanalysis Loop এর
 * ভিত্তি, ঠিক useHubSiteInfo/useHubBnbcSettings/useHubBuildingInfo এর
 * একই auto-sync নীতি, useHubModuleSubscriptions.ts দ্রষ্টব্য)। Caller-
 * কে unsubscribe cleanup-এ কল করতে হবে।
 */
export function subscribeToLatestArchitecturalExport(
  projectId: string,
  onUpdate: (result: FetchArchitecturalExportResult | null) => void,
) {
  return subscribeToModuleData(projectId, "architectural", (record) => {
    if (!record) {
      onUpdate(null);
      return;
    }
    const data = record.data as unknown as DrawArchitecturalExport;
    onUpdate({ data, moduleVersion: record.version, fetchedAt: record.updatedAt });
  });
}

// ─── Coordinate conversion ──────────────────────────────────────────────

/** ফাইলের হেডার কমেন্টে বর্ণিত axis mapping: Draw.x→x, Draw.y→z, elevation→y। */
export function toPoint3D(p: DrawPoint2D, elevationM: number): Point3D {
  return { x: p.x, y: elevationM, z: p.y };
}

// ─── Issue tracking (defensive skip + warn, deriveSiteClass-এর একই নীতি) ──

export type ParsedElementIssueSeverity = "skipped" | "review-recommended";

export interface ParsedElementIssue {
  severity: ParsedElementIssueSeverity;
  elementRefId: string;
  elementType: string;
  reason: string;
}

export interface ParseGeometryResult {
  elements: StructuralElement[];
  grids: StructuralGrid[];
  stories: StructuralStory[];
  issues: ParsedElementIssue[];
}

/** materialId/sectionId এই App-এর নিজস্ব library-তে থাকে, Draw পাঠায় না (Draw শুধু materialLabel/libraryItemId পাঠায়, যা Draw-এর নিজস্ব material catalog রেফারেন্স করে, এই App-এর MaterialLibrary/SectionLibrary না)। তাই স্পষ্টভাবে "unresolved" মার্ক করা প্লেসহোল্ডার বসানো হচ্ছে — বাস্তব-দেখতে কোনো id বানানো হচ্ছে না যা ভুল করে সত্যিকারের library entry মনে হতে পারে। UI import flow (এই ফাইলের বাইরে) এই elements review করিয়ে ইঞ্জিনিয়ারকে প্রকৃত material/section বেছে দিতে বলবে। */
const UNRESOLVED_MATERIAL_ID = "__unresolved_material__";
const UNRESOLVED_SECTION_ID = "__unresolved_section__";

/**
 * Stair waist-slab thickness — Draw কখনো এই মান পাঠায় না (architectural
 * drawing-এ দরকার হয় না, শুধু structural design-এ)। BNBC 2020-context
 * সাধারণ RC waist slab span/20 rough rule অনুযায়ী প্রচলিত রেঞ্জ
 * 125-200mm — Slab-এর ডিফল্টের (125mm) চেয়ে সামান্য বেশি ধরা হলো
 * কারণ stair slab-এ সাধারণত বাড়তি সেলফ-ওয়েট (step) থাকে। প্রতিটা
 * mapped StairElement-এ সবসময় review-recommended issue যোগ হয় (thickness
 * ধরে নেওয়া, Draw থেকে verified না) — ইঞ্জিনিয়ারকে import review-তে
 * এই থিকনেস (ও দরকার হলে material) নিশ্চিত/পরিবর্তন করতে হবে।
 */
const DEFAULT_STAIR_WAIST_THICKNESS_M = 0.15;

function warnSkipped(issues: ParsedElementIssue[], ref: BuildingElementRef, reason: string): void {
  issues.push({ severity: "skipped", elementRefId: ref.id, elementType: ref.type, reason });
  // eslint-disable-next-line no-console
  console.warn(`[hub-geometry-parser] "${ref.type}" (${ref.id}) স্কিপ করা হলো — ${reason}`);
}

function warnReview(issues: ParsedElementIssue[], ref: BuildingElementRef, reason: string): void {
  issues.push({ severity: "review-recommended", elementRefId: ref.id, elementType: ref.type, reason });
}

// ─── Per-category mapping ────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isDrawPoint2D(v: unknown): v is DrawPoint2D {
  return typeof v === "object" && v !== null && isFiniteNumber((v as DrawPoint2D).x) && isFiniteNumber((v as DrawPoint2D).y);
}

/**
 * Wall/Shear-Wall → WallElement | ShearWallElement।
 *
 * ⚠️ সংশোধনী নোট (Miftahul, 2026-08-25 — পুরনো "কখনো automatic
 * classification না" নীতি প্রতিস্থাপিত): আগে এই ফাংশন সবসময়
 * category: "wall" বসাতো এবং thickness ভারী হলে শুধু review-recommended
 * issue যোগ করতো — classification ছিল useArchitecturalImport.ts এর
 * import-review UI তে ইঞ্জিনিয়ারের ম্যানুয়াল চেকপয়েন্ট (wall ⇄ shear-wall
 * override)। এখন classification Draw-এ উৎসেই ঠিক হয়ে যায়: Draw এর
 * Wall.isShearWall (ইঞ্জিনিয়ার নিজে সেট করেন, কখনো thickness থেকে
 * অনুমান না — geometry.ts এর ফিল্ড কমেন্ট দেখুন) অনুযায়ী hub-write.ts
 * ref.type "wall" বা "shear-wall" পাঠায়। এই ফাংশন সরাসরি সেই type read
 * করে category বসায় — geometry mapping (vertices/thickness) দুই
 * category-র জন্যই হুবহু একই (ShearWallElement জ্যামিতিকভাবে WallElement
 * থেকে আলাদা না, element.ts এর ShearWallElement কমেন্ট দেখুন), শুধু
 * category ট্যাগ ভিন্ন। thickness-ভিত্তিক review-recommended warning আর
 * নেই — classification এখন থেকে Draw-এর explicit flag, thickness অনুমান
 * না, তাই সেই সতর্কতা আর প্রাসঙ্গিক না।
 */
function mapWall(
  ref: BuildingElementRef,
  baseElevationM: number,
  issues: ParsedElementIssue[],
  nowIso: string,
): WallElement | ShearWallElement | null {
  const g = ref.geometry as DrawWallGeometry | undefined;
  if (!g || !isDrawPoint2D(g.start) || !isDrawPoint2D(g.end)) {
    warnSkipped(issues, ref, "start/end পয়েন্ট অনুপস্থিত বা ভুল shape");
    return null;
  }
  if (!isFiniteNumber(g.thickness) || g.thickness <= 0) {
    warnSkipped(issues, ref, "thickness অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }
  if (!isFiniteNumber(g.height) || g.height <= 0) {
    warnSkipped(issues, ref, "height অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }

  // vertices: Wall একটা vertical rectangular plane — start/end (base
  // elevation-এ) থেকে height যোগ করে উপরের দুই কোণা বের করা হচ্ছে,
  // counter-clockwise ক্রমে (element.ts এর AreaElement.vertices কমেন্ট
  // অনুযায়ী)। thickness এখানে vertices-এ ধরা হয়নি (Wall-কে একটা
  // zero-thickness centerline plane হিসেবে মডেল করা হয়েছে, thickness
  // আলাদা property হিসেবে থাকে) — এটা AreaElement-এর নিজস্ব কনভেনশন,
  // Slab-ও একইভাবে thickness কে vertices-এর বাইরে আলাদা রাখে।
  const startBase = toPoint3D(g.start, baseElevationM);
  const endBase = toPoint3D(g.end, baseElevationM);
  const startTop = toPoint3D(g.start, baseElevationM + g.height);
  const endTop = toPoint3D(g.end, baseElevationM + g.height);

  const category: "wall" | "shear-wall" = ref.type === "shear-wall" ? "shear-wall" : "wall";

  return {
    elementId: ref.id,
    category,
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    storyId: ref.levelId || undefined,
    vertices: [startBase, endBase, endTop, startTop],
    thickness: g.thickness * 1000, // mm — element.ts এর AreaElement.thickness একক
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Parapet → ParapetElement। mapWall()-এর জ্যামিতিক অংশ পুনর্ব্যবহার করে
 * (linear run → vertical rectangular plane), কিন্তু base elevation
 * হিসেবে floor base না, floor base + Draw-এর নিজস্ব parapet elevation
 * ব্যবহার করে (ফাইল হেডারের Parapet mapping নোট দেখুন) — এবং কোনো
 * shear-wall-review threshold check নেই।
 */
function mapParapet(
  ref: BuildingElementRef,
  baseElevationM: number,
  issues: ParsedElementIssue[],
  nowIso: string,
): ParapetElement | null {
  const g = ref.geometry as DrawParapetGeometry | undefined;
  if (!g || !isDrawPoint2D(g.start) || !isDrawPoint2D(g.end)) {
    warnSkipped(issues, ref, "start/end পয়েন্ট অনুপস্থিত বা ভুল shape");
    return null;
  }
  if (!isFiniteNumber(g.thickness) || g.thickness <= 0) {
    warnSkipped(issues, ref, "thickness অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }
  if (!isFiniteNumber(g.height) || g.height <= 0) {
    warnSkipped(issues, ref, "height অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }
  // elevation না থাকলে/অবৈধ হলে 0 ধরে নেওয়া হয় (floor level-এ, roof-এর
  // নিজস্ব elevation-এর সমান — Parapet-এর object-model কমেন্ট অনুযায়ী
  // এটাই সাধারণ কনভেনশন) — skip না করে review-recommended issue যোগ
  // করা হয়, কারণ elevation ভুল হলে parapet ভুল উচ্চতায় বসবে কিন্তু
  // dead-load contribution (যা v1-এর মূল উদ্দেশ্য) তবুও অর্থপূর্ণ থাকে।
  let elevationM = g.elevation;
  if (!isFiniteNumber(elevationM)) {
    warnReview(issues, ref, "elevation অনুপস্থিত বা অবৈধ — 0 (floor level) ধরে নেওয়া হলো, ইঞ্জিনিয়ার নিশ্চিত করুন");
    elevationM = 0;
  }

  const parapetBaseM = baseElevationM + elevationM;
  const startBase = toPoint3D(g.start, parapetBaseM);
  const endBase = toPoint3D(g.end, parapetBaseM);
  const startTop = toPoint3D(g.start, parapetBaseM + g.height);
  const endTop = toPoint3D(g.end, parapetBaseM + g.height);

  return {
    elementId: ref.id,
    category: "parapet",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    storyId: ref.levelId || undefined,
    vertices: [startBase, endBase, endTop, startTop],
    thickness: g.thickness * 1000, // mm — element.ts এর AreaElement.thickness একক
    elevation: elevationM,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Slab → SlabElement। "Slab boundary→AreaElement" নিয়মের বাস্তবায়ন —
 * Draw-এর boundary (Point2D[]) সরাসরি AreaElement.vertices (Point3D[])
 * এ map হয়, elevation প্রতিটা vertex-এ সমানভাবে বসিয়ে (Slab সমতল ধরে
 * নেওয়া হয়, যা প্রায় সব বাস্তব ক্ষেত্রে সত্য — sloped slab এই v1
 * মডেলে সমর্থিত না, ঠিক যেমন element.ts এর MatFoundationElement-ও
 * একই সরলীকরণ করে)।
 */
function mapSlab(ref: BuildingElementRef, baseElevationM: number, issues: ParsedElementIssue[], nowIso: string): SlabElement | null {
  const g = ref.geometry as DrawSlabGeometry | undefined;
  if (!g || !Array.isArray(g.boundary) || g.boundary.length < 3) {
    warnSkipped(issues, ref, "boundary অনুপস্থিত বা polygon বানাতে ন্যূনতম ৩টা vertex নেই");
    return null;
  }
  if (!g.boundary.every(isDrawPoint2D)) {
    warnSkipped(issues, ref, "boundary-এর কোনো vertex ভুল shape (x/y সংখ্যা হতে হবে)");
    return null;
  }
  if (!isFiniteNumber(g.thickness) || g.thickness <= 0) {
    warnSkipped(issues, ref, "thickness অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }

  const elevationM = baseElevationM + (isFiniteNumber(g.elevation) ? g.elevation : 0);
  const vertices = g.boundary.map((p) => toPoint3D(p, elevationM));

  return {
    elementId: ref.id,
    category: "slab",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    storyId: ref.levelId || undefined,
    vertices,
    thickness: g.thickness * 1000, // mm
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Stair Landing → LandingElement। mapSlab()-এর ঠিক একই boundary→vertices
 * প্যাটার্ন, শুধু thickness Draw থেকে আসে না (mapStair()-এর waist-slab
 * এর মতোই — landing geometry architectural drawing-এর প্রয়োজনে বানানো,
 * structural thickness ধারণা Draw-এর নেই) — তাই DEFAULT_STAIR_WAIST_
 * THICKNESS_M ডিফল্ট, review-recommended issue সহ (Stair-এর নিজস্ব
 * waist thickness default-এর ঠিক একই কনভেনশন — landing সাধারণত waist
 * slab-এর সমান পুরুত্বে ঢালা হয়, তাই একই default যুক্তিসঙ্গত)।
 *
 * elevation mapParapet()-এর প্যাটার্নে (own elevation + baseElevationM,
 * skip না করে review issue-সহ 0 fallback) — DrawStairLandingGeometry
 * এর elevation stair-এর নিজস্ব floor level থেকে মাপা (hub-write.ts এর
 * landing export কমেন্ট দেখুন), ঠিক StairFlight-এর elevation-এর মতোই।
 */
function mapStairLanding(
  ref: BuildingElementRef,
  baseElevationM: number,
  issues: ParsedElementIssue[],
  nowIso: string,
): LandingElement | null {
  const g = ref.geometry as DrawStairLandingGeometry | undefined;
  if (!g || !Array.isArray(g.boundary) || g.boundary.length < 3) {
    warnSkipped(issues, ref, "boundary অনুপস্থিত বা polygon বানাতে ন্যূনতম ৩টা vertex নেই");
    return null;
  }
  if (!g.boundary.every(isDrawPoint2D)) {
    warnSkipped(issues, ref, "boundary-এর কোনো vertex ভুল shape (x/y সংখ্যা হতে হবে)");
    return null;
  }

  let elevationM = g.elevation;
  if (!isFiniteNumber(elevationM)) {
    warnReview(issues, ref, "elevation অনুপস্থিত বা অবৈধ — 0 (floor level) ধরে নেওয়া হলো, ইঞ্জিনিয়ার নিশ্চিত করুন");
    elevationM = 0;
  }

  warnReview(
    issues,
    ref,
    `thickness Draw থেকে আসে না — ${(DEFAULT_STAIR_WAIST_THICKNESS_M * 1000).toFixed(0)}mm ডিফল্ট (waist slab-এর সমান) ধরা হয়েছে, import review-তে প্রয়োজন অনুযায়ী পরিবর্তন করুন।`,
  );

  const landingBaseM = baseElevationM + elevationM;
  const vertices = g.boundary.map((p) => toPoint3D(p, landingBaseM));

  return {
    elementId: ref.id,
    category: "stair-landing",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    storyId: ref.levelId || undefined,
    vertices,
    thickness: DEFAULT_STAIR_WAIST_THICKNESS_M * 1000, // mm
    elevation: elevationM,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Stair → StairElement[]। বাকি সব mapXxx() একটা BuildingElementRef থেকে
 * একটা element রিটার্ন করে, কিন্তু Draw-এর একটা Stair-এ ১+ flight থাকতে
 * পারে (L/U-shaped multi-flight) — তাই এই ফাংশনটাই একমাত্র ব্যতিক্রম,
 * array রিটার্ন করে (নিচে parseArchitecturalExport()-এ push(...mapped)
 * দিয়ে flatten করা হয়)।
 *
 * প্রতিটা flight একটা independent inclined AreaElement (waist slab):
 *   - rise = numberOfSteps * riserHeight (মিটার), flight-টা bottom
 *     elevation থেকে সেই rise যোগ করে top-এ পৌঁছায়
 *   - flight-এর bottom elevation = storyBase + আগের সব flight-এর মোট
 *     rise (bottom-to-top ক্রম ধরে নেওয়া হয়, Draw-এর StairFlight
 *     কমেন্ট অনুযায়ী — landing-এর নিজস্ব কোনো rise নেই বলে এই sequential
 *     accumulation-ই landing-সহ সঠিক ফলাফল দেয়)
 *   - width perpendicular offset করে ৪-vertex plane বানানো হয় (start
 *     bottom, end bottom+width-offset স্তরে না — বরং centerline থেকে
 *     width/2 দুই পাশে), ঠিক Wall-এর centerline-plane কনভেনশনের মতোই
 *     thickness আলাদা property হিসেবে রাখা (vertices zero-thickness
 *     ধরে)।
 *   - প্রতিটা flight-এর elementId মূল Stair id + flight index (একাধিক
 *     StructuralElement একই ref.id হলে re-import/duplicate-check ভুল
 *     আচরণ করবে, তাই ইউনিক করা আবশ্যক)
 *
 * সীমাবদ্ধতা: কোনো flight invalid হয়ে skip হলে (নিচের validation) তার
 * rise runningRiseM-এ যোগ হয় না, তাই পরের flight ভুল base elevation-এ
 * বসতে পারে। এটা গ্রহণযোগ্য কারণ invalid flight থাকা মানেই পুরো Stair
 * geometry-তে সমস্যা আছে — ইঞ্জিনিয়ারকে review-তে দেখেই EngineXDraw-এ
 * ফিরে সংশোধন করতে হবে, শুধু elevation ঠিক করে আমদানি চালিয়ে যাওয়া
 * কোনো valid ব্যবহারযোগ্য কেস না।
 *
 * riserHeightM (২০২৬-০৮, gap-closing pass) — flight.riserHeight
 * (DrawStairFlight, উপরেই elevation হিসাবের জন্য validate করা হয়) এখন
 * সরাসরি StairElement.riserHeightM-এ বসে, আগে যা discard হয়ে যেত।
 * StairDesignPanel.tsx-এ ইঞ্জিনিয়ার প্রয়োজনে override করতে পারেন
 * (saveElement() দিয়ে) — এটা শুধু import-time default, permanent lock
 * না।
 */
function mapStair(
  ref: BuildingElementRef,
  baseElevationM: number,
  issues: ParsedElementIssue[],
  nowIso: string,
): StairElement[] {
  const g = ref.geometry as DrawStairGeometry | undefined;
  if (!g || !isFiniteNumber(g.width) || g.width <= 0) {
    warnSkipped(issues, ref, "width অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return [];
  }
  if (!Array.isArray(g.flights) || g.flights.length === 0) {
    warnSkipped(issues, ref, "flights অনুপস্থিত বা খালি — কমপক্ষে ১টা flight দরকার");
    return [];
  }

  const result: StairElement[] = [];
  let runningRiseM = 0;

  for (let i = 0; i < g.flights.length; i++) {
    const flight = g.flights[i];
    const flightLabel = g.flights.length > 1 ? `${ref.id}-F${i + 1}` : ref.id;

    if (!isDrawPoint2D(flight.start) || !isDrawPoint2D(flight.end)) {
      warnSkipped(issues, { ...ref, id: flightLabel }, "flight-এর start/end পয়েন্ট অনুপস্থিত বা ভুল shape");
      continue;
    }
    if (!isFiniteNumber(flight.numberOfSteps) || flight.numberOfSteps <= 0) {
      warnSkipped(issues, { ...ref, id: flightLabel }, "flight-এর numberOfSteps অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
      continue;
    }
    if (!isFiniteNumber(flight.riserHeight) || flight.riserHeight <= 0) {
      warnSkipped(issues, { ...ref, id: flightLabel }, "flight-এর riserHeight অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
      continue;
    }

    const flightBaseM = baseElevationM + runningRiseM;
    const flightRiseM = flight.numberOfSteps * flight.riserHeight;
    const flightTopM = flightBaseM + flightRiseM;
    runningRiseM += flightRiseM;

    // centerline-এর perpendicular unit vector (Draw.x/y প্লেনে) —
    // width কে দুই পাশে অর্ধেক করে centerline থেকে অফসেট করতে ব্যবহার
    // হয়, ঠিক যেমন একটা রাস্তার centerline থেকে দুই পাশের কার্ব বের
    // করা হয়।
    const dx = flight.end.x - flight.start.x;
    const dy = flight.end.y - flight.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      warnSkipped(issues, { ...ref, id: flightLabel }, "flight-এর start/end পয়েন্ট একই — শূন্য-দৈর্ঘ্য flight");
      continue;
    }
    const halfWidth = g.width / 2;
    const perpX = (-dy / len) * halfWidth;
    const perpY = (dx / len) * halfWidth;

    const startLeft: DrawPoint2D = { x: flight.start.x + perpX, y: flight.start.y + perpY };
    const startRight: DrawPoint2D = { x: flight.start.x - perpX, y: flight.start.y - perpY };
    const endLeft: DrawPoint2D = { x: flight.end.x + perpX, y: flight.end.y + perpY };
    const endRight: DrawPoint2D = { x: flight.end.x - perpX, y: flight.end.y - perpY };

    warnReview(
      issues,
      { ...ref, id: flightLabel },
      `waist-slab thickness Draw থেকে আসে না — ${(DEFAULT_STAIR_WAIST_THICKNESS_M * 1000).toFixed(0)}mm ডিফল্ট ধরা হয়েছে, import review-তে প্রয়োজন অনুযায়ী পরিবর্তন করুন।`,
    );

    result.push({
      elementId: flightLabel,
      category: "stair",
      label: flightLabel,
      materialId: UNRESOLVED_MATERIAL_ID,
      storyId: ref.levelId || undefined,
      // bottom edge (start elevation) থেকে top edge (end elevation) —
      // counter-clockwise ক্রম (element.ts এর AreaElement.vertices কমেন্ট
      // অনুযায়ী)।
      vertices: [
        toPoint3D(startLeft, flightBaseM),
        toPoint3D(startRight, flightBaseM),
        toPoint3D(endRight, flightTopM),
        toPoint3D(endLeft, flightTopM),
      ],
      thickness: DEFAULT_STAIR_WAIST_THICKNESS_M * 1000, // mm
      // riserHeightM/numberOfSteps — Stair implementation gap-closing
      // pass (২০২৬-০৮): flight.riserHeight/numberOfSteps এখানেই উপরে
      // validate করা হয়েছে (isFiniteNumber check, ~লাইন ৪৮৪), কিন্তু
      // আগে elevation হিসাবের পর discard হয়ে যেত — StairElement এ কখনো
      // বসানো হতো না। এখন সরাসরি বসানো হলো, ফলে
      // deriveStairSelfWeightLoads.ts আর ইঞ্জিনিয়ারকে ম্যানুয়ালি riser
      // height দিতে বলবে না (StairDesignPanel.tsx তবু override করার
      // সুযোগ রাখে, saveElement() এই একই ফিল্ড লেখে), এবং
      // StairSectionSketch.tsx numberOfSteps দিয়ে সঠিক sawtooth ধাপ
      // সংখ্যা আঁকতে পারে — Draw থেকে import/re-sync হওয়া প্রতিটা
      // flight-এই এখন থেকে পূর্ণ (waist + step) self-weight ও একটা
      // accurate section sketch প্রথম sync থেকেই পাবে।
      riserHeightM: flight.riserHeight,
      numberOfSteps: flight.numberOfSteps,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return result;
}

/**
 * Column → ColumnElement (LineElement)। Draw-এর center + height থেকে
 * base/top দুই পয়েন্ট বানানো হয় — element.ts এর LineElement মডেল
 * অনুযায়ী Column একটা vertical line element (start=base, end=top)।
 * sectionId তৈরি করা যায় না (Draw-এর shape/width/depth থেকে সরাসরি এই
 * App-এর SectionLibrary entry বানানো UI-level সিদ্ধান্ত, parser-এর
 * pure-mapping স্কোপের বাইরে — প্ল্যানের Phase 2 আইটেমে "Wall→Wall/
 * ShearWall, Slab boundary→AreaElement" নির্দিষ্টভাবে উল্লেখ করা হয়েছে,
 * Column/Beam না — তাই এই দুটো ফাংশন বোনাস হিসেবে রাখা হলো, একই
 * defensive নীতিতে, কিন্তু sectionId সবসময় UNRESOLVED_SECTION_ID)।
 */
function mapColumn(ref: BuildingElementRef, baseElevationM: number, issues: ParsedElementIssue[], nowIso: string): StructuralElement | null {
  const g = ref.geometry as DrawColumnGeometry | undefined;
  if (!g || !isDrawPoint2D(g.center)) {
    warnSkipped(issues, ref, "center পয়েন্ট অনুপস্থিত বা ভুল shape");
    return null;
  }
  if (!isFiniteNumber(g.height) || g.height <= 0) {
    warnSkipped(issues, ref, "height অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }

  return {
    elementId: ref.id,
    category: "column",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    sectionId: UNRESOLVED_SECTION_ID,
    storyId: ref.levelId || undefined,
    startPoint: toPoint3D(g.center, baseElevationM),
    endPoint: toPoint3D(g.center, baseElevationM + g.height),
    connectionType: "moment", // Column-এর ডিফল্ট, element.ts এর LineElement কমেন্ট অনুযায়ী
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Beam → BeamElement। Column-এর মতোই defensive নীতি ও সীমাবদ্ধতা (sectionId unresolved)। elevation offset Draw-এর beam.elevation (সোফিট height) সরাসরি ব্যবহার করে। */
function mapBeam(ref: BuildingElementRef, baseElevationM: number, issues: ParsedElementIssue[], nowIso: string): StructuralElement | null {
  const g = ref.geometry as DrawBeamGeometry | undefined;
  if (!g || !isDrawPoint2D(g.start) || !isDrawPoint2D(g.end)) {
    warnSkipped(issues, ref, "start/end পয়েন্ট অনুপস্থিত বা ভুল shape");
    return null;
  }

  const elevationM = baseElevationM + (isFiniteNumber(g.elevation) ? g.elevation : 0);

  return {
    elementId: ref.id,
    category: "beam",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    sectionId: UNRESOLVED_SECTION_ID,
    storyId: ref.levelId || undefined,
    startPoint: toPoint3D(g.start, elevationM),
    endPoint: toPoint3D(g.end, elevationM),
    connectionType: "moment",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Footing → FootingElement (reference import)।
 *
 * এটা বাকি mapper গুলো থেকে গুণগতভাবে আলাদা — column/beam/wall/slab
 * এর dimension সরাসরি structural analysis-এ ব্যবহারযোগ্য (শুধু
 * material/section resolve বাকি), কিন্তু Draw-এর footing শুধু একজন
 * স্থপতির architectural sketch — bearing capacity/soil data ছাড়া
 * width/depth "ঠিক" কিনা এই App যাচাই করতে পারে না। তাই এই mapper
 * dimension বদলায় না (Draw যা পাঠিয়েছে হুবহু তাই বসে), কিন্তু সবসময়
 * "review-recommended" issue যোগ করে (Wall thickness-review প্যাটার্ন
 * অনুসরণ করে) — যাতে Import Review UI ইঞ্জিনিয়ারকে স্পষ্ট মনে করিয়ে
 * দেয় যে এই dimension একটা sketch reference, footingDesign.ts এর
 * bearing-capacity check দিয়ে যাচাই না করে সরাসরি নির্মাণে ব্যবহার
 * করা উচিত না। elevation বাদবাকি sub-grade element (Foundation) এর
 * মতোই baseElevationM এর সাপেক্ষে অফসেট (সাধারণত ঋণাত্মক)।
 */
function mapFooting(ref: BuildingElementRef, baseElevationM: number, issues: ParsedElementIssue[], nowIso: string): FootingElement | null {
  const g = ref.geometry as DrawFootingGeometry | undefined;
  if (!g || !isDrawPoint2D(g.center)) {
    warnSkipped(issues, ref, "center পয়েন্ট অনুপস্থিত বা ভুল shape");
    return null;
  }
  if (!isFiniteNumber(g.width) || g.width <= 0 || !isFiniteNumber(g.depth) || g.depth <= 0 || !isFiniteNumber(g.thickness) || g.thickness <= 0) {
    warnSkipped(issues, ref, "width/depth/thickness অনুপস্থিত বা অবৈধ (সংখ্যা হতে হবে, > 0)");
    return null;
  }

  const elevationM = baseElevationM + (isFiniteNumber(g.elevation) ? g.elevation : 0);

  warnReview(
    issues,
    ref,
    "Draw-এর architectural sketch থেকে reference হিসেবে import করা হয়েছে — এই width/depth/thickness bearing-capacity বা BNBC check দিয়ে যাচাই করা হয়নি। নির্মাণের আগে Footing Design প্যানেলে (footingDesign.ts) sizing verify/re-calculate করুন।",
  );

  return {
    elementId: ref.id,
    category: "footing",
    label: ref.id,
    materialId: UNRESOLVED_MATERIAL_ID,
    storyId: ref.levelId || undefined,
    location: toPoint3D(g.center, elevationM),
    width: g.width * 1000, // mm — element.ts এর FootingElement.width একক
    length: g.depth * 1000, // mm — Draw-এর "depth" এই App-এর "length" (plan Z-দিক)
    thickness: g.thickness * 1000, // mm
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ─── Top-level entry point ────────────────────────────────────────────

/**
 * Draw-এর সম্পূর্ণ ArchitecturalExport কে এই App-এর StructuralElement[]
 * + Grid/Story এ রূপান্তর করে। Firestore/Storage ছোঁয় না (সেটা
 * fetchLatestArchitecturalExport()-এর কাজ) — শুধু pure transformation,
 * unit-testable।
 *
 * শুধু ৮টা category হ্যান্ডল করা হয় (wall, shear-wall, slab, column, beam,
 * stair, stair-landing, parapet) — প্ল্যানের Phase 2 স্কোপ অনুযায়ী প্রথম
 * দুটো (wall/shear-wall, slab→area) মূল আইটেম, column/beam বোনাস
 * হিসেবে যোগ করা হয়েছে কারণ mapping একই রকম straightforward এবং Draw
 * ইতিমধ্যে পাঠায়। stair পরে যোগ হয়েছে (mapStair() দেখুন — প্রতিটা
 * flight একটা inclined StairElement, ETABS-এর মতো beam/column/slab/
 * stairs/shear-wall প্রয়োজন অনুযায়ী)। parapet dead-load contribution-এর
 * জন্য (mapParapet() দেখুন, Audit Gap Closure Phase 5 item 16-এর
 * Structural-দিকের বাস্তবায়ন)। stair-landing (mapStairLanding() দেখুন —
 * Stair implementation gap-closing pass, ২০২৬-০৮, শুধু mid-run 'turn'
 * landing, DrawStairLandingGeometry এর কমেন্ট দ্রষ্টব্য কেন bottom/top
 * landing বাদ)। footing সবচেয়ে সাম্প্রতিক সংযোজন (mapFooting() দেখুন —
 * Footing Reference Import gap-closing pass, ২০২৬-০৮) — dimension
 * পরিবর্তন না করে হুবহু "reference" হিসেবে import হয়, সবসময়
 * review-recommended issue সহ, কারণ bearing-capacity/BNBC sizing এই
 * App-এর নিজস্ব footingDesign.ts workflow-এর কাজ, Draw-এর architectural
 * sketch সেটা প্রতিস্থাপন করে না (DrawFootingGeometry এর কমেন্ট
 * দ্রষ্টব্য)। door/window/room/roof/ceiling/foundation/ইত্যাদি এখনো
 * ইচ্ছাকৃতভাবে বাদ — এগুলো structural element না (door/window/room),
 * অথবা foundation (mat/raft-type) এর জন্য এখনো কোনো structural
 * counterpart mapping সংজ্ঞায়িত হয়নি (ভবিষ্যতে MatFoundationElement-এর
 * সাথে একইভাবে reference-mapping যোগ হতে পারে)।
 */
export function parseArchitecturalExport(data: DrawArchitecturalExport): ParseGeometryResult {
  const nowIso = new Date().toISOString();
  const issues: ParsedElementIssue[] = [];

  const { grids, stories } = mapArchitecturalGeometry(data, nowIso);

  // ⚠️ বাগফিক্স: আগে data.levels/data.elements সরাসরি non-null array
  // ধরে নেওয়া হতো, কিন্তু mapArchitecturalGeometry() (hub-module-
  // mapper.ts) নিজে ইতিমধ্যেই data?.grids/data?.levels defensive
  // (undefined/আংশিক document safely handle করে) — এই ফাংশনেও একই
  // defensive practice মেলানো হলো। moduleData/architectural document
  // এ কখনো আংশিক/পুরনো shape থাকতে পারে (যেমন Draw-এর প্রথম কয়েকটা
  // sync attempt ব্যর্থ হলে, বা কেউ ম্যানুয়ালি Firestore console থেকে
  // partial edit করলে) — সেক্ষেত্রে ক্র্যাশ না করে "কিছু element
  // পাওয়া যায়নি" হিসেবে আচরণ করা উচিত, error UI না।
  const levels = data.levels ?? [];
  const elements = data.elements ?? [];

  const elevationByLevelId = new Map<string, number>(levels.map((lvl) => [lvl.id, lvl.elevation]));

  const mappedElements: StructuralElement[] = [];

  for (const ref of elements) {
    const baseElevationM = elevationByLevelId.get(ref.levelId);
    if (baseElevationM === undefined) {
      warnSkipped(issues, ref, `levelId "${ref.levelId}" এই export-এর levels তালিকায় নেই — কোন floor-এ এটা বসবে জানা যাচ্ছে না`);
      continue;
    }

    // stair বাকি সব category থেকে আলাদা — একটা ref থেকে ০+ element
    // আসতে পারে (multi-flight), তাই এখানেই সরাসরি push করে পরের ref-এ
    // যাওয়া হয়, নিচের single-mapped flow-এ ঢোকানো হয় না।
    if (ref.type === "stair") {
      const stairElements = mapStair(ref, baseElevationM, issues, nowIso);
      mappedElements.push(...stairElements);
      continue;
    }

    let mapped: StructuralElement | null;
    switch (ref.type) {
      case "wall":
      case "shear-wall":
        mapped = mapWall(ref, baseElevationM, issues, nowIso);
        break;
      case "slab":
        mapped = mapSlab(ref, baseElevationM, issues, nowIso);
        break;
      case "column":
        mapped = mapColumn(ref, baseElevationM, issues, nowIso);
        break;
      case "beam":
        mapped = mapBeam(ref, baseElevationM, issues, nowIso);
        break;
      case "parapet":
        mapped = mapParapet(ref, baseElevationM, issues, nowIso);
        break;
      case "stair-landing":
        mapped = mapStairLanding(ref, baseElevationM, issues, nowIso);
        break;
      case "footing":
        mapped = mapFooting(ref, baseElevationM, issues, nowIso);
        break;
      default:
        // door/window/room/roof/ceiling/foundation/ইত্যাদি —
        // ইচ্ছাকৃতভাবে স্কিপ, ফাইল হেডারে ব্যাখ্যা করা কারণে। এটা
        // warning-যোগ্য "সমস্যা" না, তাই issues-এ যোগ হয় না — শুধু
        // পরিকল্পিতভাবে out-of-scope।
        continue;
    }

    if (mapped) mappedElements.push(mapped);
  }

  return { elements: mappedElements, grids, stories, issues };
}

/**
 * সুবিধাজনক end-to-end wrapper: fetch + parse এক কলে। কোনো model
 * publish করা না থাকলে null (error না)।
 */
export async function fetchAndParseArchitecturalModel(projectId: string): Promise<ParseGeometryResult | null> {
  const fetched = await fetchLatestArchitecturalExport(projectId);
  if (!fetched) return null;
  return parseArchitecturalExport(fetched.data);
}
