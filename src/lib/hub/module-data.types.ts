// src/lib/hub/module-data.types.ts
//
// Ported from CivilOS Hub's lib/types/module-data.types.ts (added to
// Hub's zip alongside module-data-sync.firestore.ts — see
// MODULE_DATA_SYNC_NOTES.md in Hub's repo root). This is a DIFFERENT
// mechanism from module-data.firestore.ts/ModuleDataFile in this same
// directory, despite the similar name — don't conflate them:
//
//   module-data.firestore.ts       → HEAVY FILE reference (geometry/mesh/
//                                     PDF etc. in Storage, Firestore holds
//                                     only fileUrl/storagePath).
//                                     moduleMetadata/{moduleId} document.
//   module-data.types.ts (here) +     → STRUCTURED FIELD data (BOQ,
//   module-data-sync.firestore.ts       schedules, quantities...) directly
//                                        in a Firestore document, as a
//                                        JSON blob. moduleData/{moduleId}
//                                        document. ← this is what this
//                                        file's types describe.
//
// EngineXEstimate's hub-module-export.ts (the plan's most complete
// working edge — see hub-sdk-client.ts in that app) uses this mechanism,
// not the Storage one, to push its BOQ/quantities/etc. to Hub. This app's
// own Phase 6 (Structural → Hub outgoing: concrete/reinforcement/
// formwork quantities, BBS, casting sequence...) is the same shape of
// data and is expected to follow the same mechanism — see
// StructuralModuleData below, which is exactly the field list Phase 6's
// plan section already named.

import type { ModuleId } from "./dependency.types";
import type { SourceApp } from "./contract.types";

// ─── Architectural (from EngineXDraw) ──────────────────────────────────
export interface ArchitecturalModuleData {
  // Schedules / quantities
  floorAreas?: unknown;
  roomSchedule?: unknown;
  wallSchedule?: unknown;
  doorSchedule?: unknown;
  windowSchedule?: unknown;
  finishSchedule?: unknown;
  ceilingSchedule?: unknown;
  stairSchedule?: unknown;
  rampSchedule?: unknown;
  roofSchedule?: unknown;
  siteDevelopment?: unknown;
  landscapeQuantities?: unknown;

  // Drawing settings / geometry references
  architecturalDrawingSettings?: unknown;
  grid?: unknown;
  levels?: unknown;
  columnLocations?: unknown;
  wallLocations?: unknown;
  slabBoundaries?: unknown;
  openings?: unknown;
  stairGeometry?: unknown;
  roofGeometry?: unknown;
  floorLoadsDeadLoadSource?: unknown;
  shaftOpenings?: unknown;

  // Aggregated quantities
  allArchitecturalQuantities?: unknown;
  finishQuantities?: unknown;
  doorWindowQuantities?: unknown;
  areaStatements?: unknown;
  roomData?: unknown;

  // PM-facing summary fields
  workBreakdownByFloor?: unknown;
  zoneInformation?: unknown;
  drawingStatus?: unknown;
  revisionStatus?: unknown;
  constructionSequenceReference?: unknown;
  floorWiseWorkBreakdown?: unknown;
  roomList?: unknown;
  spaceList?: unknown;
  area?: unknown;
  elevation?: unknown;
  drawingRevision?: unknown;
  milestonesArchitectural?: unknown;
}

// ─── Structural (from this app) ────────────────────────────────────────
// This is what Phase 6 (Structural → Hub outgoing sync) will populate
// via saveOwnModuleData() — see hub-sdk-client.ts. Every field is
// `unknown` today because Hub doesn't know this app's real result types
// yet (RcBeamDesignResult, ConcreteQuantitySummary, etc. — see
// HUB_MODULE_SYNC_NOTE.md's closing note). Narrowing these to real types
// is Phase 6+ cleanup, not a Phase 0 blocker.
export interface StructuralModuleData {
  concreteQuantities?: unknown;
  reinforcementQuantities?: unknown;
  formworkQuantities?: unknown;
  excavationQuantities?: unknown;
  backfillQuantities?: unknown;
  foundationQuantities?: unknown;
  beamColumnSlabQuantities?: unknown;
  structuralSteelQuantities?: unknown;
  shopDrawingRevision?: unknown;
  wasteFactors?: unknown;

  bbs?: unknown;
  materialSummary?: unknown;
  structuralActivities?: unknown;
  castingSequence?: unknown;
  structuralMilestones?: unknown;
  shopDrawingStatus?: unknown;
  inspectionStages?: unknown;
  materialDemand?: unknown;
  foundationSequence?: unknown;
  inspectionStatus?: unknown;
  designRevision?: unknown;
}

// ─── Estimate & BOQ (from EngineXEstimate) ─────────────────────────────
export interface EstimatingModuleData {
  boq?: unknown;
  activityWiseCost?: unknown;
  materialRequirement?: unknown;
  labourRequirement?: unknown;
  equipmentRequirement?: unknown;
  procurementList?: unknown;
  budget?: unknown;
  cashFlow?: unknown;
  rateAnalysis?: unknown;
  vendorInformation?: unknown;

  finalBoq?: unknown;
  approvedQuantities?: unknown;
  materialDemand?: unknown;
  labourDemand?: unknown;
  equipmentDemand?: unknown;
  procurementPlan?: unknown;
  costBaseline?: unknown;
  costForecast?: unknown;
  paymentStatus?: unknown;
}

// ─── Project Management ────────────────────────────────────────────────
export interface ProjectMgmtModuleData {
  organizationStructure?: unknown;
  resourceLibrary?: unknown;
  costLibrary?: unknown;
  calendar?: unknown;
  workingHours?: unknown;
  holidays?: unknown;
}

// ─── Union / envelope ───────────────────────────────────────────────────
export type ModuleDataPayload =
  | ArchitecturalModuleData
  | StructuralModuleData
  | EstimatingModuleData
  | ProjectMgmtModuleData;

// `projects/{projectId}/moduleData/{moduleId}` — one document per module.
export interface ModuleDataRecord<T = Record<string, unknown>> {
  moduleId: ModuleId;
  sourceApp: SourceApp;
  data: T;
  version: number; // always in sync with versions/{moduleId} in dependency.firestore.ts
  updatedAt: string; // ISO
}
