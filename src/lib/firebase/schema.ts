/**
 * Firestore Schema — কেন্দ্রীয় path helper।
 *
 * নিয়ম: কোনো জায়গায় hand-typed collection path লেখা যাবে না।
 * সব সময় এই ফাংশনগুলা ব্যবহার করতে হবে, যাতে schema বদলালে
 * শুধু এই একটা ফাইল আপডেট করলেই চলে।
 *
 * Structure:
 *   projects/{projectId}                                  ← Hub owns this document
 *   projects/{projectId}/structuralModel/geometryCore      ← Grid/Story (Phase 1)
 *   projects/{projectId}/structuralModel/materialLibrary   ← Material library (Phase 2a+, single doc — সাধারণত কয়েকটা মাত্র material থাকে)
 *   projects/{projectId}/structuralModel/sectionLibrary    ← Section library (Phase 2a+, single doc — একই যুক্তি)
 *   projects/{projectId}/structuralModel/loadPatterns      ← Load Pattern list (Phase 3, single doc — সংখ্যায় কম, সাধারণত ১০-২০টার বেশি হয় না)
 *   projects/{projectId}/structuralModel/loadCombinations  ← Load Combination list (Phase 3, single doc — একই যুক্তি)
 *   projects/{projectId}/structuralElements/{elementId}    ← Beam/Column/Slab/... (subcollection, কারণ সংখ্যায় শত-হাজার হতে পারে)
 *   projects/{projectId}/wallSelfWeightRefs/{refId}        ← ২০২৬-০৯-০৪, Hub payload-size split — ordinary wall (isShearWall: false) centerline+thickness/height, StructuralElement না (structuralElements এ না) — শুধু deriveWallLineLoadFromSelfWeight.ts এর ইনপুট, structuralElements এর মতোই সংখ্যায় বড় হতে পারে বলে একই subcollection প্যাটার্ন
 *   projects/{projectId}/elementDetailing/{elementId}      ← Phase 10j — প্রতি element-এর persisted rebar detailing result (subcollection, elements-এর সাথে ১:১, তাই একই sizing যুক্তি)
 *   projects/{projectId}/loadCases/{loadCaseId}            ← প্রতিটা element-এ প্রযুক্ত নির্দিষ্ট লোড (subcollection, কারণ প্রতিটা element একাধিক load case নিতে পারে — Materials/Sections/Patterns এর থেকে ভিন্ন, এটা elements-এর মতোই সংখ্যায় বড় হতে পারে)
 *   projects/{projectId}/analysisRuns/{runId}
 *   projects/{projectId}/analysisRuns/{runId}/results/{resultId}
 *   projects/{projectId}/designResults/{designId}
 *   projects/{projectId}/structuralModel/generalNotes      ← General Notes panel input (Phase 11 merge, single doc — একটা project এ একটাই সেট criteria/cover/material)
 *
 *   --- DEPRECATED (Hub-Structural Integration Phase 0) ---
 *   projects/{projectId}/hubSync/outgoing                 ← @deprecated dead path — nothing reads this
 *   projects/{projectId}/hubSync/incoming                 ← @deprecated dead path — Hub never writes here
 *
 *   --- Shared ecosystem contract (Hub-Structural Integration Phase 0) ---
 *   এই কয়টা path এই App-এর নিজস্ব না — Hub-এর canonical schema
 *   (lib/types/*.types.ts, lib/firestore/*.firestore.ts), যা প্রথমে
 *   EngineXDraw এবং এখন এই App byte-for-byte compatible রেখে ব্যবহার
 *   করছে। src/lib/hub/{contract,dependency,event,approval}.types.ts এবং
 *   {dependency,event,approval,module-data}.firestore.ts দেখুন।
 *   projects/{projectId}/versions/{moduleId}                       ← per-module version counter
 *   projects/{projectId}/dependencies/{dependencyId}                ← which module depends on which, at what version
 *   projects/{projectId}/events/{eventId}                           ← ecosystem-wide event log
 *   projects/{projectId}/approvals/{moduleId}                       ← current approval status per module
 *   projects/{projectId}/approvals/{moduleId}/history/{historyId}   ← approval audit trail
 *   projects/{projectId}/moduleMetadata/{moduleId}                  ← heavy file metadata (Storage-backed module data, e.g. BBS xlsx/pdf)
 *
 *   --- Hub's own native documents (Hub-Structural Integration Phase 7 bugfix) ---
 *   এই তিনটা path moduleData/{moduleId} mechanism এর অংশ না — Hub এর
 *   নিজস্ব site-info.firestore.ts/building.firestore.ts/bnbc.firestore.ts
 *   সরাসরি projects/{projectId}/ এর নিচে এই document গুলোতে লেখে
 *   (moduleData/siteInfo না)। character-for-character verified against
 *   the Hub_com zip (see hub-module-shapes.ts's file comment) — এবং
 *   EngineXDraw এর hub-read.ts ও EngineXProject এর hub-native-paths.ts
 *   এর সাথেও মেলানো (তিনটা App একই path ব্যবহার করে)। version এই
 *   document গুলোর ভেতরে নেই — Hub এর saveSiteInfo()/saveBuildingInfo()/
 *   saveBnbcSettings() প্রতিবার bumpModuleVersion() কল করে versions/
 *   {siteInfo|buildingInfo|bnbcSettings} এ আলাদাভাবে version রাখে, তাই
 *   version এর জন্য hubModuleVersion() ব্যবহার করতে হবে, এই path গুলোর
 *   ডকুমেন্ট থেকে না।
 *   projects/{projectId}/site_information/data
 *   projects/{projectId}/building_information/data
 *   projects/{projectId}/bnbc_settings/data
 */

export const firestorePaths = {
  project: (projectId: string) => `projects/${projectId}`,

  geometryCore: (projectId: string) =>
    `projects/${projectId}/structuralModel/geometryCore`,

  materialLibrary: (projectId: string) =>
    `projects/${projectId}/structuralModel/materialLibrary`,

  sectionLibrary: (projectId: string) =>
    `projects/${projectId}/structuralModel/sectionLibrary`,

  structuralElements: (projectId: string) =>
    `projects/${projectId}/structuralElements`,
  structuralElement: (projectId: string, elementId: string) =>
    `projects/${projectId}/structuralElements/${elementId}`,

  /** ২০২৬-০৯-০৪, Hub payload-size split (hub-write.ts) — ordinary wall centerline+self-weight ইনপুট, StructuralElement না। schema.ts এর হেডার কমেন্ট দেখুন। */
  wallSelfWeightRefs: (projectId: string) =>
    `projects/${projectId}/wallSelfWeightRefs`,
  wallSelfWeightRef: (projectId: string, refId: string) =>
    `projects/${projectId}/wallSelfWeightRefs/${refId}`,

  elementDetailingResults: (projectId: string) =>
    `projects/${projectId}/elementDetailing`,
  elementDetailingResult: (projectId: string, elementId: string) =>
    `projects/${projectId}/elementDetailing/${elementId}`,

  loadPatterns: (projectId: string) => `projects/${projectId}/structuralModel/loadPatterns`,

  loadCases: (projectId: string) => `projects/${projectId}/loadCases`,
  loadCase: (projectId: string, loadCaseId: string) =>
    `projects/${projectId}/loadCases/${loadCaseId}`,

  loadCombinations: (projectId: string) =>
    `projects/${projectId}/structuralModel/loadCombinations`,

  analysisRuns: (projectId: string) => `projects/${projectId}/analysisRuns`,
  analysisRun: (projectId: string, runId: string) =>
    `projects/${projectId}/analysisRuns/${runId}`,
  analysisResults: (projectId: string, runId: string) =>
    `projects/${projectId}/analysisRuns/${runId}/results`,

  designResults: (projectId: string) => `projects/${projectId}/designResults`,

  generalNotes: (projectId: string) =>
    `projects/${projectId}/structuralModel/generalNotes`,

  /** @deprecated Dead path — nothing reads projects/{id}/hubSync/outgoing. Kept only so src/lib/hub/sync.ts still compiles until its callers migrate (see that file's header). Use the hubModule* paths below for new code. */
  hubSyncOutgoing: (projectId: string) =>
    `projects/${projectId}/hubSync/outgoing`,
  /** @deprecated Dead path — Hub never writes to projects/{id}/hubSync/incoming. Kept only so src/lib/hub/sync.ts still compiles until its callers migrate (see that file's header). Use the hubModule* paths below for new code. */
  hubSyncIncoming: (projectId: string) =>
    `projects/${projectId}/hubSync/incoming`,

  // ─── Shared ecosystem contract (Hub-Structural Integration Phase 0) ───
  // Byte-for-byte compatible with Hub's and EngineXDraw's copies of these
  // same paths — see src/lib/hub/dependency.types.ts.
  hubModuleVersion: (projectId: string, moduleId: string) =>
    `projects/${projectId}/versions/${moduleId}`,
  hubModuleVersions: (projectId: string) =>
    `projects/${projectId}/versions`,

  hubModuleDependency: (projectId: string, dependencyId: string) =>
    `projects/${projectId}/dependencies/${dependencyId}`,
  hubModuleDependencies: (projectId: string) =>
    `projects/${projectId}/dependencies`,

  hubModuleEvent: (projectId: string, eventId: string) =>
    `projects/${projectId}/events/${eventId}`,
  hubModuleEvents: (projectId: string) =>
    `projects/${projectId}/events`,

  hubModuleApproval: (projectId: string, moduleId: string) =>
    `projects/${projectId}/approvals/${moduleId}`,
  hubModuleApprovalHistory: (projectId: string, moduleId: string) =>
    `projects/${projectId}/approvals/${moduleId}/history`,
  hubModuleApprovalHistoryEntry: (projectId: string, moduleId: string, historyId: string) =>
    `projects/${projectId}/approvals/${moduleId}/history/${historyId}`,

  hubModuleDataMetadata: (projectId: string, moduleId: string) =>
    `projects/${projectId}/moduleMetadata/${moduleId}`,

  // Structured field-data sync (BOQ/schedules/quantities as a JSON blob,
  // NOT a Storage-file reference — see the header comment on
  // module-data.types.ts for how this differs from hubModuleDataMetadata
  // above). This is the mechanism EngineXEstimate's proven push edge
  // actually uses.
  hubModuleData: (projectId: string, moduleId: string) =>
    `projects/${projectId}/moduleData/${moduleId}`,

  // ─── Hub's own native documents (NOT moduleData-backed — see the file
  // header comment above for why these are separate) ───
  hubSiteInfo: (projectId: string) =>
    `projects/${projectId}/site_information/data`,
  hubBuildingInfo: (projectId: string) =>
    `projects/${projectId}/building_information/data`,
  hubBnbcSettings: (projectId: string) =>
    `projects/${projectId}/bnbc_settings/data`,
} as const;
