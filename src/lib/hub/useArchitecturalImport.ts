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
 *   - re-import নিরাপদ: elementId Draw-এর BuildingElementRef.id থেকে
 *     সরাসরি আসে (parser অপরিবর্তিত রাখে), তাই একই element আবার import
 *     করলে saveElement() (setDoc) ওভাররাইট করবে, ডুপ্লিকেট হবে না।
 *     Grid/Story একইভাবে upsertGrid/upsertStory দিয়ে merge হয় (id
 *     মিললে replace, নাহলে নতুন যোগ)।
 */

import { useCallback, useState } from "react";
import {
  fetchLatestArchitecturalExport,
  parseArchitecturalExport,
  type ParseGeometryResult,
  type ParsedElementIssue,
} from "./hub-geometry-parser";
import type { StructuralElement } from "@/lib/types/element";
import type { StructuralGrid, StructuralStory, GeometryCore } from "@/lib/types/geometry";
import { upsertGrid, upsertStory } from "@/lib/geometry/firestore";

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
    issue: issueByElementId.get(el.elementId) ?? null,
  }));

  return { items, skippedIssues };
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

      setState({
        status: "ready",
        errorMessage: null,
        items,
        grids: result.grids,
        stories: result.stories,
        skippedIssues,
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
   * প্রতিটা item-এ materialId (সব category) এবং sectionId (শুধু line
   * category — beam/column/brace/pile) পূরণ করা আছে কিনা। যতক্ষণ কোনো
   * একটা item অসম্পূর্ণ, ততক্ষণ confirmImport() কল করা উচিত না (UI-তে
   * বাটন disabled রাখা হবে এই ফ্ল্যাগ দিয়ে) — parser-এর "কখনো ভুল-
   * দেখতে ID বসিয়ে দেওয়া হবে না" নীতির সরাসরি বাস্তবায়ন।
   */
  const allResolved = state.items.every(
    (it) => it.materialId.trim() !== "" && (it.sectionId === null || it.sectionId.trim() !== "")
  );

  /**
   * চূড়ান্ত StructuralElement তৈরি করে (override প্রয়োগ করে) — confirm
   * করার সময়, এবং UI-তে preview দেখানোর সময়ও ব্যবহারযোগ্য (pure ফাংশন,
   * কোনো state mutate করে না)।
   */
  const resolveItem = useCallback((item: ImportReviewItem): StructuralElement => {
    const category = item.categoryOverride ?? item.original.category;
    const base = { ...item.original, category, materialId: item.materialId } as StructuralElement;
    if (item.sectionId !== null && "sectionId" in base) {
      return { ...base, sectionId: item.sectionId } as StructuralElement;
    }
    return base;
  }, []);

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

  const resolvedElements = useCallback((): StructuralElement[] => {
    return state.items.map(resolveItem);
  }, [state.items, resolveItem]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return {
    state,
    allResolved,
    fetchAndParse,
    setItemMaterial,
    setItemSection,
    setItemCategoryOverride,
    buildMergedGeometry,
    resolvedElements,
    reset,
  };
}
