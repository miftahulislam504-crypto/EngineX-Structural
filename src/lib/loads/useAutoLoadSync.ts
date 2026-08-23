"use client";

/**
 * useAutoLoadSync.ts — real-time load auto-generation, ETABS-এর মতো।
 * ------------------------------------------------------------------
 * Miftahul এর অনুরোধ: "সব লোড আগে automatic define থাকবে ... এবং
 * load define থাকলে তো automatic model এর সব elements এ বসে যাবে সব
 * load etabs এর মতো" এবং "যখনই কোনো element/section যোগ হবে, তখনই
 * সাথে সাথে (real-time sync)"।
 *
 * এই hook Elements/Materials/Sections/Geometry/Hub(bnbcSettings,
 * siteInfo) — এই ছয়টার যেকোনো একটা বদলালেই স্বয়ংক্রিয়ভাবে re-derive
 * করে:
 *   1. Self-weight (Dead pattern) — সব Beam/Column এ (deriveSelfWeightLoads.ts)
 *   2. Occupancy Live Load — সব Slab এ (deriveLiveLoadCases.ts)
 *   3. Wind X/Y pattern + story-force column distribution (deriveWindLoad.ts + distributeStoryForceToColumns.ts)
 *   4. Seismic X/Y pattern + story-force column distribution (deriveSeismicLoad.ts + distributeStoryForceToColumns.ts)
 *
 * নিরাপত্তা নীতি (autoReanalysisLoop.ts এর প্রতিষ্ঠিত নীতির সাথে
 * সামঞ্জস্যপূর্ণ, Miftahul এর সাথে Step 3 শুরুর আগে কনফার্ম করা):
 *   - এই hook শুধু LoadCase/LoadPattern write করে ("derive + write")।
 *     কোনো backend analysis/solve job auto-trigger করে না — সেটা
 *     এখনো ম্যানুয়াল বাটনে (Analysis panel), stale হলে banner
 *     দেখাবে (Step 4)।
 *   - শুধু source: "auto" ট্যাগের LoadCase touch করা হয় — ইঞ্জিনিয়ার
 *     ElementLoadPanel দিয়ে নিজে হাতে বসানো ("manual" বা untagged)
 *     কোনো LoadCase কখনো এই hook দ্বারা মুছে/বদলে যায় না।
 *   - Diff-based update: প্রতিবার sync-এ পুরো auto-case সেট delete-then-
 *     recreate করা হয় না — আগের auto-case এর সাথে নতুন derive
 *     ফলাফলের elementId+patternId+applicationType মিলিয়ে শুধু
 *     changed মান গুলোই update হয়, নতুন elementId এর জন্য create হয়,
 *     আর মুছে ফেলা element এর জন্য delete হয়। এটা Firestore write
 *     সংখ্যা কমায় এবং listener-triggered infinite-loop এর ঝুঁকি কমায়
 *     (unnecessary write → snapshot update → re-render → re-derive
 *     চক্র প্রতিরোধ করতে মান অপরিবর্তিত থাকলে write skip করা হয়)।
 *   - Debounce (800ms) — dependency store গুলো একসাথে কয়েকবার আপডেট
 *     হতে পারে (যেমন element তৈরির সাথে সাথে auto-section-create ও
 *     library আপডেট), প্রতিটার জন্য আলাদা sync চালানো অপচয়।
 */

import { useEffect, useRef } from "react";
import { useElementsStore } from "@/lib/elements/useElementsStore";
import { useLibraryStore } from "@/lib/library/useLibraryStore";
import { useGeometryStore } from "@/lib/geometry/useGeometryStore";
import { useLoadStore } from "@/lib/loads/useLoadStore";
import { useAutoLoadSyncStatusStore } from "@/lib/loads/useAutoLoadSyncStatusStore";
import { useHubBnbcSettings, useHubSiteInfo } from "@/lib/hub/useHubModuleSubscriptions";
import { saveLoadCase, deleteLoadCase, upsertLoadPattern, saveLoadPatternLibrary } from "@/lib/loads/firestore";
import type { LoadCase, LoadPattern } from "@/lib/types/load";
import { deriveSelfWeightLoads } from "@/lib/derive/deriveSelfWeightLoads";
import { deriveLiveLoadCases } from "@/lib/derive/deriveLiveLoadCases";
import { deriveWindLoad } from "@/lib/derive/deriveWindLoad";
import { deriveSeismicLoad } from "@/lib/derive/deriveSeismicLoad";
import { autoGenerateWindSeismicPatterns } from "@/lib/derive/autoGenerateWindSeismicPatterns";
import { distributeWindStoryForces, distributeSeismicStoryForces } from "@/lib/derive/distributeStoryForceToColumns";

const DEAD_PATTERN_ID = "pattern-default-dead";
const LIVE_PATTERN_ID = "pattern-default-live";
const DEBOUNCE_MS = 800;

export interface AutoLoadSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  warnings: string[];
}

/**
 * দুইটা auto-LoadCase array এর মধ্যে diff করে কী create/update/delete
 * করতে হবে বের করে। "একই case" চেনার key: patternId+elementId+
 * applicationType (একটা element-এ একটা pattern-এর একটাই auto-case
 * থাকবে ধরে নেওয়া হয়েছে — deriveSelfWeightLoads/deriveLiveLoadCases/
 * distributeStoryForceToColumns প্রতিটা element-এ সর্বোচ্চ একটাই case
 * তৈরি করে)। মান অপরিবর্তিত থাকলে (JSON deep-equal, loadCaseId/
 * createdAt/updatedAt বাদে) update এড়িয়ে যাওয়া হয় — অপ্রয়োজনীয় write
 * ও listener-loop প্রতিরোধ করতে।
 */
function diffAutoLoadCases(
  previousAuto: LoadCase[],
  nextAuto: LoadCase[]
): { toSave: LoadCase[]; toDelete: string[] } {
  function key(c: LoadCase): string {
    return `${c.patternId}::${c.elementId}::${c.applicationType}`;
  }
  function valueSignature(c: LoadCase): string {
    // loadCaseId/createdAt/updatedAt বাদে বাকি সব field দিয়ে সিগনেচার — এই তিনটা প্রতিবার regenerate হওয়ায় বাদ না দিলে সবসময় "বদলেছে" বলে ভুল detect হতো।
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loadCaseId, createdAt, updatedAt, ...rest } = c;
    return JSON.stringify(rest);
  }

  const prevByKey = new Map(previousAuto.map((c) => [key(c), c]));
  const nextByKey = new Map(nextAuto.map((c) => [key(c), c]));

  const toSave: LoadCase[] = [];
  const toDelete: string[] = [];

  for (const [k, nextCase] of nextByKey) {
    const prevCase = prevByKey.get(k);
    if (!prevCase) {
      toSave.push(nextCase); // নতুন element/pattern কম্বিনেশন
    } else if (valueSignature(prevCase) !== valueSignature(nextCase)) {
      toSave.push({ ...nextCase, loadCaseId: prevCase.loadCaseId }); // পুরোনো loadCaseId ধরে রেখে শুধু value আপডেট — নতুন doc তৈরি না করে existing overwrite
    }
    // মান অপরিবর্তিত হলে কিছুই করা হয় না (write skip)
  }

  for (const [k, prevCase] of prevByKey) {
    if (!nextByKey.has(k)) {
      toDelete.push(prevCase.loadCaseId); // element/pattern মুছে গেছে অথবা derive শর্ত আর পূরণ হচ্ছে না
    }
  }

  return { toSave, toDelete };
}

/**
 * project-এ real-time load auto-sync চালু করে। কোনো JSX রিটার্ন করে
 * না, শুধু side-effect (Firestore write) — layout.tsx এর মতো কোনো
 * top-level client component-এ একবার mount করলেই যথেষ্ট (elements/
 * library/geometry/loads store গুলো global Zustand store, page
 * navigation করলেও persist থাকে)।
 */
export function useAutoLoadSync(projectId: string): AutoLoadSyncStatus {
  const elements = useElementsStore((s) => s.elements);
  const elementsLoading = useElementsStore((s) => s.isLoading);

  const materialLibrary = useLibraryStore((s) => s.materialLibrary);
  const sectionLibrary = useLibraryStore((s) => s.sectionLibrary);
  const libraryLoading = useLibraryStore((s) => s.isLoading);

  const geometry = useGeometryStore((s) => s.geometry);
  const geometryLoading = useGeometryStore((s) => s.isLoading);

  const loadCases = useLoadStore((s) => s.loadCases);
  const patternLibrary = useLoadStore((s) => s.patternLibrary);
  const loadsLoading = useLoadStore((s) => s.isLoading);

  const hubBnbc = useHubBnbcSettings(projectId);
  const hubSiteInfo = useHubSiteInfo(projectId);

  const setGlobalStatus = useAutoLoadSyncStatusStore((s) => s.setStatus);
  const currentIsSyncing = useAutoLoadSyncStatusStore((s) => s.isSyncing);
  const currentLastSyncedAt = useAutoLoadSyncStatusStore((s) => s.lastSyncedAt);
  const currentWarnings = useAutoLoadSyncStatusStore((s) => s.warnings);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  // নোট (self-triggered extra cycle, ইচ্ছাকৃত trade-off): loadCases
  // dependency-তে থাকায়, একটা write সফল হলে subscribeToLoadCases
  // listener নতুন loadCases পাঠায় → effect আবার run হয় → আরেকটা
  // debounced runSync() চলে। এটা infinite loop না — diffAutoLoadCases
  // এর valueSignature তুলনা মান-অপরিবর্তিত case গুলোকে skip করে, তাই
  // এই দ্বিতীয় sync এ toSave/toDelete খালি থাকবে (কোনো নতুন write
  // হবে না, চক্র সেখানেই থেমে যায়)। একটা বাড়তি no-op read-derive
  // cycle-এর খরচে diff-based change-detection-এর সরলতা বজায় রাখা
  // হলো — অন্যথায় "কে এই write করেছে" ট্র্যাক করতে আলাদা origin-tagging
  // দরকার হতো, যা এই phase এর জন্য অতিরিক্ত জটিলতা।
  useEffect(() => {
    // সব dependency store লোড না হওয়া পর্যন্ত অপেক্ষা — অসম্পূর্ণ ডেটা
    // দিয়ে derive করলে ভুলভাবে element/case মুছে যেতে পারে (যেমন
    // elements এখনো লোড হয়নি মানে "কোনো element নেই" না)।
    if (elementsLoading || libraryLoading || geometryLoading || loadsLoading) {
      return;
    }
    if (hubBnbc.status === "loading" || hubSiteInfo.status === "loading") {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void runSync();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };

    async function runSync() {
      const thisRunId = ++runIdRef.current;
      setGlobalStatus({ isSyncing: true, lastSyncedAt: currentLastSyncedAt, warnings: currentWarnings });

      const warnings: string[] = [];
      const materials = materialLibrary.materials;
      const sections = sectionLibrary.sections;

      // ---- 1. Self-weight (Dead) ----
      const selfWeightResult = deriveSelfWeightLoads(elements, materials, sections, DEAD_PATTERN_ID);
      warnings.push(...selfWeightResult.warnings);

      // ---- 2. Occupancy Live Load (Slab) ----
      const liveLoadResult = deriveLiveLoadCases(
        elements,
        LIVE_PATTERN_ID,
        hubBnbc.data ?? undefined
      );
      warnings.push(...liveLoadResult.warnings);

      // ---- 3 & 4. Wind + Seismic pattern derive ----
      const newPatterns: LoadPattern[] = [];
      let windAutoCases: LoadCase[] = [];
      let seismicAutoCases: LoadCase[] = [];

      if (hubBnbc.data) {
        const windDerived = deriveWindLoad(hubBnbc.data, geometry);
        const seismicDerived = deriveSeismicLoad(hubBnbc.data, hubSiteInfo.data, geometry, elements, materials, sections);
        const windSeismicPatterns = autoGenerateWindSeismicPatterns(windDerived, seismicDerived);
        warnings.push(...windSeismicPatterns.warnings);
        newPatterns.push(...windSeismicPatterns.patterns);

        for (const wsf of windSeismicPatterns.windStoryForces) {
          const dist = distributeWindStoryForces(wsf.forces, wsf.direction, wsf.patternId, geometry, elements, materials, sections);
          warnings.push(...dist.warnings);
          windAutoCases = windAutoCases.concat(dist.loadCases);
        }
        for (const ssf of windSeismicPatterns.seismicStoryForces) {
          const dist = distributeSeismicStoryForces(ssf.forces, ssf.direction, ssf.patternId, geometry, elements, materials, sections);
          warnings.push(...dist.warnings);
          seismicAutoCases = seismicAutoCases.concat(dist.loadCases);
        }
      } else {
        warnings.push("Hub bnbc_settings পাওয়া যায়নি — Wind/Seismic pattern auto-generate করা যায়নি।");
      }

      // ---- Pattern library sync (fixed-id upsert, Dead/Live এর সাথে conflict করবে না কারণ আলাদা id) ----
      if (newPatterns.length > 0) {
        let nextLibrary = patternLibrary;
        let patternsChanged = false;
        for (const p of newPatterns) {
          const existing = nextLibrary.patterns.find((existingP) => existingP.patternId === p.patternId);
          // শুধু category/name বদলালে update — createdAt/updatedAt বাদ দিয়ে তুলনা, প্রতিবার নতুন timestamp এ false-positive change এড়াতে
          if (!existing || existing.category !== p.category || existing.name !== p.name) {
            nextLibrary = upsertLoadPattern(nextLibrary, existing ? { ...p, createdAt: existing.createdAt } : p);
            patternsChanged = true;
          }
        }
        if (patternsChanged) {
          await saveLoadPatternLibrary(projectId, { patterns: nextLibrary.patterns });
        }
      }

      // ---- LoadCase diff + write ----
      const nextAutoCases = [
        ...selfWeightResult.loadCases,
        ...liveLoadResult.loadCases,
        ...windAutoCases,
        ...seismicAutoCases,
      ];
      const previousAutoCases = loadCases.filter((c) => c.source === "auto");
      const { toSave, toDelete } = diffAutoLoadCases(previousAutoCases, nextAutoCases);

      // race condition guard: sync চলাকালীন নতুন dependency change এসে
      // আরেকটা runSync শুরু হলে, পুরোনো (stale) run এর write skip করা
      // হয় — নাহলে দুইটা concurrent run এর write একে অপরকে ওভাররাইট
      // করে ভুল ফলাফল রেখে যেতে পারত।
      if (thisRunId !== runIdRef.current) return;

      try {
        await Promise.all([
          ...toSave.map((c) => saveLoadCase(projectId, c)),
          ...toDelete.map((id) => deleteLoadCase(projectId, id)),
        ]);
      } catch (err) {
        warnings.push(`Auto load sync এ write ব্যর্থ হয়েছে: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (thisRunId === runIdRef.current) {
        setGlobalStatus({ isSyncing: false, lastSyncedAt: new Date().toISOString(), warnings });
      }
    }
    // currentLastSyncedAt/currentWarnings/setGlobalStatus ইচ্ছাকৃতভাবে
    // dependency array এ নেই — এই effect নিজেই setGlobalStatus() কল
    // করে এই তিনটা আপডেট করে; dependency তে রাখলে effect নিজেই
    // নিজেকে re-trigger করত (setGlobalStatus → currentLastSyncedAt
    // বদলায় → effect আবার run হয় → আরেকটা setGlobalStatus...)।
    // deriveSiteClass.ts/useHubAnalysisSuggestions.ts এর মতোই এই
    // ফাইলেও effect শুধু "input" store (elements/materials/geometry/
    // hub) এর ওপর react করে, নিজের output status এর ওপর না।
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    elements,
    elementsLoading,
    materialLibrary,
    sectionLibrary,
    libraryLoading,
    geometry,
    geometryLoading,
    loadCases,
    patternLibrary,
    loadsLoading,
    hubBnbc.data,
    hubBnbc.status,
    hubSiteInfo.data,
    hubSiteInfo.status,
  ]);

  return { isSyncing: currentIsSyncing, lastSyncedAt: currentLastSyncedAt, warnings: currentWarnings };
}
