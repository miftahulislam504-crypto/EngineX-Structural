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
 *   - সব category (wall/shear-wall/slab/column/beam/stair/stair-landing/
 *     parapet/footing) সবসময় import হয় — কোনো category-ভিত্তিক
 *     ম্যানুয়াল include/exclude gate নেই। (২০২৬-০৯-০৪: ordinary "wall"
 *     আসলে এখন items[]/StructuralElement একদমই না — নিচের নোট দেখুন।)
 *
 * ⚠️ সংশোধনী নোট (Miftahul, 2026-08-25 — নিচের ইতিহাস প্রসঙ্গের জন্য
 * রাখা হলো, বর্তমান আচরণ না): আগে category "wall" ওয়ালা প্রতিটা item
 * ডিফল্ট includeAsShearWall: false নিয়ে শুরু হতো, আর ইঞ্জিনিয়ার
 * explicitly "Shear Wall" চেকপয়েন্ট না দিলে confirmImport()-এ silently
 * বাদ পড়তো (ETABS-এর মতো শুধু beam/column/slab/stairs/shear-wall
 * analysis model-এ থাকে ধরে নিয়ে) — কারণ Draw-এ তখন shear-wall
 * classification করার কোনো উপায়ই ছিল না, thickness দিয়ে অনুমান
 * অনির্ভরযোগ্য প্রমাণিত হয়েছিল (hub-geometry-parser.ts-এর পুরনো header
 * নোট দেখুন)।
 *
 * এখন Draw-এ Wall.isShearWall (ইঞ্জিনিয়ারের explicit flag) থাকায়
 * classification Hub-এ আসার আগেই ঠিক হয়ে যায় — parser নিজেই সঠিক
 * category ("wall" বা "shear-wall") বসিয়ে দেয় (mapWall(), hub-geometry-
 * parser.ts)। তাই এই hook-এ আর কোনো wall-only include/exclude gate,
 * categoryOverride, বা "Shear Wall হিসেবে import করুন" চেকপয়েন্ট নেই —
 * category "wall" এখন থেকে বাকি সব category-র মতোই সবসময় import হয়
 * (self-weight/dead-load contributor হিসেবে, ঠিক Beam/Column/Slab-এর
 * মতো — lateral design/capacity check শুধু "shear-wall"/"core-wall"-এ
 * প্রযোজ্য, element.ts-এর ShearWallElement কমেন্ট দেখুন)।
 *
 * ⚠️ চতুর্থ সংশোধনী নোট (Miftahul, 2026-09-04 — উপরের প্যারাগ্রাফের
 * "category 'wall' বাকি সব category-র মতোই import হয়" অংশ আর বর্তমান
 * আচরণ না, শুধু ইতিহাস প্রসঙ্গের জন্য রাখা হলো): Hub payload-size split
 * এর পর ordinary wall (isShearWall: false) parser থেকে আর
 * StructuralElement হিসেবে আসেই না (hub-geometry-parser.ts এর
 * mapWallSelfWeightRef()/WallSelfWeightRef কমেন্ট দেখুন) — তাই এই hook
 * এর items[] এ ordinary wall কখনো নেই, material/section resolve করার
 * প্রশ্নই ওঠে না তাদের জন্য। এরা এখন state.wallSelfWeightRefs এ আলাদা
 * array হিসেবে থাকে (ParseGeometryResult.wallSelfWeightRefs সরাসরি
 * কপি করা) — confirm এ replaceAllWallSelfWeightRefs() দিয়ে persist হয়
 * (wallSelfWeightRefs.firestore.ts), items[]/resolvedElements() এর
 * পথে না। শুধু "shear-wall" এখনো items[] এ StructuralElement হিসেবে
 * থাকে, উপরের সব review/resolve যুক্তি তার জন্য অপরিবর্তিত।
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
  type WallSelfWeightRef,
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

export interface ImportReviewItem {
  /** parser-এর দেওয়া মূল element — materialId/sectionId এখানে প্রয়োগ করে চূড়ান্ত রূপ বের করা হয়, মূল কপি অপরিবর্তিত থাকে (Reset বাটনের জন্য)। category parser-এই চূড়ান্ত (mapWall() Draw-এর isShearWall flag থেকে সরাসরি "wall"/"shear-wall" ঠিক করে দেয়) — এখানে আর কোনো override নেই। */
  original: StructuralElement;
  materialId: string;
  sectionId: string | null; // null মানে এই category-র sectionId লাগে না (area/point element)
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
  /** ordinary wall (ref.type "wall") centerline+self-weight ref — ২০২৬-০৯-০৪ Hub payload-size split। StructuralElement না বলে items[] এ নেই, তাই কোনো material/section resolve লাগে না — সরাসরি confirm এ replaceAllWallSelfWeightRefs() দিয়ে persist হয় (wallSelfWeightRefs.firestore.ts)। */
  wallSelfWeightRefs: WallSelfWeightRef[];
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
  wallSelfWeightRefs: [],
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
    issue: issueByElementId.get(el.elementId) ?? null,
  }));

  return { items, skippedIssues };
}

/**
 * item-এর চূড়ান্ত StructuralElement — module-scope pure function (আগে
 * hook-এর ভিতরে useCallback হিসেবে ছিল, এখানে বের করা হলো যাতে
 * fetchAndParse() ভিতর থেকেও এটা ব্যবহার করে runModelChecks()-এর জন্য
 * resolved elements বানাতে পারে, hook এর নিজস্ব state/closure এর ওপর
 * নির্ভর না করে)। category এখানে পাল্টানো হয় না — parser (mapWall())
 * ইতিমধ্যে চূড়ান্ত category বসিয়ে দিয়েছে। materialId এখানে item এর
 * বর্তমান মান (হয়তো এখনো খালি স্ট্রিং, resolve না হলে) বসায় — এটা ঠিক
 * আছে কারণ modelChecker.ts geometry-driven, materialId/sectionId ছোঁয়
 * না (নিচে fetchAndParse এর কমেন্ট দেখুন)।
 */
function resolveItem(item: ImportReviewItem): StructuralElement {
  const base = { ...item.original, materialId: item.materialId } as StructuralElement;
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
      // check resolved elements এর ওপর। materialId/sectionId এখনো
      // unresolved (খালি স্ট্রিং) থাকতে পারে — modelChecker.ts এই দুটো
      // ফিল্ড ছোঁয় না (pure geometry check), তাই material/section resolve
      // হওয়ার আগেই নিরাপদে চালানো যায়। এভাবে ইঞ্জিনিয়ার material/section
      // পূরণ করার আগেই geometry সমস্যা (floating wall, duplicate element,
      // zero-length beam, no base support) সম্পর্কে জানতে পারবেন — শুধু
      // Validation Panel ম্যানুয়ালি খুললে তবে জানা যেত এমন না। সব item
      // এখন import হবে (আর কোনো wall-only include/exclude gate নেই),
      // তাই পুরো items[] সরাসরি check-এ যায়।
      const resolvedForCheck = items.map(resolveItem);
      const modelCheckReport = buildValidationReport(runModelChecks(resolvedForCheck));

      setState({
        status: "ready",
        errorMessage: null,
        items,
        grids: result.grids,
        stories: result.stories,
        skippedIssues,
        wallSelfWeightRefs: result.wallSelfWeightRefs,
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

  /**
   * Bulk/group material assignment — নতুন সংযোজন (ইঞ্জিনিয়ারের অনুরোধে)।
   * যেহেতু Hub import সবসময় একটা preliminary/প্রাথমিক ধাপ (সব Wall
   * একই material, সব Column একই section+material, সব Beam/Slab/Stairs
   * নিজ নিজ একই সিলেকশন দিয়ে শুরু করে পরে ইঞ্জিনিয়ার আলাদা আলাদা করে
   * override করবেন — প্রতিটা element এক এক করে বেছে দেওয়া অপ্রয়োজনীয়
   * সময়ক্ষেপণ), এই ফাংশন একটা category-র (original.category — panel-এর
   * groupedItems ঠিক এই একই key ব্যবহার করে, নিচে
   * ArchitecturalImportPanel.tsx দেখুন) সব item-এ এক লহমায়
   * একই materialId বসিয়ে দেয়। পরে ইঞ্জিনিয়ার চাইলে setItemMaterial()
   * দিয়ে যেকোনো একটা item আলাদাভাবে বদলাতে পারবেন — bulk assignment তার
   * পথ আটকায় না, শুধু starting point দ্রুত করে।
   */
  const setGroupMaterial = useCallback((category: string, materialId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.original.category === category ? { ...it, materialId } : it
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
        it.original.category === category && it.sectionId !== null
          ? { ...it, sectionId }
          : it
      ),
    }));
  }, []);

  /**
   * প্রতিটা item-এ materialId (সব category) এবং sectionId (শুধু line
   * category — beam/column/brace/pile) পূরণ করা আছে কিনা — সব item এখন
   * import হবে (আর কোনো category-ভিত্তিক gate নেই), তাই সরাসরি
   * state.items.every() ব্যবহার হয়।
   */
  const materialsSectionsResolved = state.items
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
   * চূড়ান্ত save-এ যাওয়া elements — সব item resolveItem() দিয়ে
   * material/section প্রয়োগ করে রিটার্ন হয় (category আর এখানে পাল্টায়
   * না, parser-এই চূড়ান্ত হয়ে গেছে)।
   */
  const resolvedElements = useCallback((): StructuralElement[] => {
    return state.items.map(resolveItem);
  }, [state.items]);

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
    setGroupMaterial,
    setGroupSection,
    buildMergedGeometry,
    resolvedElements,
    reset,
  };
}
