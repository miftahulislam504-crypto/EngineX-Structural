"use client";

/**
 * useArchitecturalImport.ts — Phase 6.5 (Architectural Import & Review UI)
 * ------------------------------------------------------------------
 * hub-geometry-parser.ts (Phase 2) সঠিকভাবে Draw-এর ArchitecturalExport
 * কে StructuralElement[]-এ রূপান্তর করে, কিন্তু সেই ফাংশন কোনো UI থেকে
 * কখনো call হতো না — fetch → parse হওয়ার পরে ফলাফল live model-এ লেখার
 * কোনো জায়গা ছিল না (useHubModuleSubscriptions.ts-এর নিজের কমেন্টেই এই
 * ফাঁক স্বীকার করা আছে)। এই hook সেই বাকি অংশটা যোগ করে।
 *
 * ডিজাইন সিদ্ধান্ত (hub-geometry-parser.ts-এর হেডার কমেন্টের নীতি মেনে):
 *   - কখনোই auto-write না। fetch+parse হওয়ার পর ফলাফল শুধু local
 *     review state-এ বসে থাকে, ইঞ্জিনিয়ার প্রতিটা element-এ material/
 *     section বেছে দিয়ে "আমদানি নিশ্চিত করুন" চাপলেই তবে Firestore-এ
 *     write হয়।
 *   - UNRESOLVED_MATERIAL_ID/UNRESOLVED_SECTION_ID (parser থেকে আসা)
 *     থাকা অবস্থায় confirm করা যায় না — প্রতিটা element-এর materialId/
 *     sectionId (line element হলে) আসল library entry-তে resolve হতে
 *     হবে।
 *   - thickness ≥150mm ওয়ালা wall-এ parser "review-recommended" issue
 *     দেয় (সম্ভাব্য shear wall) — এই hook সেই wall-গুলোর জন্য category
 *     override (wall ⇄ shear-wall) টগল সমর্থন করে, ডিফল্ট category
 *     parser যা দিয়েছে তাই থাকে (কখনো automatic পাল্টায় না)।
 *   - Draw থেকে আসা "সাধারণ" (architectural/partition) wall কখনোই
 *     মডেলে যোগ হয় না — ETABS-এর মতো এই মডেলেও শুধু beam/column/slab/
 *     stairs/shear-wall structural analysis element হিসেবে থাকে। তাই
 *     category "wall" ওয়ালা প্রতিটা item ডিফল্ট includeAsShearWall:
 *     false নিয়ে শুরু হয় — ইঞ্জিনিয়ার explicitly "Shear Wall" চেকপয়েন্ট
 *     না দিলে সেই wall confirmImport()-এ silently বাদ পড়ে (skip, block
 *     না)। চেকপয়েন্ট দিলে categoryOverride "shear-wall"-এ সেট হয় এবং
 *     ঠিক অন্য elements-এর মতোই material/section resolve করে import
 *     হয়। non-wall category (beam/column/slab/stairs/shear-wall/parapet
 *     সরাসরি parser থেকে যদি কখনো আসে) এই ফ্ল্যাগ ছোঁয় না, স্বাভাবিকভাবে
 *     import হয়।
 *   - re-import নিরাপদ: elementId Draw-এর BuildingElementRef.id থেকে
 *     সরাসরি আসে (parser অপরিবর্তিত রাখে), তাই একই element আবার import
 *     করলে saveElement() (setDoc) ওভাররাইট করবে, ডুপ্লিকেট হবে না।
 *     Grid/Story একইভাবে upsertGrid/upsertStory দিয়ে merge হয় (id
 *     মিললে replace, নাহলে নতুন যোগ)।
 *
 * ⚠️ বাগফিক্স (Model Checker wiring): আগে এই hook fetch+parse করার পরে
 * সরাসরি review state বসিয়ে দিত — modelChecker.ts (Phase 5, connectivity/
 * duplicate/geometry/support check) কখনো এখানে call হতো না। ফলে Draw
 * থেকে আসা geometry ভাঙা থাকলেও (floating wall, duplicate element,
 * zero-length beam, কোনো base support না থাকা) ইঞ্জিনিয়ার শুধু material/
 * section resolve করেই Confirm চাপতে পারতেন — কেউ ম্যানুয়ালি Validation
 * Panel না খুললে কখনো জানতেন না মডেল ভাঙা ছিল, আর Analysis চুপচাপ ভুল/
 * অর্থহীন ফলাফল দিত। এখন fetchAndParse() শেষে runModelChecks() চালানো
 * হয় resolved elements (category override প্রয়োগ করা) এর ওপর —
 * modelChecker.ts সম্পূর্ণ geometry-driven (materialId/sectionId ছোঁয়
 * না), তাই material/section resolve হওয়ার আগেই safely চালানো যায়।
 * কোনো "error"-severity issue থাকলে allResolved false হয়ে যায় (Confirm
 * বাটন disabled থাকবে), ঠিক material/section অসম্পূর্ণ থাকলে যেভাবে হয়।
 */

import { useCallback, useMemo, useState } from "react";
import {
  fetchLatestArchitecturalExport,
  parseArchitecturalExport,
  type ParseGeometryResult,
  type ParsedElementIssue,
} from "./hub-geometry-parser";
import type { StructuralElement } from "@/lib/types/element";
import type { StructuralGrid, StructuralStory, GeometryCore } from "@/lib/types/geometry";
import { upsertGrid, upsertStory } from "@/lib/geometry/firestore";
import { runModelChecks } from "@/lib/validation/modelChecker";
import { buildValidationReport, type ValidationReport } from "@/lib/validation/types";

const UNRESOLVED_MATERIAL_ID = "__unresolved_material__";
const UNRESOLVED_SECTION_ID = "__unresolved_section__";

/** LineElement (beam/column/brace/pile) ছাড়া বাকি সবার sectionId নেই — resolve চেকে এই ফারাক ধরতে হবে। */
function isLineCategory(category: StructuralElement["category"]): boolean {
  return category === "beam" || category === "column" || category === "brace" || category === "pile";
}

/** ImportReviewItem-এ category override সমর্থন শুধু wall ⇄ shear-wall-এর মধ্যে — parser-এর হেডার কমেন্টের সীমাবদ্ধতা অনুযায়ী, অন্য কোনো category-জোড়ার মধ্যে অনুমতিপ্রাপ্ত পরিবর্তন নেই। */
export type OverridableCategory = "wall" | "shear-wall";

export interface ImportReviewItem {
  /** parser-এর দেওয়া মূল element — materialId/sectionId/category override এখানে প্রয়োগ করে চূড়ান্ত রূপ বের করা হয়, মূল কপি অপরিবর্তিত থাকে (Reset বাটনের জন্য)। */
  original: StructuralElement;
  materialId: string;
  sectionId: string | null; // null মানে এই category-র sectionId লাগে না (area/point element)
  categoryOverride: OverridableCategory | null;
  /**
   * শুধু category === "wall" item-এ প্রাসঙ্গিক (বাকি সবার জন্য সবসময়
   * true, নিচে buildReviewItems() দেখুন)। false থাকা মানে এই wall-টা
   * "সাধারণ" (architectural) — ইঞ্জিনিয়ার এখনো একে shear wall হিসেবে
   * চেকপয়েন্ট করেননি, তাই confirmImport()-এ এটা বাদ পড়বে। true মানে
   * ইঞ্জিনিয়ার চেকপয়েন্ট দিয়েছেন — categoryOverride "shear-wall"-এ সেট
   * থাকবে এবং এটা বাকি elements-এর মতোই normally import হবে।
   */
  includeAsShearWall: boolean;
  /** এই elementId-র সাথে সম্পর্কিত issue(s), যদি থাকে (review-recommended) — skipped issue এখানে আসে না, কারণ skipped element কখনো elements[]-এ ঢোকেই না। */
  issue: ParsedElementIssue | null;
}

export type ImportFetchStatus = "idle" | "loading" | "no_data" | "ready" | "error";

export interface ArchitecturalImportState {
  status: ImportFetchStatus;
  errorMessage: string | null;
  items: ImportReviewItem[];
  grids: StructuralGrid[];
  stories: StructuralStory[];
  skippedIssues: ParsedElementIssue[]; // element কখনো তৈরিই হয়নি এমন issue (missing/invalid geometry ইত্যাদি) — শুধু তথ্যের জন্য দেখানো, override করার কিছু নেই
  /** Model Checker (modelChecker.ts) ফলাফল — connectivity/duplicate/geometry/support, category override প্রয়োগ করা elements এর ওপর চালানো (নিচে fetchAndParse দেখুন)। runValidation.ts এর মতোই buildValidationReport() দিয়ে wrap করা (errorCount/healthScore সহ) — ValidationPanel.tsx এর সাথে সামঞ্জস্যপূর্ণ shape, যাতে Import Review UI একই কার্ড/ব্যাজ প্যাটার্ন পুনর্ব্যবহার করতে পারে। fetch/parse ব্যর্থ হলে বা কোনো element না থাকলে খালি issues (healthScore 100)। */
  modelCheckReport: ValidationReport;
  moduleVersion: number | null;
  fetchedAt: string | null;
}

const INITIAL_STATE: ArchitecturalImportState = {
  status: "idle",
  errorMessage: null,
  items: [],
  grids: [],
  stories: [],
  skippedIssues: [],
  modelCheckReport: buildValidationReport([]),
  moduleVersion: null,
  fetchedAt: null,
};

function buildReviewItems(result: ParseGeometryResult): {
  items: ImportReviewItem[];
  skippedIssues: ParsedElementIssue[];
} {
  const issueByElementId = new Map<string, ParsedElementIssue>();
  const skippedIssues: ParsedElementIssue[] = [];

  for (const issue of result.issues) {
    if (issue.severity === "skipped") {
      skippedIssues.push(issue);
    } else {
      issueByElementId.set(issue.elementRefId, issue);
    }
  }

  const items: ImportReviewItem[] = result.elements.map((el) => ({
    original: el,
    materialId: el.materialId === UNRESOLVED_MATERIAL_ID ? "" : el.materialId,
    sectionId: isLineCategory(el.category)
      ? "sectionId" in el && el.sectionId !== UNRESOLVED_SECTION_ID
        ? (el as StructuralElement & { sectionId: string }).sectionId
        : ""
      : null,
    categoryOverride: null,
    // "wall" ছাড়া বাকি সব category (beam/column/slab/stairs/shear-wall/
    // parapet) সবসময় include — শুধু সাধারণ wall ডিফল্টে বাদ, চেকপয়েন্ট
    // দিলে যোগ। parapet কখনো shear-wall candidate হয় না (mapParapet()
    // দেখুন, hub-geometry-parser.ts), তাই এই wall-only gate তার জন্য
    // প্রযোজ্য না — বাকি সব category-র মতোই সবসময় true।
    includeAsShearWall: el.category !== "wall",
    issue: issueByElementId.get(el.elementId) ?? null,
  }));

  return { items, skippedIssues };
}

/**
 * item-টা confirmImport()-এ আদৌ model-এ যাবে কিনা — শুধু un-checked
 * সাধারণ wall (includeAsShearWall false) বাদ পড়ে, বাকি সব category
 * (beam/column/slab/stairs, ও checkpoint-করা shear-wall) সবসময় true।
 * material/section resolve, model-check input, এবং চূড়ান্ত save — এই
 * তিন জায়গাতেই একই filter ব্যবহার করা হয় যাতে "কী গণনা হচ্ছে" এবং "কী
 * সেভ হচ্ছে" কখনো আলাদা না হয়ে যায়।
 */
function willImport(item: ImportReviewItem): boolean {
  return item.includeAsShearWall;
}

/**
 * চূড়ান্ত StructuralElement তৈরি করে (category override প্রয়োগ করে) —
 * module-scope pure function (আগে hook-এর ভিতরে useCallback হিসেবে
 * ছিল, এখানে বের করা হলো যাতে fetchAndParse() ভিতর থেকেও এটা ব্যবহার
 * করে runModelChecks()-এর জন্য resolved elements বানাতে পারে, hook এর
 * নিজস্ব state/closure এর ওপর নির্ভর না করে)। materialId এখানে item এর
 * বর্তমান মান (হয়তো এখনো খালি স্ট্রিং, resolve না হলে) বসায় — এটা ঠিক
 * আছে কারণ modelChecker.ts geometry-driven, materialId/sectionId ছোঁয়
 * না (নিচে fetchAndParse এর কমেন্ট দেখুন)।
 */
function resolveItem(item: ImportReviewItem): StructuralElement {
  const category = item.categoryOverride ?? item.original.category;
  const base = { ...item.original, category, materialId: item.materialId } as StructuralElement;
  if (item.sectionId !== null && "sectionId" in base) {
    return { ...base, sectionId: item.sectionId } as StructuralElement;
  }
  return base;
}

/**
 * Architectural Import — orchestration hook। "একবার fetch করে review
 * state-এ বসানো, তারপর ইঞ্জিনিয়ারের প্রতিটা পরিবর্তন (material/section/
 * category বাছাই) local state-এ রাখা, শেষে confirm করলে Grid/Story
 * (useGeometryCore-এর persist যুক্তি অনুসরণ করে, Phase 1-এর মতোই পুরো
 * GeometryCore ডকুমেন্ট আবার লেখা) ও Elements (useElementsCore-এর
 * addElement যুক্তি অনুসরণ করে, প্রতিটা independent Firestore write)
 * সেভ করা — এই দায়িত্ব ভাগাভাগি সরাসরি ওই দুই hook-এর প্যাটার্ন থেকে
 * ধার করা, নতুন persist logic এখানে বানানো হয়নি।
 */
export function useArchitecturalImport(projectId: string) {
  const [state, setState] = useState<ArchitecturalImportState>(INITIAL_STATE);

  const fetchAndParse = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", errorMessage: null }));
    try {
      const fetched = await fetchLatestArchitecturalExport(projectId);
      if (!fetched) {
        setState({ ...INITIAL_STATE, status: "no_data" });
        return;
      }

      const result = parseArchitecturalExport(fetched.data);
      const { items, skippedIssues } = buildReviewItems(result);

      // Model Checker (Phase 5) — connectivity/duplicate/geometry/support
      // check resolved elements এর ওপর (category override সহ, যদি কেউ
      // ইতিমধ্যে থাকে — নতুন fetch এ items সবে বানানো হলো তাই এই মুহূর্তে
      // categoryOverride সবসময় null, কিন্তু resolveItem() ব্যবহার করাই
      // ভবিষ্যতে ধারাবাহিক থাকবে যদি re-fetch flow পরে override-aware হয়)।
      // materialId/sectionId এখনো unresolved (খালি স্ট্রিং) থাকতে পারে —
      // modelChecker.ts এই দুটো ফিল্ড ছোঁয় না (pure geometry check), তাই
      // material/section resolve হওয়ার আগেই নিরাপদে চালানো যায়। এভাবে
      // ইঞ্জিনিয়ার material/section পূরণ করার আগেই geometry সমস্যা
      // (floating wall, duplicate element, zero-length beam, no base
      // support) সম্পর্কে জানতে পারবেন — শুধু Validation Panel ম্যানুয়ালি
      // খুললে তবে জানা যেত এমন না।
      // model-check শুধু সেই elements-এর ওপর চালানো হয় যেগুলো আসলে
      // import হবে (un-checked সাধারণ wall বাদ) — নাহলে কখনো import না
      // হওয়া wall-এর জন্য ভুল floating/connectivity error দেখানো হতো।
      const resolvedForCheck = items.filter(willImport).map(resolveItem);
      const modelCheckReport = buildValidationReport(runModelChecks(resolvedForCheck));

      setState({
        status: "ready",
        errorMessage: null,
        items,
        grids: result.grids,
        stories: result.stories,
        skippedIssues,
        modelCheckReport,
        moduleVersion: fetched.moduleVersion,
        fetchedAt: fetched.fetchedAt,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "অজানা ত্রুটি — আবার চেষ্টা করুন।",
      }));
    }
  }, [projectId]);

  const setItemMaterial = useCallback((elementId: string, materialId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.original.elementId === elementId ? { ...it, materialId } : it)),
    }));
  }, []);

  const setItemSection = useCallback((elementId: string, sectionId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.original.elementId === elementId ? { ...it, sectionId } : it)),
    }));
  }, []);

  const setItemCategoryOverride = useCallback((elementId: string, category: OverridableCategory | null) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.original.elementId === elementId ? { ...it, categoryOverride: category } : it)),
    }));
  }, []);

  /**
   * Bulk/group material assignment — নতুন সংযোজন (ইঞ্জিনিয়ারের অনুরোধে)।
   * যেহেতু Hub import সবসময় একটা preliminary/প্রাথমিক ধাপ (সব Wall
   * একই material, সব Column একই section+material, সব Beam/Slab/Stairs
   * নিজ নিজ একই সিলেকশন দিয়ে শুরু করে পরে ইঞ্জিনিয়ার আলাদা আলাদা করে
   * override করবেন — প্রতিটা element এক এক করে বেছে দেওয়া অপ্রয়োজনীয়
   * সময়ক্ষেপণ), এই ফাংশন একটা category-র (categoryOverride প্রয়োগ করা
   * effective category — panel-এর groupedItems ঠিক এই একই key ব্যবহার
   * করে, নিচে ArchitecturalImportPanel.tsx দেখুন) সব item-এ এক লহমায়
   * একই materialId বসিয়ে দেয়। পরে ইঞ্জিনিয়ার চাইলে setItemMaterial()
   * দিয়ে যেকোনো একটা item আলাদাভাবে বদলাতে পারবেন — bulk assignment তার
   * পথ আটকায় না, শুধু starting point দ্রুত করে।
   */
  const setGroupMaterial = useCallback((category: string, materialId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        (it.categoryOverride ?? it.original.category) === category ? { ...it, materialId } : it
      ),
    }));
  }, []);

  /**
   * Bulk/group section assignment — setGroupMaterial()-এর মতোই, কিন্তু
   * শুধু line category (Beam/Column — sectionId !== null ওয়ালা item)-এ
   * প্রযোজ্য। Wall/Slab/Stairs-এর sectionId নেই (area/point element),
   * তাই তাদের category-তে এই ফাংশন কল করলে কোনো item-ই মেলে না (map
   * করার সময় sectionId !== null চেক আগে থেকেই আছে বলে নিরাপদ, কিন্তু
   * caller-side (panel) এ শুধু sectionId !== null থাকা group-এই dropdown
   * দেখানো হবে যাতে বিভ্রান্তিকর no-op UI না দেখায়)।
   */
  const setGroupSection = useCallback((category: string, sectionId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        (it.categoryOverride ?? it.original.category) === category && it.sectionId !== null
          ? { ...it, sectionId }
          : it
      ),
    }));
  }, []);

  /**
   * "Shear Wall হিসেবে import করুন" চেকপয়েন্ট — শুধু category === "wall"
   * item-এ প্রযোজ্য। checked করলে categoryOverride "shear-wall"-এ সেট
   * হয় (ঠিক আগের override যুক্তিই ব্যবহার করে, thickness-issue থাকুক বা
   * না থাকুক) এবং includeAsShearWall true হয়ে item confirmImport()-এ
   * অন্তর্ভুক্ত হয়। uncheck করলে categoryOverride আবার null এবং
   * includeAsShearWall false — item confirmImport()-এ silently বাদ
   * পড়ে (Confirm বাটন কখনো এর জন্য disabled হয় না, নিচে
   * materialsSectionsResolved/allResolved দেখুন)।
   */
  const setItemIncludeAsShearWall = useCallback((elementId: string, include: boolean) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.original.elementId === elementId
          ? { ...it, includeAsShearWall: include, categoryOverride: include ? "shear-wall" : null }
          : it
      ),
    }));
  }, []);

  /**
   * প্রতিটা import-হতে-যাওয়া item-এ (willImport() — un-checked সাধারণ
   * wall বাদ, সেগুলোর material/section কখনো লাগবেই না কারণ সেগুলো
   * confirmImport()-এ ছোঁয়াই হয় না) materialId (সব category) এবং
   * sectionId (শুধু line category — beam/column/brace/pile) পূরণ করা
   * আছে কিনা।
   */
  const materialsSectionsResolved = state.items
    .filter(willImport)
    .every((it) => it.materialId.trim() !== "" && (it.sectionId === null || it.sectionId.trim() !== ""));

  /**
   * Model Checker এর "error"-severity issue (connectivity/duplicate/
   * geometry/support — modelChecker.ts) থাকলে ব্লক করে, ঠিক যেমন
   * unresolved material/section ব্লক করে। "warning"/"info" severity
   * ব্লক করে না (যেমন Footing skip notice, single-end-pin caveat) —
   * শুধু জানানোর জন্য, model চালানো-অযোগ্য না।
   */
  const blockingModelCheckIssues = useMemo(
    () => state.modelCheckReport.issues.filter((issue) => issue.severity === "error"),
    [state.modelCheckReport]
  );
  const hasBlockingModelIssues = blockingModelCheckIssues.length > 0;

  /**
   * যতক্ষণ material/section অসম্পূর্ণ অথবা geometry-তে error-severity
   * সমস্যা থাকে, ততক্ষণ confirmImport() কল করা উচিত না (UI-তে বাটন
   * disabled রাখা হবে এই ফ্ল্যাগ দিয়ে) — parser-এর "কখনো ভুল-দেখতে ID
   * বসিয়ে দেওয়া হবে না" নীতির, এবং এখন Model Checker এর "ভাঙা geometry
   * নিয়ে চুপচাপ import না করা" নীতির সরাসরি বাস্তবায়ন।
   */
  const allResolved = materialsSectionsResolved && !hasBlockingModelIssues;

  /**
   * Confirm — Grid/Story আগে (persist ফাংশন থেকে সরাসরি ধার করা upsert
   * যুক্তি ব্যবহার করে, কিন্তু GeometryCore document লেখার দায়িত্ব
   * caller-এর, কারণ সেই save call useGeometryCore hook-এর মধ্যেই থাকা
   * উচিত যাতে Firestore subscription/local store sync থাকে — এই hook
   * শুধু merge করা GeometryCore অবজেক্টটা রিটার্ন করে, caller
   * saveGeometryCore() কল করবে)। Element গুলো caller-এর addElement
   * (useElementsCore থেকে) দিয়ে একে একে save হবে, কারণ সেটাই
   * subcollection-এর independent-write প্যাটার্ন (firestore.ts-এর
   * কমেন্ট দেখুন) — এই hook নিজে Firestore ছোঁয় না, ঠিক
   * hub-geometry-parser.ts-এর মতো pure/orchestration স্তরে থাকে।
   */
  const buildMergedGeometry = useCallback(
    (currentGeometry: GeometryCore): GeometryCore => {
      let next = currentGeometry;
      for (const grid of state.grids) {
        next = upsertGrid(next, grid);
      }
      for (const story of state.stories) {
        next = upsertStory(next, story);
      }
      return next;
    },
    [state.grids, state.stories]
  );

  /**
   * চূড়ান্ত save-এ যাওয়া elements — un-checked সাধারণ wall বাদ (কখনো
   * addElement() কল হয় না তাদের জন্য), বাকি সব (beam/column/slab/
   * stairs, checkpoint-করা shear-wall) resolveItem() দিয়ে category
   * override + material/section প্রয়োগ করে রিটার্ন হয়।
   */
  const resolvedElements = useCallback((): StructuralElement[] => {
    return state.items.filter(willImport).map(resolveItem);
  }, [state.items]);

  /** UI-তে "X টা wall বাদ যাবে" জাতীয় সারাংশ দেখানোর জন্য — কখনো model-এ যাবে না, শুধু তথ্যের জন্য। */
  const excludedWallCount = state.items.filter((it) => !willImport(it)).length;

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return {
    state,
    allResolved,
    materialsSectionsResolved,
    hasBlockingModelIssues,
    blockingModelCheckIssues,
    fetchAndParse,
    setItemMaterial,
    setItemSection,
    setItemCategoryOverride,
    setItemIncludeAsShearWall,
    setGroupMaterial,
    setGroupSection,
    buildMergedGeometry,
    resolvedElements,
    excludedWallCount,
    reset,
  };
}
