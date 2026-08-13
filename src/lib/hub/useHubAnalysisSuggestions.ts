"use client";

/**
 * useHubAnalysisSuggestions.ts — Phase 5 ও Phase 7 wiring layer।
 * ------------------------------------------------------------------
 * এই সেশনের আগে Phase 5 (deriveSupportOverrideSuggestion) ও Phase 7
 * (checkAndReanalyze, useHubBnbcSettings ইত্যাদি) — দুটোই কোড হিসেবে
 * সম্পূর্ণ কিন্তু কোনো UI component/hook থেকে কখনো কল হতো না (grep
 * করে যাচাই করা হয়েছিল — কোনো caller ছিল না)। এই ফাইল সেই gap পূরণ
 * করে, একটাই React hook-এ সব ধাপ একত্র করে যাতে AnalysisPanel.tsx-এর
 * মতো একটা consuming component-এর নিজে dependency-linking/derivation
 * orchestration জানার দরকার না পড়ে।
 *
 * ⚠️ ensureDependenciesLinked() না, ensureDependenciesLinkedIfMissing()
 * ব্যবহার করা হয়েছে (dependencyTracking.ts-এর হেডার কমেন্ট দেখুন) —
 * mount-এ automatic version-bump OUTDATED status-কে silently CURRENT
 * করে দিত, ইঞ্জিনিয়ার কখনো ব্যানার দেখার সুযোগ পেতেন না।
 *
 * প্রবাহ (mount-এ):
 *   1. ensureDependenciesLinkedIfMissing() — link একেবারেই না থাকলে
 *      তৈরি করে (প্রথমবার open করলে), stale link touch করে না।
 *   2. useHubSiteInfo/useHubBnbcSettings subscribe (real-time)।
 *   3. hub data বদলালেই checkAndReanalyze() আবার চলে (নিচের effect)।
 *   4. hub data থেকে suggested seismicZone/siteClass বের করা হয়
 *      (AnalysisPanel-এর dropdown state-এর সাথে সরাসরি টাইপ-সামঞ্জস্যপূর্ণ) —
 *      ইঞ্জিনিয়ার চাইলে "প্রয়োগ করুন" চাপবেন, এখানে কখনো silently
 *      dropdown state ওভাররাইট করা হয় না।
 *
 * link-version "acknowledge" (OUTDATED status ক্লিয়ার করা) এই hook-এ
 * এখনো নেই — সেটা ইচ্ছাকৃত, dependencyTracking.ts-এর কমেন্টে ব্যাখ্যা
 * করা আছে (কোনো "consume সম্পন্ন" মুহূর্ত নেই এই derivation-only flow-এ,
 * তাই কখন bump করা "সঠিক" তা স্পষ্ট না — future session-এর সিদ্ধান্ত,
 * আপাতত ব্যানার persistent থাকবে যতক্ষণ upstream আবার না বদলায়, এটাই
 * নিরাপদ ডিফল্ট, ভুলভাবে খুব তাড়াতাড়ি ক্লিয়ার হওয়ার চেয়ে)।
 */

import { useEffect, useState } from "react";
import { useHubSiteInfo, useHubBnbcSettings } from "@/lib/hub/useHubModuleSubscriptions";
import { ensureDependenciesLinkedIfMissing } from "@/lib/hub/dependencyTracking";
import { checkAndReanalyze, type AutoReanalysisCheckResult } from "@/lib/hub/autoReanalysisLoop";
import { deriveSiteClass } from "@/lib/derive/deriveSiteClass";
import type { HubSiteInfoData, HubBnbcSettingsData } from "@/lib/hub/hub-module-shapes";
import type { SeismicZone, SiteClass } from "@/lib/loads/seismicLoad";

export interface HubDerivedAnalysisSuggestion {
  seismicZone: SeismicZone;
  siteClass: SiteClass;
  siteClassConfidence: "confirmed" | "approximate";
  siteClassNote: string;
}

export interface UseHubAnalysisSuggestionsResult {
  /** true হলে UI-তে "Hub-এর ডেটা বদলেছে, re-derive প্রয়োজন" ব্যানার দেখানো উচিত। */
  needsReanalysis: boolean;
  outdatedModules: string[];
  /** dropdown-এ সরাসরি বসানো যায় এমন suggestion — hub data অনুপস্থিত/অসম্পূর্ণ হলে null। */
  suggestion: HubDerivedAnalysisSuggestion | null;
  warnings: string[];
  /** hub-linking/derivation নিজে ব্যর্থ হলে (dependency link তৈরিতে network error ইত্যাদি) — dropdown ম্যানুয়াল state এ কোনো প্রভাব পড়বে না, শুধু suggestion না দেখানো হবে। */
  linkingError: string | null;
}

function toSuggestion(
  hubBnbcSettings: HubBnbcSettingsData,
  hubSiteInfo: HubSiteInfoData | null,
): HubDerivedAnalysisSuggestion {
  // seismicZone: hubBnbcSettings.seismicZone সরাসরি "Z1".."Z4", কিন্তু
  // AnalysisPanel-এর SeismicZone টাইপ "1".."4" — autoReanalysisLoop.ts-এর
  // একই .replace("Z", "") কনভেনশন এখানেও অনুসরণ করা হলো।
  const seismicZone = hubBnbcSettings.seismicZone.replace("Z", "") as SeismicZone;

  // siteClass: siteInfo থাকলে সেটা থেকে (বেশি নির্দিষ্ট — vs-ভিত্তিক
  // soilType), না থাকলে bnbcSettings.soilType থেকে — ঠিক
  // checkAndReanalyze()-এর একই fallback যুক্তি (autoReanalysisLoop.ts
  // দেখুন), যাতে দুই জায়গায় দুই রকম siteClass suggest না হয়।
  const siteClassResult = hubSiteInfo
    ? deriveSiteClass(hubSiteInfo.soilType)
    : deriveSiteClass(hubBnbcSettings.soilType);

  return {
    seismicZone,
    siteClass: siteClassResult.siteClass,
    siteClassConfidence: siteClassResult.confidence,
    siteClassNote: siteClassResult.note,
  };
}

export function useHubAnalysisSuggestions(projectId: string | null | undefined): UseHubAnalysisSuggestionsResult {
  const siteInfoResult = useHubSiteInfo(projectId);
  const bnbcResult = useHubBnbcSettings(projectId);

  const [reanalysisCheck, setReanalysisCheck] = useState<AutoReanalysisCheckResult | null>(null);
  const [linkingError, setLinkingError] = useState<string | null>(null);

  // dependency link — প্রতি mount এ একবার (upstreamMissing হলেই তৈরি
  // করবে, stale link touch করবে না)। projectId পাল্টালে আবার চলবে।
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    ensureDependenciesLinkedIfMissing(projectId).catch((e) => {
      if (!cancelled) {
        setLinkingError(e instanceof Error ? e.message : "Hub dependency link তৈরি করা যায়নি।");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // re-derive check — bnbcResult.version/siteInfoResult.version বদলালেই
  // (নতুন Hub data এসেছে) আবার চলে। checkAndReanalyze() নিজেই
  // getStructuralDependencyStatuses() দিয়ে Firestore থেকে dependency
  // পড়ে (উপরের link-effect এর ওপর নির্ভরশীল — link তৈরি না হলে এই
  // ফাংশন কখনো OUTDATED পাবে না, তাই দুটো effect ই দরকার, একটা যথেষ্ট না)।
  useEffect(() => {
    if (!projectId) {
      setReanalysisCheck(null);
      return;
    }
    let cancelled = false;

    const hubBnbcData = bnbcResult.data;
    const hubSiteData = siteInfoResult.data;

    checkAndReanalyze(projectId, hubBnbcData, hubSiteData)
      .then((result) => {
        if (!cancelled) setReanalysisCheck(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setLinkingError(e instanceof Error ? e.message : "Re-analysis check ব্যর্থ হয়েছে।");
        }
      });

    return () => {
      cancelled = true;
    };
    // bnbcResult.version/siteInfoResult.version dependency হিসেবে ব্যবহার
    // করা হয়েছে (পুরো object না) — has_data থেকে no_data-তে সংক্ষিপ্তভাবে
    // flicker করলে (subscription reconnect ইত্যাদি) অপ্রয়োজনীয় re-check
    // এড়াতে; version নম্বর সত্যিকারের নতুন ডেটা এলেই বদলায়।
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, bnbcResult.version, siteInfoResult.version]);

  // bnbcResult.status/siteInfoResult.status-এর ওপর discriminated-union
  // narrowing কাজ করে না (HubModuleResult<T> generic — status literal
  // ও data: T | null generic-এর মধ্যে TS narrowing link করতে পারে না),
  // তাই সরাসরি .data-এর null-check ব্যবহার করা হলো (status ও data সবসময়
  // sync — useHubModuleSubscriptions.ts-এর setResult() কল দেখুন, has_data
  // ছাড়া data কখনো non-null সেট হয় না)।
  const suggestion = bnbcResult.data ? toSuggestion(bnbcResult.data, siteInfoResult.data) : null;

  return {
    needsReanalysis: reanalysisCheck?.needsReanalysis ?? false,
    outdatedModules: reanalysisCheck?.outdatedModules ?? [],
    suggestion,
    warnings: reanalysisCheck?.warnings ?? [],
    linkingError,
  };
}
