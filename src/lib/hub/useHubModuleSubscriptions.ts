"use client";

/**
 * useHubModuleSubscriptions.ts — Phase 7 real-time listener, React hook
 * layer।
 * ------------------------------------------------------------------
 * CPMS (EngineXProject) এর src/lib/hub/useHubModuleData.ts এর প্রমাণিত
 * pattern হুবহু অনুসরণ করা হয়েছে (mount এ subscribe, unmount এ
 * unsubscribe, status enum) — নতুন design বানানো হয়নি।
 *
 * Structural যে upstream module গুলোর উপর নির্ভর করে (siteInfo,
 * bnbcSettings, architectural — deriveSDC/deriveLiveLoad/hub-module-
 * shapes.ts এর ইনপুট) তাদের প্রতিটার জন্য একটা hook।
 *
 * ⚠️ এই hook শুধু "নতুন ডেটা এসেছে" জানায় — নিজে থেকে কোনো geometry
 * import, model mutation, বা analysis trigger করে না। hub-geometry-
 * parser.ts এর ParseGeometryResult এ ইচ্ছাকৃতভাবে UNRESOLVED_MATERIAL_ID/
 * UNRESOLVED_SECTION_ID placeholder থাকে (সেই ফাইলের হেডার কমেন্ট
 * দেখুন) — মানে parsed geometry সরাসরি live model এ auto-write করা
 * নিরাপদ না, ইঞ্জিনিয়ারের review ছাড়া। তাই "auto-trigger" শুধু
 * derivation (Phase 3, pure/read-only functions) পর্যন্ত সীমাবদ্ধ —
 * autoReanalysisLoop.ts এর হেডার কমেন্টে বিস্তারিত।
 */

import { useEffect, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import { subscribeToModuleData } from "@/lib/hub/hub-sdk-client";
import type { ModuleDataRecord } from "@/lib/hub/module-data.types";
import type { HubSiteInfoData, HubBnbcSettingsData, HubBuildingInfoData } from "@/lib/hub/hub-module-shapes";

export type HubModuleFetchStatus =
  | "loading"
  | "has_data"
  | "no_data" // module এখনো Hub এ কিছু নেই (upstream app কখনো publish করেনি)
  | "error";

export interface HubModuleResult<T> {
  status: HubModuleFetchStatus;
  data: T | null;
  version: number;
  updatedAt: string | null;
}

const LOADING: HubModuleResult<unknown> = { status: "loading", data: null, version: 0, updatedAt: null };
const NO_DATA: HubModuleResult<unknown> = { status: "no_data", data: null, version: 0, updatedAt: null };

/**
 * Hub এর siteInfo/buildingInfo/bnbcSettings document এ optional field
 * না-থাকলে `null` লেখা থাকে (Firestore এ `undefined` সরাসরি লেখা যায়
 * না বলে Hub নিজেই `?? null` ব্যবহার করে) — কিন্তু এই App এর টাইপ
 * (HubSiteInfoData ইত্যাদি) সেগুলোকে `field?: T` (মানে `T | undefined`)
 * ধরে নেয়। top-level shallow strip যথেষ্ট — এই তিনটা document flat,
 * nested object নেই (হুবহু Hub এর নিজের save function গুলোর payload
 * shape দেখুন)।
 */
function stripNullToUndefined(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = val === null ? undefined : val;
  }
  return result;
}

/**
 * moduleData document subscribe করার hook (CPMS এর useModuleData() এর
 * সাথে মূল আচরণ same — mount এ subscribe, unmount এ unsubscribe)।
 * react-hooks/set-state-in-effect (এই repo এর eslint config এ
 * enforced, CPMS এ নাও থাকতে পারে) মেনে চলতে effect body এর শুরুতে
 * unconditional setState() নেই — projectId/moduleId পাল্টালে বা
 * unmount হলে reset cleanup function এ হয় (নিচে দেখুন, cleanup এ
 * setState() করা এই lint rule এ অনুমোদিত)।
 *
 * শুধু 'architectural' এর জন্য — Draw এর saveModuleData()/
 * publishArchitecturalScheduleToEstimating() সত্যিই projects/{id}/
 * moduleData/architectural এ লেখে (module-data.firestore.ts, Draw এর
 * কোড verified), তাই এই path এখানে ঠিক আছে।
 */
function useModuleData<T>(
  projectId: string | null | undefined,
  moduleId: "architectural"
): HubModuleResult<T> {
  const [result, setResult] = useState<HubModuleResult<T>>(
    () => (projectId ? (LOADING as HubModuleResult<T>) : (NO_DATA as HubModuleResult<T>))
  );

  useEffect(() => {
    if (!projectId) return; // lazy initial state (উপরে) ইতিমধ্যেই NO_DATA ধরে নেয় যখন projectId absent

    const unsubscribe = subscribeToModuleData(projectId, moduleId, (record: ModuleDataRecord | null) => {
      if (!record) {
        setResult(NO_DATA as HubModuleResult<T>);
        return;
      }
      setResult({ status: "has_data", data: record.data as T, version: record.version, updatedAt: record.updatedAt });
    });

    // cleanup function এ setState() করা react-hooks/set-state-in-effect
    // এ অনুমোদিত (শুধু effect body-এর synchronous top-level call নিষিদ্ধ)
    // — এটা ব্যবহার করে projectId/moduleId পাল্টানো (বা component
    // unmount) হলে আগের module এর stale has_data/loading state না
    // রেখে NO_DATA এ রিসেট করা হচ্ছে, পরের effect run শুরু হওয়ার আগেই।
    // এর ফলে projectId/moduleId পরিবর্তনের সময় সংক্ষিপ্তভাবে NO_DATA
    // দেখাতে পারে নতুন subscription এর প্রথম snapshot না আসা পর্যন্ত —
    // এটা গ্রহণযোগ্য ট্রেড-অফ (স্বাভাবিক loading flash), stale data
    // দেখানোর চেয়ে নিরাপদ।
    return () => {
      unsubscribe();
      setResult(NO_DATA as HubModuleResult<T>);
    };
  }, [projectId, moduleId]);

  return result;
}

/**
 * siteInfo/bnbcSettings/buildingInfo এর জন্য — Hub এর নিজস্ব document,
 * moduleData mechanism দিয়ে আসে না (এই ফাইলের আগের বাগ ঠিক এখানেই
 * ছিল: subscribeToModuleData('siteInfo') projects/{id}/moduleData/
 * siteInfo শুনতো, যেখানে Hub কখনো লেখে না — সবসময় NO_DATA থাকতো)।
 *
 * দুইটা আলাদা listener লাগে কারণ ডেটা আর version আলাদা document এ:
 *   - ডেটা: projects/{id}/site_information/data (ইত্যাদি) — Hub এর
 *     site-info.firestore.ts সরাসরি এখানে লেখে, কোনো version field
 *     এর ভেতরে নেই।
 *   - version: projects/{id}/versions/{moduleId} — Hub এর
 *     saveSiteInfo()/saveBuildingInfo()/saveBnbcSettings() প্রতিটাই
 *     সেভ করার পর bumpModuleVersion() কল করে এখানে version bump করে
 *     (site-info.firestore.ts এ verified)। checkAndReanalyze() এর
 *     dependency-status check এই একই versions/{moduleId} path পড়ে
 *     (dependencyTracking.ts, hub-sdk-client.ts এর getModuleVersion),
 *     তাই এই hook এর version নম্বর সেই check এর সাথে সবসময় sync থাকে।
 */
function useHubNativeDoc<T>(
  projectId: string | null | undefined,
  moduleId: "siteInfo" | "bnbcSettings" | "buildingInfo",
  dataPathFn: (projectId: string) => string
): HubModuleResult<T> {
  const [result, setResult] = useState<HubModuleResult<T>>(
    () => (projectId ? (LOADING as HubModuleResult<T>) : (NO_DATA as HubModuleResult<T>))
  );

  useEffect(() => {
    if (!projectId) return;

    // ডেটা ও version দুটো আলাদা document, দুটো আলাদা snapshot আসতে
    // পারে যেকোনো ক্রমে — তাই দুটো listener এর সর্বশেষ মান একসাথে
    // combine করে setResult() কল করা হয় (একটার callback আরেকটার
    // সর্বশেষ মান রেফারেন্স করে যাতে কোনোটা হারিয়ে না যায়)।
    let latestData: T | null = null;
    let latestVersion = 0;
    let latestUpdatedAt: string | null = null;
    let dataLoaded = false;

    const emit = () => {
      if (!dataLoaded) return; // version snapshot data এর আগে এলেও data না আসা পর্যন্ত LOADING দেখাও
      if (latestData === null) {
        setResult(NO_DATA as HubModuleResult<T>);
        return;
      }
      setResult({ status: "has_data", data: latestData, version: latestVersion, updatedAt: latestUpdatedAt });
    };

    const unsubData = onSnapshot(
      doc(db(), dataPathFn(projectId)),
      (snap) => {
        dataLoaded = true;
        // Hub এর saveSiteInfo()/saveBuildingInfo()/saveBnbcSettings()
        // optional field না-থাকলে `null` লেখে (`data.latitude ?? null`
        // প্যাটার্ন, site-info.firestore.ts এ verified), raw `undefined`
        // না। এই App এর HubSiteInfoData/HubBuildingInfoData/
        // HubBnbcSettingsData টাইপ optional field গুলোকে `T | undefined`
        // ধরে নেয় (`?:` সিনট্যাক্স), `T | null` না — তাই সরাসরি cast না
        // করে `null` কে `undefined` এ normalize করা হচ্ছে (Draw এর
        // hub-read.ts এর `?? undefined` এর একই কারণ)।
        latestData = snap.exists() ? (stripNullToUndefined(snap.data()) as T) : null;
        emit();
      },
      () => {
        dataLoaded = true;
        latestData = null;
        setResult(NO_DATA as HubModuleResult<T>); // permission/network error — খালি দেখায়, ভাঙে না
      }
    );

    const unsubVersion = onSnapshot(
      doc(db(), firestorePaths.hubModuleVersion(projectId, moduleId)),
      (snap) => {
        const d = snap.data();
        latestVersion = (d?.currentVersion as number) ?? 0;
        latestUpdatedAt = d?.updatedAt instanceof Timestamp ? d.updatedAt.toDate().toISOString() : null;
        emit();
      },
      () => {
        /* non-critical — version না পেলেও ডেটা দেখানো যায়, শুধু staleness-check কাজ করবে না */
      }
    );

    return () => {
      unsubData();
      unsubVersion();
      setResult(NO_DATA as HubModuleResult<T>);
    };
  }, [projectId, moduleId, dataPathFn]);

  return result;
}

export const useHubSiteInfo = (projectId: string | null | undefined) =>
  useHubNativeDoc<HubSiteInfoData>(projectId, "siteInfo", firestorePaths.hubSiteInfo);

export const useHubBnbcSettings = (projectId: string | null | undefined) =>
  useHubNativeDoc<HubBnbcSettingsData>(projectId, "bnbcSettings", firestorePaths.hubBnbcSettings);

export const useHubBuildingInfo = (projectId: string | null | undefined) =>
  useHubNativeDoc<HubBuildingInfoData>(projectId, "buildingInfo", firestorePaths.hubBuildingInfo);

/**
 * architectural module এর raw data type hub-module-shapes.ts এ এখনো
 * সংজ্ঞায়িত না (hub-geometry-parser.ts সরাসরি Draw এর export shape
 * পার্স করে, HubArchitecturalData নামে কোনো টাইপ নেই) — তাই এখানে
 * unknown রাখা হলো, geometry import এর জন্য এই hook ব্যবহার না করে
 * সরাসরি fetchAndParseArchitecturalModel() ব্যবহার করা উচিত। এই hook
 * শুধু "নতুন architectural ভার্সন এসেছে" জানার জন্য (staleness
 * signal), raw data পড়ার জন্য না।
 */
export const useHubArchitecturalVersion = (projectId: string | null | undefined) =>
  useModuleData<unknown>(projectId, "architectural");
