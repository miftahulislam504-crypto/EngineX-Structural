/**
 * Send-back-to-Hub Types (Section 20)
 *
 * এই টাইপগুলা এখন স্কেলেটন — পরের Phase-গুলায় (Analysis Engine, Design Engine)
 * প্রতিটার ভিতরের ডেটা পূর্ণাঙ্গ হবে। এখন খালি/placeholder শেপ দিয়ে
 * Hub sync pipeline টেস্ট করা যাবে।
 *
 * @deprecated (Hub-Structural Integration Phase 0) — pushHubOutgoingPackage()
 * in src/lib/hub/sync.ts, the only function that writes an
 * OutgoingHubPackage, writes to projects/{id}/hubSync/outgoing, which
 * nothing downstream reads. The Phase 6 outgoing path was planned as
 * uploadModuleData() (src/lib/hub/module-data.firestore.ts, Storage-
 * backed) — but Firebase's free plan has no Storage bucket, so that
 * mechanism was never actually usable (see hub-geometry-parser.ts's
 * file comment for the parallel incoming-side bugfix, and Draw's
 * hub-write.ts publishArchitecturalToHub() for how the equivalent
 * outgoing path was fixed there: pure Firestore, no Storage). Any
 * future outgoing implementation here should follow that same
 * pure-Firestore pattern rather than uploadModuleData(). See the
 * deprecation note at the top of sync.ts.
 */

export type SyncStatus = "not-started" | "in-progress" | "synced" | "failed";

export interface OutgoingStructuralModel {
  modelId: string;
  version: number;
  status: SyncStatus;
  elementCount: number;
  lastModifiedAt: string;
  // Phase 1-2 তে elements/materials/sections যোগ হলে এখানে পূর্ণ হবে
}

export interface OutgoingAnalysisResults {
  analysisId: string;
  status: SyncStatus;
  runAt: string | null;
  analysisTypes: string[]; // e.g. ["linear-static", "modal"]
  // Phase 4-এ পূর্ণাঙ্গ হবে
}

export interface OutgoingDesignResults {
  designId: string;
  status: SyncStatus;
  codeCompliance: "pass" | "fail" | "not-checked";
  // Phase 6-এ পূর্ণাঙ্গ হবে
}

export interface OutgoingQuantityOutput {
  status: SyncStatus;
  // Estimate & Costing App-এর জন্য — concrete volume, steel weight, formwork area ইত্যাদি
  concreteVolumeM3?: number;
  reinforcementWeightKg?: number;
  formworkAreaM2?: number;
}

export interface OutgoingConstructionSequenceData {
  status: SyncStatus;
  // Project Management App-এর জন্য
  sequenceStages?: { stageName: string; durationDays: number }[];
}

export interface OutgoingReportPackage {
  status: SyncStatus;
  // Report & Export App-এর জন্য
  reportUrls: string[]; // Firebase Storage paths
}

/**
 * পূর্ণাঙ্গ প্যাকেজ যা Structural App Hub-কে ফেরত পাঠায়।
 */
export interface OutgoingHubPackage {
  projectId: string;
  structuralModel: OutgoingStructuralModel;
  analysisResults: OutgoingAnalysisResults;
  designResults: OutgoingDesignResults;
  quantityOutput: OutgoingQuantityOutput;
  constructionSequenceData: OutgoingConstructionSequenceData;
  reportPackage: OutgoingReportPackage;
  lastSyncedAt: string | null;
}
