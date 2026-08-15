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
 * Wall → Wall/ShearWall সিদ্ধান্ত — কেন কোনো automatic classification নেই
 * ═══════════════════════════════════════════════════════════════════
 * Draw-এর Wall.type শুধু 'EXTERIOR' | 'INTERIOR' | 'PARTITION' —
 * architectural ব্যবহার (কোন দেয়াল বাইরের, কোনটা ঘর ভাগ করে) বোঝায়,
 * lateral-load-resisting ভূমিকা না। কোনো dedicated shear-wall flag Draw-
 * এর geometry.ts-এ নেই (structuralNote/tags free-text, নির্ভরযোগ্য না)।
 *
 * thickness দিয়ে অনুমান করাও অনির্ভরযোগ্য — ওয়েব রেফারেন্স যাচাই করে
 * দেখা গেছে বাস্তব RC shear wall thickness সাধারণত 150-400mm রেঞ্জে,
 * কিন্তু বাংলাদেশে প্রচলিত সাধারণ (non-structural) brick/block দেয়ালও
 * 125-250mm রেঞ্জে পড়ে (5"-10" brick wall) — দুই রেঞ্জ যথেষ্ট overlap
 * করে, তাই একটা নির্দিষ্ট thickness threshold "shear wall" এর নির্ভরযোগ্য
 * indicator না। ভুল classification-এর ফলাফল গুরুতর (shear wall-কে সাধারণ
 * Wall ধরলে lateral system-এর একটা অংশ analysis থেকে বাদ পড়ে যাবে,
 * বা উল্টোটা — সাধারণ দেয়ালকে shear wall ধরলে ভুল stiffness যোগ হবে)।
 *
 * তাই এই parser **সবসময়** category: "wall" বসায় (কখনো "shear-wall"
 * automatically না), কিন্তু thickness ≥ THICK_WALL_REVIEW_THRESHOLD_M
 * হলে একটা 'approximate' সতর্কতা যোগ করে যাতে ইঞ্জিনিয়ার নিজে review
 * করে প্রয়োজনে ShearWallElement-এ পরিবর্তন করতে পারেন (এই ফাইলে সেই
 * পরিবর্তন ম্যানুয়াল — parser নিজে করে না)।
 */

import type { StructuralElement, Point3D, WallElement, SlabElement } from "@/lib/types/element";
import type { StructuralGrid, StructuralStory } from "@/lib/types/geometry";
import type { BuildingElementRef } from "./contract.types";
import type {
  DrawArchitecturalExport,
  DrawPoint2D,
  DrawWallGeometry,
  DrawSlabGeometry,
  DrawColumnGeometry,
  DrawBeamGeometry,
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
 * এই thickness-এর উপরে/সমান হলে "এটা হয়তো shear wall হতে পারে, review
 * করুন" সতর্কতা যোগ হয় — কিন্তু category কখনো automatically পাল্টায় না
 * (ফাইল হেডারের ব্যাখ্যা দেখুন)। 150mm বেছে নেওয়া হয়েছে কারণ এটা RC
 * shear wall-এর প্রচলিত সর্বনিম্ন থ্রেশহোল্ড (একাধিক রেফারেন্সে
 * 150-400mm রেঞ্জ পাওয়া গেছে, 150mm সবচেয়ে রক্ষণশীল নিম্নসীমা) —
 * এর নিচে থাকা দেয়াল review-এর জন্যও flag করা হয় না, কারণ shear wall
 * হওয়ার সম্ভাবনা তুলনামূলক কম।
 */
const THICK_WALL_REVIEW_THRESHOLD_M = 0.15;

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
 * Wall → WallElement। এখানেই "Wall→Wall/ShearWall" নিয়মের বাস্তবায়ন —
 * সবসময় category: "wall", কখনো "shear-wall" না (কারণ ফাইল হেডারে
 * ব্যাখ্যা করা)। thickness ভারী হলে review-recommended issue যোগ হয়।
 */
function mapWall(
  ref: BuildingElementRef,
  baseElevationM: number,
  issues: ParsedElementIssue[],
  nowIso: string,
): WallElement | null {
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

  if (g.thickness >= THICK_WALL_REVIEW_THRESHOLD_M) {
    warnReview(
      issues,
      ref,
      `thickness ${(g.thickness * 1000).toFixed(0)}mm — RC shear wall-এর প্রচলিত রেঞ্জে (≥150mm) পড়ে। lateral system-এর অংশ কিনা ইঞ্জিনিয়ার review করে প্রয়োজনে "shear-wall" category-তে পরিবর্তন করুন — এই parser automatically পরিবর্তন করে না।`,
    );
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

  return {
    elementId: ref.id,
    category: "wall",
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

// ─── Top-level entry point ────────────────────────────────────────────

/**
 * Draw-এর সম্পূর্ণ ArchitecturalExport কে এই App-এর StructuralElement[]
 * + Grid/Story এ রূপান্তর করে। Firestore/Storage ছোঁয় না (সেটা
 * fetchLatestArchitecturalExport()-এর কাজ) — শুধু pure transformation,
 * unit-testable।
 *
 * শুধু ৪টা category হ্যান্ডল করা হয় (wall, slab, column, beam) —
 * প্ল্যানের Phase 2 স্কোপ অনুযায়ী প্রথম দুটো (wall→wall/shear-wall,
 * slab→area) মূল আইটেম, column/beam বোনাস হিসেবে যোগ করা হয়েছে কারণ
 * mapping একই রকম straightforward এবং Draw ইতিমধ্যে পাঠায়। door/window/
 * room/stair/roof/ceiling/foundation/footing/ইত্যাদি ইচ্ছাকৃতভাবে বাদ —
 * এগুলো হয় structural element না (door/window/room), অথবা এই App-এর
 * নিজস্ব foundation design workflow-এর (FootingElement ইত্যাদি) সাথে
 * architectural geometry সরাসরি না মেলা উচিত (foundation sizing এই
 * App-এর হিসাব, Draw-এর architectural foundation sketch থেকে সরাসরি
 * import করা বিভ্রান্তিকর — ভবিষ্যতে আলাদা "reference only" ধরনের
 * ব্যবহারের সুযোগ থাকতে পারে, কিন্তু এখন parse করা হচ্ছে না)।
 */
export function parseArchitecturalExport(data: DrawArchitecturalExport): ParseGeometryResult {
  const nowIso = new Date().toISOString();
  const issues: ParsedElementIssue[] = [];

  const { grids, stories } = mapArchitecturalGeometry(data, nowIso);

  const elevationByLevelId = new Map<string, number>(data.levels.map((lvl) => [lvl.id, lvl.elevation]));

  const elements: StructuralElement[] = [];

  for (const ref of data.elements) {
    const baseElevationM = elevationByLevelId.get(ref.levelId);
    if (baseElevationM === undefined) {
      warnSkipped(issues, ref, `levelId "${ref.levelId}" এই export-এর levels তালিকায় নেই — কোন floor-এ এটা বসবে জানা যাচ্ছে না`);
      continue;
    }

    let mapped: StructuralElement | null;
    switch (ref.type) {
      case "wall":
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
      default:
        // door/window/room/stair/roof/ceiling/foundation/footing/ইত্যাদি
        // — ইচ্ছাকৃতভাবে স্কিপ, ফাইল হেডারে ব্যাখ্যা করা কারণে। এটা
        // warning-যোগ্য "সমস্যা" না, তাই issues-এ যোগ হয় না — শুধু
        // পরিকল্পিতভাবে out-of-scope।
        continue;
    }

    if (mapped) elements.push(mapped);
  }

  return { elements, grids, stories, issues };
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
