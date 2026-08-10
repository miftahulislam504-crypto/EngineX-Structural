// src/lib/hub/event.types.ts
//
// Ported from EngineXDraw's apps/web/src/lib/hub/event.types.ts, itself
// ported from CivilOS Hub's lib/types/event.types.ts — see the note at the
// top of dependency.types.ts.
//
// The STRUCT_MODEL_CREATED / ANALYSIS_COMPLETED / DESIGN_COMPLETED /
// FOUNDATION_COMPLETED / STRUCT_DESIGN_APPROVED entries already existed in
// Hub's and Draw's copies of this file with a comment saying no emitter
// existed yet, specifically anticipating this app — the same way
// ARCH_MODEL_UPDATED anticipated EngineXDraw before it joined. This app
// becoming a real emitter for these is later-phase work (Phase 6,
// outgoing sync); Phase 0 only wires up the infrastructure emitEvent()
// itself needs.

import type { SourceApp } from "./contract.types";

export type HubEventType =
  // ── Hub internal ──
  | "MODULE_VERSION_BUMPED"
  | "MODULE_DEPENDENCY_LINKED"
  | "MODULE_APPROVED"
  | "MODULE_REJECTED"
  | "MODULE_OUTDATED"
  | "MODULE_STATUS_CHANGED"
  | "WORKFLOW_STAGE_CHANGED"
  | "REPORT_GENERATED"

  // ── Architectural — EngineXDraw is the emitter for ARCH_MODEL_UPDATED ──
  | "ARCH_MODEL_UPDATED"
  | "ARCH_MODEL_VALIDATED"
  | "ARCH_MODEL_APPROVED"

  // ── Structural — no emitter yet (this app, later phase) ──
  | "STRUCT_MODEL_CREATED"
  | "ANALYSIS_COMPLETED"
  | "DESIGN_COMPLETED"
  | "FOUNDATION_COMPLETED"
  | "STRUCT_DESIGN_APPROVED"

  // ── Estimating — no emitter yet ──
  | "QUANTITY_CALCULATED"
  | "BOQ_GENERATED"
  | "COST_CALCULATED"
  | "ESTIMATE_UPDATED"
  | "ESTIMATE_APPROVED"

  // ── Project Management — no emitter yet ──
  | "PROJECT_STARTED"
  | "PROGRESS_UPDATED"
  | "COST_UPDATED"
  | "DELAY_DETECTED"
  | "MILESTONE_COMPLETED"
  | "PROJECT_COMPLETED";

// `projects/{projectId}/events/{eventId}`
export interface HubEvent {
  id: string;
  projectId: string;
  type: HubEventType;
  sourceApp: SourceApp;
  payload?: Record<string, unknown>;
  createdAt: string; // ISO
}
