"use client";

// src/lib/hub/hub-sdk-client.ts
//
// This app's counterpart to Hub's lib/hub-sdk.ts, following the exact
// same pattern EngineXEstimate (lib/integration/hub-sdk-client.ts) and
// EngineXProject/CPMS (src/lib/hub/hub-sdk-client.ts) each independently
// built: re-implement Hub's own code rather than import it directly
// (this app is a separate deployment), because most of Hub's SDK
// (setApprovalStatus, downgradeToOutdatedIfApproved, etc.) is Hub's own
// admin/UI workflow — this app only needs consumer-side reads (upstream
// modules: architectural today, estimating/projectmgmt later) plus the
// ability to bump its own version, link its own dependencies, emit its
// own events, and publish its own module data.
//
// ⚠️ Paths below are matched character-for-character against Hub's code
// (dependency.firestore.ts, approval.firestore.ts, event.firestore.ts,
// module-data-sync.firestore.ts), not guessed — verified against the
// Hub_com zip in this same review. This app and Hub write/read the exact
// same Firebase project (see src/lib/firebase/client.ts's file comment),
// so a path mismatch here would be silent data loss, not a visible error.
//
// This file supersedes src/lib/hub/{contract,dependency,event,approval,
// module-data}.{types,firestore}.ts for anything OUR_APP-scoped (own
// version bump, own dependency links, own approval status, own module
// data publish). Those lower-level files remain useful for generic
// operations across arbitrary moduleIds (e.g. reading any upstream
// module's approval history) and this file's OUR_APP-scoped functions
// are thin wrappers with the same 'structural' constant everywhere,
// exactly mirroring bumpOwnModuleVersion/linkOwnDependency/
// setOwnApprovalStatus/saveOwnModuleData in Estimate's copy of this file.

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firestorePaths } from "@/lib/firebase/schema";
import type { ModuleId, ModuleVersionRecord, ModuleDependency } from "./dependency.types";
import type { ApprovalRecord, ApprovalActor } from "./approval.types";
import { SYSTEM_ACTOR } from "./approval.types";
import type { ContractStatus, SourceApp } from "./contract.types";
import type { HubEvent, HubEventType } from "./event.types";
import type { ModuleDataRecord } from "./module-data.types";

const OUR_APP = "structural" as const;

function toISO(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return new Date().toISOString();
}

// ─── Versions (projects/{projectId}/versions/{moduleId}) ────────────────

export async function getModuleVersion(projectId: string, moduleId: ModuleId): Promise<ModuleVersionRecord | null> {
  const snap = await getDoc(doc(db(), firestorePaths.hubModuleVersion(projectId, moduleId)));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { moduleId, currentVersion: d.currentVersion ?? 1, updatedAt: toISO(d.updatedAt) };
}

export async function getAllModuleVersions(projectId: string): Promise<ModuleVersionRecord[]> {
  const snaps = await getDocs(collection(db(), firestorePaths.hubModuleVersions(projectId)));
  return snaps.docs.map((s: QueryDocumentSnapshot) => {
    const d = s.data();
    return { moduleId: s.id as ModuleId, currentVersion: d.currentVersion ?? 1, updatedAt: toISO(d.updatedAt) };
  });
}

/**
 * এই app নিজে যখন কিছু বদলায় (analysis re-run, design result আপডেট,
 * BBS নতুন করে generate), নিজের ('structural') version bump করে —
 * +MODULE_VERSION_BUMPED event emit করাসহ। Hub-এর approval-cascade
 * অংশ (downgradeToOutdatedIfApproved) ইচ্ছাকৃতভাবে বাদ — সেটা Hub-সাইড
 * admin workflow, এই app নিজে সেই সিদ্ধান্ত নেবে না।
 */
export async function bumpOwnModuleVersion(projectId: string): Promise<number> {
  const ref = doc(db(), firestorePaths.hubModuleVersion(projectId, OUR_APP));
  const snap = await getDoc(ref);
  const nextVersion = snap.exists() ? (snap.data().currentVersion ?? 1) + 1 : 1;

  await setDoc(ref, { moduleId: OUR_APP, currentVersion: nextVersion, updatedAt: serverTimestamp() });

  try {
    await emitEvent(projectId, "MODULE_VERSION_BUMPED", { moduleId: OUR_APP, newVersion: nextVersion });
  } catch {
    /* non-critical, Hub-এর কনভেনশন অনুযায়ী */
  }

  return nextVersion;
}

// ─── Dependencies (projects/{projectId}/dependencies/{dependencyId}) ────

/**
 * এই app নিজেকে upstream module (আজ: architectural; Phase 1+ এ
 * buildingInfo/bnbcSettings/siteInfo derivation input হিসেবে ব্যবহার
 * হলে সেগুলোও) এর ওপর নির্ভরশীল হিসেবে link করে। deterministic id —
 * একই pair পুনরায় link করলে overwrite হয়, ডুপ্লিকেট তৈরি হয় না।
 */
export async function linkOwnDependency(
  projectId: string,
  upstreamModule: ModuleId,
  upstreamVersionAtLink: number,
  reason: string,
): Promise<ModuleDependency> {
  const id = `${OUR_APP}__depends_on__${upstreamModule}`;
  const ref = doc(db(), firestorePaths.hubModuleDependency(projectId, id));

  await setDoc(ref, {
    projectId,
    dependentModule: OUR_APP,
    upstreamModule,
    upstreamVersionAtLink,
    reason,
    createdAt: serverTimestamp(),
  });

  try {
    await emitEvent(projectId, "MODULE_DEPENDENCY_LINKED", {
      dependentModule: OUR_APP,
      upstreamModule,
      upstreamVersionAtLink,
    });
  } catch {
    /* non-critical */
  }

  return {
    id,
    projectId,
    dependentModule: OUR_APP,
    upstreamModule,
    upstreamVersionAtLink,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export async function getProjectDependencies(projectId: string): Promise<ModuleDependency[]> {
  const snaps = await getDocs(collection(db(), firestorePaths.hubModuleDependencies(projectId)));
  return snaps.docs.map((s: QueryDocumentSnapshot) => {
    const d = s.data();
    return {
      id: s.id,
      projectId: d.projectId,
      dependentModule: d.dependentModule as ModuleId,
      upstreamModule: d.upstreamModule as ModuleId,
      upstreamVersionAtLink: d.upstreamVersionAtLink ?? 1,
      reason: d.reason ?? "",
      createdAt: toISO(d.createdAt),
    };
  });
}

export interface OwnUnlockStatus {
  unlocked: boolean;
  blockedBy: ModuleId[];
}

/**
 * এই app (dependentModule === 'structural') যে upstream module-এর ওপর
 * নির্ভরশীল, তাদের সবার approval status 'APPROVED' কিনা চেক করে।
 */
export async function isOwnModuleUnlocked(projectId: string): Promise<OwnUnlockStatus> {
  const deps = (await getProjectDependencies(projectId)).filter((d) => d.dependentModule === OUR_APP);
  if (deps.length === 0) return { unlocked: true, blockedBy: [] };

  const blockedBy: ModuleId[] = [];
  for (const dep of deps) {
    const approval = await getApprovalStatus(projectId, dep.upstreamModule);
    if (!approval || approval.status !== "APPROVED") blockedBy.push(dep.upstreamModule);
  }
  return { unlocked: blockedBy.length === 0, blockedBy };
}

// ─── Approvals (projects/{projectId}/approvals/{moduleId}) — read + own set ──
// এই app অন্য কোনো module-এর approval override করতে পারে না — সেটা
// Hub-সাইড human/admin workflow। শুধু নিজের status set করতে পারে।

export async function getApprovalStatus(projectId: string, moduleId: ModuleId): Promise<ApprovalRecord | null> {
  const snap = await getDoc(doc(db(), firestorePaths.hubModuleApproval(projectId, moduleId)));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    moduleId,
    status: d.status as ContractStatus,
    approvedVersion: d.approvedVersion ?? 1,
    actedBy: d.actedBy as ApprovalActor,
    actedAt: toISO(d.actedAt),
    note: d.note as string | undefined,
  };
}

export async function getAllApprovalStatuses(
  projectId: string,
  moduleIds: ModuleId[],
): Promise<Record<string, ApprovalRecord | null>> {
  const entries = await Promise.all(moduleIds.map(async (id) => [id, await getApprovalStatus(projectId, id)] as const));
  return Object.fromEntries(entries);
}

/**
 * এই app নিজের (OUR_APP) status set করে — যেমন design check pass করার
 * পর 'READY_FOR_REVIEW'। actedBy না দিলে SYSTEM_ACTOR।
 */
export async function setOwnApprovalStatus(
  projectId: string,
  status: ContractStatus,
  approvedVersion: number,
  actedBy: ApprovalActor = SYSTEM_ACTOR,
  note?: string,
): Promise<void> {
  await setDoc(doc(db(), firestorePaths.hubModuleApproval(projectId, OUR_APP)), {
    moduleId: OUR_APP,
    status,
    approvedVersion,
    actedBy,
    actedAt: serverTimestamp(),
    ...(note ? { note } : {}),
  });

  try {
    await emitEvent(projectId, "MODULE_STATUS_CHANGED", { moduleId: OUR_APP, status, approvedVersion });
  } catch {
    /* non-critical */
  }
}

// ─── Events (projects/{projectId}/events/{eventId}) ──────────────────────

function toEvent(id: string, d: Record<string, unknown>): HubEvent {
  return {
    id,
    projectId: d.projectId as string,
    type: d.type as HubEventType,
    sourceApp: d.sourceApp as SourceApp,
    payload: d.payload as Record<string, unknown> | undefined,
    createdAt: toISO(d.createdAt),
  };
}

/** এই app সবসময় sourceApp='structural' হিসেবে emit করে। */
export async function emitEvent(
  projectId: string,
  type: HubEventType,
  payload?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db(), firestorePaths.hubModuleEvents(projectId)), {
    projectId,
    type,
    sourceApp: OUR_APP,
    payload: payload ?? {},
    createdAt: serverTimestamp(),
  });
}

export async function getProjectEvents(projectId: string, max = 20): Promise<HubEvent[]> {
  const q = query(collection(db(), firestorePaths.hubModuleEvents(projectId)), orderBy("createdAt", "desc"), limit(max));
  const snaps = await getDocs(q);
  return snaps.docs.map((s: QueryDocumentSnapshot) => toEvent(s.id, s.data()));
}

/**
 * সব app (Hub নিজে, Draw, Estimate, PM) থেকে আসা event রিয়েল-টাইমে
 * শোনে — Hub-এর subscribeToEvents()-এর হুবহু একই query shape।
 */
export function subscribeToEvents(projectId: string, onUpdate: (events: HubEvent[]) => void, max = 20): Unsubscribe {
  const q = query(collection(db(), firestorePaths.hubModuleEvents(projectId)), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => onUpdate(snap.docs.map((s: QueryDocumentSnapshot) => toEvent(s.id, s.data()))),
    () => onUpdate([]), // permission/network error — খালি দেখায়, ভাঙে না
  );
}

// ─── Module data sync (projects/{projectId}/moduleData/{moduleId}) ──────
// Structured field data (schedules, quantities, BBS...) সরাসরি a
// Firestore document-এ — Storage/fileUrl জড়িত না (সেটা আলাদা, পুরনো
// moduleMetadata pattern — module-data.firestore.ts/ModuleDataFile এই
// directory-তে, এটা না। দেখুন module-data.types.ts-এর file comment)।
//
// getModuleData/subscribeToModuleData generic ModuleId নেয় — কারণ এই
// app-কে নিজের module না, architectural (upstream, Phase 1+ থেকে) পড়তে
// হবে। saveModuleData ইচ্ছাকৃতভাবে শুধু OUR_APP-এ সীমাবদ্ধ
// (bumpOwnModuleVersion-এর একই নীতি) — এই app অন্য কোনো module-এর data
// ওভাররাইট করার এখতিয়ার রাখে না।

function toModuleDataRecord(moduleId: ModuleId, d: Record<string, unknown>): ModuleDataRecord {
  return {
    moduleId,
    sourceApp: d.sourceApp as SourceApp,
    data: (d.data as Record<string, unknown>) ?? {},
    version: (d.version as number) ?? 0,
    updatedAt: toISO(d.updatedAt),
  };
}

/** upstream module-এর (architectural/estimating/projectmgmt) বর্তমান ডেটা এক-বার পড়ে। ডেটা এখনো না-থাকলে null — এটা error না, শুধু producer এখনো লেখেনি। */
export async function getModuleData(projectId: string, moduleId: ModuleId): Promise<ModuleDataRecord | null> {
  const snap = await getDoc(doc(db(), firestorePaths.hubModuleData(projectId, moduleId)));
  if (!snap.exists()) return null;
  return toModuleDataRecord(moduleId, snap.data());
}

/** upstream module-এর ডেটা রিয়েল-টাইমে শোনে — producer app নতুন করে লিখলে (bumpModuleVersion সহ) স্বয়ংক্রিয়ভাবে re-render ট্রিগার করার জন্য (Phase 7 — Real-time Listener এর ভিত্তি)। Caller-কে unsubscribe cleanup-এ কল করতে হবে। */
export function subscribeToModuleData(
  projectId: string,
  moduleId: ModuleId,
  onUpdate: (record: ModuleDataRecord | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db(), firestorePaths.hubModuleData(projectId, moduleId)),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(toModuleDataRecord(moduleId, snap.data()));
    },
    () => onUpdate(null), // permission/network error-এ null, ভাঙে না
  );
}

/**
 * data (ও তার nested object গুলো) থেকে সব `undefined`-valued key
 * বাদ দেয়। Firestore Web SDK ডিফল্টভাবে (ignoreUndefinedProperties
 * সেট না থাকলে, এই app-এর firebase/client.ts এ নেই) `setDoc()`/
 * `updateDoc()` এ top-level বা nested যেকোনো `undefined` field পেলে
 * পুরো write ব্যর্থ করে (FirebaseError: invalid-argument) — সরাসরি
 * SDK দিয়ে যাচাই করা হয়েছে (node দিয়ে সত্যিকার setDoc() কল করে)।
 *
 * hub-module-export.ts এর মতো ফাইল ইচ্ছাকৃতভাবে খালি field-কে
 * `undefined` দিয়ে চিহ্নিত করে (Estimate app এর hub-module-export.ts
 * এও একই `?? undefined` প্যাটার্ন) — সেই object সরাসরি এখানে এলে
 * পুরো Hub sync silently ব্যর্থ হয়ে যেত (প্রথম undefined field পেলেই
 * পুরো setDoc() throw করে, শুধু সেই একটা field skip হয় না)। তাই
 * saveOwnModuleData() নিজেই defensively strip করে — প্রতিটা caller কে
 * আলাদাভাবে মনে রাখতে হবে না।
 *
 * null বনাম undefined: `null` ইচ্ছাকৃতভাবে রাখা হয় (Firestore null
 * সমর্থন করে, এবং কিছু ফিল্ড সত্যিই "নেই" বোঝাতে null ব্যবহার করে —
 * যেমন module-data.types.ts এর moduleId র বাইরের কিছু ক্ষেত্রে)।
 * শুধু `undefined` strip হয়, `null` অপরিবর্তিত থাকে।
 */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    // Object key এর মতোই array element এও raw `undefined` বাদ দেওয়া
    // হয় (শুধু .map() করলে [1, undefined, 2] এর মাঝের undefined
    // element রয়ে যেত — Firestore সেটাও reject করে, নিচের নোট দেখুন)।
    return value.filter((item) => item !== undefined).map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      result[key] = stripUndefinedDeep(val);
    }
    return result as T;
  }
  return value;
}

/**
 * এই app নিজের produce করা module data (concreteQuantities, bbs,
 * castingSequence ইত্যাদি — Phase 6 outgoing sync) Hub-এ প্রকাশ করে।
 * merge:true — আংশিক আপডেটে বাকি field মুছে যায় না। version নিজে বসিয়ে
 * দেওয়া হয় (caller প্রথমে bumpOwnModuleVersion() কল করে newVersion এখানে
 * পাস করবে), যাতে moduleData.version সবসময় versions/structural.currentVersion
 * এর সাথে হুবহু sync থাকে। data এর undefined field গুলো write এর আগে
 * strip করা হয় (stripUndefinedDeep() এর ডকুমেন্টেশন দেখুন — নাহলে
 * Firestore পুরো write reject করে)।
 */
export async function saveOwnModuleData(
  projectId: string,
  data: Record<string, unknown>,
  version: number,
): Promise<void> {
  await setDoc(
    doc(db(), firestorePaths.hubModuleData(projectId, OUR_APP)),
    { moduleId: OUR_APP, sourceApp: OUR_APP, data: stripUndefinedDeep(data), version, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
