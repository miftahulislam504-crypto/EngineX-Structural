// src/lib/hub/contract.types.ts
//
// Ported from EngineXDraw's apps/web/src/lib/hub/contract.types.ts, which
// itself was ported from CivilOS Hub's lib/types/contract.types.ts. This
// defines the shared "common engineering language" every app in the
// ecosystem speaks — no app reads another app's internal Firestore
// structure directly. See the note at the top of dependency.types.ts about
// keeping this byte-for-byte compatible with Hub's and Draw's copies:
// SourceApp already includes 'structural', so nothing here needed to
// change to describe this app.
//
// This is Phase 0 of the Hub → Structural integration plan: before this
// app can read real data from Hub, or push quantities/BBS/results back,
// it needs the same contract envelope, version-dependency tracking, and
// event log that EngineXDraw already proved out. The old
// src/lib/types/hub.ts + hub-outgoing.ts + src/lib/hub/sync.ts read/wrote
// projects/{id}/hubSync/{incoming,outgoing} — a path Hub never writes to
// and nothing reads — and are now deprecated in favor of this layer.

export const CONTRACT_SCHEMA_VERSION = "1.0" as const;

export type SourceApp =
  | "hub"
  | "architectural"
  | "structural"
  | "estimating"
  | "projectmgmt"
  | "reports";

export interface ContractEnvelope<T> {
  schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
  sourceApp: SourceApp;
  projectId: string;
  moduleVersion: number;
  generatedAt: string; // ISO date
  data: T;
}

export function wrapContract<T>(
  data: T,
  sourceApp: SourceApp,
  projectId: string,
  moduleVersion = 1,
): ContractEnvelope<T> {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    sourceApp,
    projectId,
    moduleVersion,
    generatedAt: new Date().toISOString(),
    data,
  };
}

// ─── Shared Entities ────────────────────────────────────────────────────
// These are what Phase 2 (Architectural Geometry Parser) will map
// EngineXDraw's referenceGeometryUrl export into: Wall → Wall/ShearWall,
// Slab boundary → AreaElement, etc.
export interface ProjectLevel {
  id: string;
  name: string;
  elevation: number; // meters, from ground level
  height: number; // meters
}

export interface ProjectGrid {
  id: string;
  axis: "X" | "Y";
  position: number; // meters, from origin
}

export interface GeometryData {
  [key: string]: unknown;
}

export interface BuildingElementRef {
  id: string;
  type: string; // 'wall' | 'door' | 'column' | 'beam' | ...
  levelId: string; // refers to ProjectLevel.id
  geometry?: GeometryData;
  materialId?: string;
}

export type ContractStatus =
  | "DRAFT"
  | "PROCESSING"
  | "READY_FOR_REVIEW"
  | "REVIEWED"
  | "APPROVED"
  | "OUTDATED"
  | "REJECTED";
