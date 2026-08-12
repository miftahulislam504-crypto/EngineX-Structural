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
 * একটা moduleData document subscribe করার জেনেরিক hook (CPMS এর
 * useModuleData() এর সাথে মূল আচরণ same — mount এ subscribe, unmount এ
 * unsubscribe)। react-hooks/set-state-in-effect (এই repo এর eslint
 * config এ enforced, CPMS এ নাও থাকতে পারে) মেনে চলতে effect body এর
 * শুরুতে unconditional setState() নেই — projectId/moduleId পাল্টালে
 * বা unmount হলে reset cleanup function এ হয় (নিচে দেখুন, cleanup এ
 * setState() করা এই lint rule এ অনুমোদিত)।
 */
function useModuleData<T>(
  projectId: string | null | undefined,
  moduleId: "siteInfo" | "bnbcSettings" | "buildingInfo" | "architectural"
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

export const useHubSiteInfo = (projectId: string | null | undefined) =>
  useModuleData<HubSiteInfoData>(projectId, "siteInfo");

export const useHubBnbcSettings = (projectId: string | null | undefined) =>
  useModuleData<HubBnbcSettingsData>(projectId, "bnbcSettings");

export const useHubBuildingInfo = (projectId: string | null | undefined) =>
  useModuleData<HubBuildingInfoData>(projectId, "buildingInfo");

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
