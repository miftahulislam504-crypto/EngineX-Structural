/**
 * Drawing Synchronization
 * Phase 10h — Detailing ইঞ্জিনের শেষ ধাপ (Detailing অংশের)।
 *
 * 10a-10g সবগুলো একটা মুহূর্তের ইনপুট (governingAsMm2, width, cover ইত্যাদি)
 * থেকে detail (rebar layout, zone, section, BBS...) জেনারেট করে। যদি
 * upstream model/design পরে বদলায় (element resize, re-run design), সেই
 * আগে-জেনারেট-করা detail stale হয়ে যায় — এটা কোনো নতুন জ্যামিতি/ফর্মুলা
 * সমস্যা না, এটা VERSIONING সমস্যা। এই ফাইল সেটা ধরার mechanism দেয়:
 * detail জেনারেট হওয়ার সময় ইনপুটগুলোর একটা fingerprint রেখে দেওয়া হয়,
 * পরে বর্তমান ইনপুটের সাথে তুলনা করে বলা যায় detail এখনো valid কিনা, আর
 * ঠিক কোন কোন ইনপুট বদলেছে।
 *
 * সীমাবদ্ধতা (v1, ইচ্ছাকৃতভাবে flagged):
 *   - এই ফাইল fingerprint বানানো আর তুলনা করার mechanism দেয়, কিন্তু
 *     record persist করার (Firestore-এ save/load) কোনো wiring নেই —
 *     সেটা আগের সিদ্ধান্ত অনুযায়ী deferred Hub-sync কাজের অংশ। v1-এ
 *     ইঞ্জিনিয়ার নিজে "generated at" snapshot vs "current" ইনপুট দিয়ে
 *     manually compare করে।
 *   - Hash cryptographic-grade না (djb2, একটা সাধারণ non-crypto string
 *     hash) — উদ্দেশ্য শুধু change-detection, security না।
 */

export type DetailingType =
  | "rebar-layout"
  | "stirrup-tie-zones"
  | "development-length"
  | "bar-bending-schedule"
  | "section-detail"
  | "connection-detail"
  | "general-notes";

export type FingerprintableValue = number | string | boolean;
export interface FingerprintedInputs {
  [key: string]: FingerprintableValue;
}

/** djb2 — সাধারণ, deterministic, non-cryptographic string hash। শুধু change-detection-এর জন্য যথেষ্ট। */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0; // >>> 0 দিয়ে unsigned 32-bit রাখা হলো
  }
  return hash.toString(16).padStart(8, "0");
}

/** ইনপুট object-কে key-sorted canonical string বানিয়ে hash করে — key-এর order যাই হোক, একই ইনপুটে একই fingerprint আসবে। */
export function computeInputFingerprint(inputs: FingerprintedInputs): string {
  const canonical = Object.keys(inputs)
    .sort()
    .map((k) => `${k}=${inputs[k]}`)
    .join("|");
  return djb2Hash(canonical);
}

export interface DetailingSyncRecord {
  detailId: string; // যেমন "beam-FB01-rebar-layout"
  detailType: DetailingType;
  inputFingerprint: string;
  inputsSnapshot: FingerprintedInputs; // পুরো snapshot রাখা হয় যাতে ঠিক কোন key বদলেছে বলা যায়, শুধু hash না
  generatedAtIso: string;
}

/** নতুন detail জেনারেট করার সময় একটা sync record বানানোর হেল্পার। */
export function createSyncRecord(detailId: string, detailType: DetailingType, inputs: FingerprintedInputs): DetailingSyncRecord {
  return {
    detailId,
    detailType,
    inputFingerprint: computeInputFingerprint(inputs),
    inputsSnapshot: { ...inputs },
    generatedAtIso: new Date().toISOString(),
  };
}

export interface SyncCheckResult {
  isStale: boolean;
  changedKeys: string[];
  currentFingerprint: string;
}

/** একটা পুরনো record-কে বর্তমান ইনপুটের সাথে তুলনা করে — stale কিনা, আর ঠিক কোন কোন ইনপুট বদলেছে। */
export function checkDetailingSyncStatus(record: DetailingSyncRecord, currentInputs: FingerprintedInputs): SyncCheckResult {
  const currentFingerprint = computeInputFingerprint(currentInputs);
  const isStale = currentFingerprint !== record.inputFingerprint;

  const changedKeys: string[] = [];
  const allKeys = new Set([...Object.keys(record.inputsSnapshot), ...Object.keys(currentInputs)]);
  for (const key of allKeys) {
    if (record.inputsSnapshot[key] !== currentInputs[key]) {
      changedKeys.push(key);
    }
  }
  changedKeys.sort();

  return { isStale, changedKeys, currentFingerprint };
}
