/**
 * Analysis Orchestration (Frontend)
 *
 * Firestore থেকে পড়া elements/materials/sections/loadCases একত্র করে
 * backend (civilos-structural-solver) এর প্রত্যাশিত payload shape
 * বানায়। বিশেষভাবে গুরুত্বপূর্ণ: section এর geometric properties
 * (area/ixx/iyy/j) এখানেই precompute করে payload এ বসানো হয়
 * (computeSectionProperties() ব্যবহার করে) — backend নিজে এই হিসাব
 * করে না, শুধু ইতিমধ্যে-হিসাব-করা সংখ্যা আশা করে (backend README এর
 * AnalysisJobRequest docstring এ এই contract বর্ণিত)।
 *
 * এই ফাইল backend এর app/analysis_orchestration.py এর সাথে একটা
 * implicit contract শেয়ার করে — দুই পাশের shape mismatch হলে backend
 * "মডেল পার্স করতে ব্যর্থ" 422 error দেবে, silent ভুল ফলাফল না।
 *
 * supportOverrides (Phase 5, ecosystem sync plan) — প্রতিটা run*Analysis
 * ফাংশন এখন এই ঐচ্ছিক parameter নেয় (AnalysisJobRequest এ আগে থেকেই
 * client.ts এ সংজ্ঞায়িত ছিল, কিন্তু এই ফাইলের কোনো function সেটা
 * কখনো pass-through করত না — grep করে যাচাই করা হয়েছিল কোনো caller
 * ছিল না)। না দিলে (undefined) backend এর পুরনো hardcoded "base =
 * fixed" (Y≈0) heuristic অপরিবর্তিতভাবে চলবে — backward compatible,
 * কোনো existing caller ভাঙে না। useSupportOverrideStore.ts এ থাকা
 * override গুলো AnalysisPanel.tsx থেকে এখানে পাস করা হয়
 * (deriveSupportOverrideSuggestion.ts এর suggestion থেকে ইঞ্জিনিয়ার
 * explicit "Apply" করলে সেই store এ যোগ হয়)।
 */

import type { StructuralElement } from "@/lib/types/element";
import type { StructuralMaterial } from "@/lib/types/material";
import type { StructuralSection } from "@/lib/types/section";
import { computeSectionProperties } from "@/lib/types/section";
import type { LoadCase } from "@/lib/types/load";
import { submitAndAwaitJob, type JobStatusResponse, type SupportOverride } from "@/lib/compute/client";

const LINE_ELEMENT_CATEGORIES = new Set(["beam", "column", "brace", "pile"]);

export interface AnalysisRunnableCheck {
  canRun: boolean;
  reason?: string;
}

/**
 * Analysis চালানোর আগে একটা দ্রুত client-side check — backend পর্যন্ত
 * একটা নিশ্চিতভাবে ব্যর্থ হবে এমন request না পাঠিয়ে, ইউজারকে সাথে
 * সাথে বলে দেওয়া কেন চালানো যাচ্ছে না। এটা backend এর validation
 * প্রতিস্থাপন করে না (backend নিজেও validate করে, defense in depth) —
 * এটা শুধু দ্রুত UX feedback এর জন্য।
 */
export function checkAnalysisRunnable(
  elements: StructuralElement[],
  loadCases: LoadCase[]
): AnalysisRunnableCheck {
  const lineElements = elements.filter((e) => LINE_ELEMENT_CATEGORIES.has(e.category));

  if (lineElements.length === 0) {
    return {
      canRun: false,
      reason: "কোনো Beam/Column/Brace/Pile নেই — Analysis চালানোর জন্য অন্তত একটা লাগবে।",
    };
  }

  const hasBaseLevelElement = lineElements.some(
    (e) => "startPoint" in e && (e.startPoint.y <= 1e-3 || e.endPoint.y <= 1e-3)
  );
  if (!hasBaseLevelElement) {
    return {
      canRun: false,
      reason:
        "কোনো element base level (Y≈0) এ নেই — backend স্বয়ংক্রিয়ভাবে base-level node কে support ধরে, তাই কোনো element base এ না থাকলে সলভার ব্যর্থ হবে।",
    };
  }

  // Phase 4 (Load Pipeline সম্প্রসারণ) — আগে শুধু "point" গ্রহণযোগ্য
  // ছিল, এখন uniform-line ও uniform-area ও গ্রহণযোগ্য। ⚠️ এই তিনটার
  // মধ্যে backend (civilos-structural-solver, আলাদা repo, এই কোডবেসের
  // অংশ না) শুধু point load-ই numerically সলভ করে তা আগে যাচাই করা
  // হয়েছিল (backend README অনুযায়ী) — uniform-line/uniform-area
  // backend-এ কীভাবে (বা আদৌ) হ্যান্ডল হয় তা এই ফাইল থেকে যাচাই করা
  // সম্ভব হয়নি (backend repo আপলোড করা হয়নি)। buildAnalysisPayload()
  // এই তিন ধরনের load case-ই অপরিবর্তিতভাবে backend-এ পাঠায় (কোনো
  // frontend-side ফিল্টার/ট্রান্সফর্ম নেই, আর্কিটেকচারাল নিয়ম অনুযায়ী
  // সব ইঞ্জিনিয়ারিং গণনা backend এ) — backend যদি uniform-line/area
  // সমর্থন না করে, elementEndForces এ 0 বা ভুল ফলাফল আসতে পারে চুপচাপ,
  // কোনো frontend error ছাড়াই। **backend README/analysis_orchestration.py
  // যাচাই না করে এই গেট রিলিজ করা উচিত না** — এই কমেন্ট intentionally
  // এখানে রাখা হলো যাতে পরের কেউ (বা future session) এই না-যাচাই-করা
  // অংশ miss না করে।
  const supportedApplicationTypes = new Set(["point", "uniform-line", "uniform-area"]);
  const runnableLoadCases = loadCases.filter((lc) => supportedApplicationTypes.has(lc.applicationType));
  if (runnableLoadCases.length === 0) {
    return {
      canRun: false,
      reason:
        "কোনো Point/Uniform Line/Uniform Area Load নেই — Analysis চালানোর জন্য অন্তত একটা লাগবে (Loads → Apply ট্যাব থেকে যোগ করুন, বা Self-Weight Auto-Generate ব্যবহার করুন)।",
    };
  }

  return { canRun: true };
}

/**
 * Elements/Materials/Sections/LoadCases থেকে backend এর প্রত্যাশিত
 * model_payload বানায়। Slab/Wall/Footing ইত্যাদি (backend এ যেগুলো
 * এই Phase এ সমর্থিত না) এখানেই ফিল্টার করে বাদ দেওয়া হচ্ছে না —
 * সবগুলো পাঠানো হয়, backend নিজে সেগুলো skip করে ও warning রিপোর্ট
 * করে (app/analysis_orchestration.py দেখুন)। এভাবে "কোন element
 * সমর্থিত" এই সিদ্ধান্ত একটাই জায়গায় (backend) থাকে, দুই জায়গায়
 * duplicate logic রাখতে হয় না।
 */
export function buildAnalysisPayload(
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[]
): Record<string, unknown> {
  const sectionsWithProperties = sections.map((section) => {
    let properties;
    try {
      properties = computeSectionProperties(section);
    } catch {
      // Composite/Prestressed/Cold-Formed section এর জন্য
      // computeSectionProperties throw করে (section.ts এ ডকুমেন্টেড
      // সীমাবদ্ধতা) — সেই section ব্যবহার করা কোনো element থাকলে
      // backend এ গিয়ে material/section lookup এ ব্যর্থ হবে একটা
      // পরিষ্কার error সহ। এখানে properties undefined রেখে দেওয়া
      // হচ্ছে, backend সেটা ধরে ফেলবে ("Section ... এর geometric
      // properties পাওয়া যায়নি" এরর দিয়ে)।
      properties = undefined;
    }
    return { ...section, properties };
  });

  return {
    elements,
    materials,
    sections: sectionsWithProperties,
    loadCases,
  };
}

/**
 * একটা element-end-force entry। এখন প্রতিটা entry তার আসল (frontend-
 * পরিচিত) elementId বহন করে — backend পক্ষ থেকে mid-span point load
 * এর কারণে element split হলে (analysis_orchestration.py এর
 * build_solver_model দেখুন), একটা original elementId একাধিক entry
 * তৈরি করতে পারে (প্রতিটা sub-element এর জন্য একটা), subStartRatio/
 * subEndRatio দিয়ে চিহ্নিত করা। Split না হলে প্রতিটা elementId এর
 * জন্য একটাই entry (subStartRatio=0, subEndRatio=1) — এটাই বেশিরভাগ
 * ক্ষেত্রে ঘটবে (mid-span load ছাড়া সব element এর জন্য)।
 *
 * UI তে দেখানোর সময়: একই elementId এর একাধিক entry থাকলে (split
 * হয়েছে), সেগুলোকে "element এর অংশ" হিসেবে group করে দেখানো উচিত,
 * একটা single element এর duplicate ফলাফল হিসেবে বিভ্রান্তিকরভাবে না
 * (যেমন একটা expandable "২টা অংশে বিভক্ত, mid-span load এর কারণে"
 * নোট সহ)।
 */
export interface ElementEndForce {
  elementId: string;
  subStartRatio: number;
  subEndRatio: number;
  startAxial: number;
  startShearY: number;
  startShearZ: number;
  startTorsion: number;
  startMomentY: number;
  startMomentZ: number;
  endAxial: number;
  endShearY: number;
  endShearZ: number;
  endTorsion: number;
  endMomentY: number;
  endMomentZ: number;
}

/**
 * একটা solver node এর coordinate (মিটার, backend এর internal unit)।
 * nodes[i] এর coordinate সরাসরি nodalDisplacements[i] (বা modeShape[i]/
 * finalNodalDisplacements[i] ইত্যাদি) এর সাথে positional ভাবে মেলে —
 * backend app/analysis_orchestration.py এর NodeGraph যে ক্রমে node
 * তৈরি করেছে সেই একই ক্রম (Phase 8a)। এর আগে backend শুধু nodeCount
 * (সংখ্যা) ফেরত দিত, কোন displacement index কোন প্রকৃত (x,y,z)/story
 * তা জানার কোনো উপায় ছিল না — mapNodesToStories() (nodeStoryMap.ts)
 * এই coordinate ব্যবহার করে story/grid গ্রুপিং বের করে।
 *
 * নোট: Y-axis উল্লম্ব (up) — backend এর boundary-condition heuristic
 * (Y≤1e-3 কে base support ধরা) ও frontend এর StructuralStory.elevation
 * উভয়ই এই convention অনুসরণ করে।
 */
export interface AnalysisNode {
  nodeId: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Phase 10n — একটা support node-এর reaction force (global coordinate,
 * kN/kN·m)। nodeIndex দিয়ে nodes[]-এর কোন node তা identify করা যায়
 * (backend boundaryConditions[i].nodeIndex, positionally reactionForces
 * এর সাথে একই ক্রমে — backend app/main.py::_build_linear_static_result_payload
 * এ pass-through)।
 */
export interface ReactionForce {
  nodeIndex: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface ParsedAnalysisResult {
  success: boolean;
  errorMessage?: string;
  nodalDisplacements?: {
    ux: number;
    uy: number;
    uz: number;
    rx: number;
    ry: number;
    rz: number;
  }[];
  elementEndForces?: ElementEndForce[];
  /** Phase 10n — শুধু Linear Static এ populate হয় (P-Delta/Nonlinear Static এ backend এখনো এই field পাঠায় না, সেগুলোর নিজস্ব inline dict-builder — ভবিষ্যতে একই প্যাটার্নে যোগ করা যাবে)। */
  reactionForces?: ReactionForce[];
  /** nodalDisplacements[i]-এর coordinate — index দিয়ে ম্যাচ করে (Phase 8a)। */
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

/** একটা mode shape — প্রতিটা node এর 6-DOF displacement (Modal) বা buckled shape (Buckling)। */
export interface ModeShapeEntry {
  ux: number;
  uy: number;
  uz: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface ModalMode {
  naturalFrequencyHz: number;
  angularFrequencyRadPerSec: number;
  modeShape: ModeShapeEntry[];
}

export interface ParsedModalResult {
  success: boolean;
  errorMessage?: string;
  numModesComputed?: number;
  modes?: ModalMode[];
  /** modes[i].modeShape[j]-এর coordinate — index দিয়ে ম্যাচ করে (Phase 8a)। */
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

export interface BucklingMode {
  criticalLoadFactor: number;
  bucklingModeShape: ModeShapeEntry[];
}

export interface ParsedBucklingResult {
  success: boolean;
  errorMessage?: string;
  numModesComputed?: number;
  modes?: BucklingMode[];
  /** modes[i].bucklingModeShape[j]-এর coordinate — index দিয়ে ম্যাচ করে (Phase 8a)। */
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

export interface ParsedPDeltaResult {
  success: boolean;
  errorMessage?: string;
  nodalDisplacements?: ParsedAnalysisResult["nodalDisplacements"];
  elementEndForces?: ElementEndForce[];
  firstOrderAxialForces?: number[];
  maxDisplacementAmplificationRatio?: number;
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

/** প্রতিটা mode এর RSA-নির্দিষ্ট অবদান — mass participation debugging/reporting এর জন্য। */
export interface ResponseSpectrumModalDetail {
  participationFactor: number;
  effectiveMass: number;
  spectralAccelerationG: number;
}

export interface ParsedResponseSpectrumResult {
  success: boolean;
  errorMessage?: string;
  /** CQC-combined peak displacement — সবসময় ≥0 (magnitude, sign/direction তথ্য নেই)। */
  nodalDisplacements?: ParsedAnalysisResult["nodalDisplacements"];
  /**
   * true হলে nodalDisplacements/elementEndForces CQC magnitude-only
   * (backend always true পাঠায় RSA এর জন্য, Phase 8a) — দুইটা story
   * এর displacement সরাসরি বিয়োগ করে Story Drift বের করা নিরাপদ না,
   * কারণ sign/direction তথ্য হারিয়ে গেছে। Drift Check (Phase 8c)
   * signed source (Linear Static/Nonlinear/P-Delta) থেকে হিসাব করে,
   * অথবা এই flag true থাকলে ব্যবহারকারীকে স্পষ্ট সতর্ক করে।
   */
  displacementIsMagnitudeOnly?: boolean;
  /** CQC-combined peak element end force — সবসময় ≥0 (magnitude)। */
  elementEndForces?: ElementEndForce[];
  baseShear?: number;
  totalMassParticipationRatio?: number;
  numModesComputed?: number;
  modalDetails?: ResponseSpectrumModalDetail[];
  /** nodalDisplacements[i]-এর coordinate — index দিয়ে ম্যাচ করে (Phase 8a)। */
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

/** একটা plastic hinge এর চূড়ান্ত (converged) অবস্থা — Nonlinear Static Analysis এর ফলাফলের অংশ। */
export interface PlasticHingeState {
  /** Phase 10r — backend sub_element_registry দিয়ে enrich করা, elementIndex (solver-internal, positional) এর সাথে না মিলিয়ে সরাসরি frontend elementId ব্যবহার করা যায়। */
  elementId: string;
  elementIndex: number;
  isAtStartNode: boolean;
  yielded: boolean;
  finalMomentKNm: number;
  plasticRotationRad: number;
}

export interface ParsedNonlinearStaticResult {
  success: boolean;
  errorMessage?: string;
  nodalDisplacements?: ParsedAnalysisResult["nodalDisplacements"];
  /** false — এই displacement signed (RSA এর CQC magnitude-only এর বিপরীতে), সরাসরি drift subtraction-safe। */
  displacementIsMagnitudeOnly?: boolean;
  elementEndForces?: ElementEndForce[];
  hingeStates?: PlasticHingeState[];
  totalLoadSteps?: number;
  totalNewtonIterations?: number;
  converged?: boolean;
  maxDisplacementAmplificationRatio?: number;
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

/** Pushover capacity curve এর একটা point — base shear (kN) বনাম control node এর displacement (m)। */
export interface PushoverCurvePoint {
  baseShearKN: number;
  controlDisplacementM: number;
  numHingesYielded: number;
}

export interface ParsedPushoverResult {
  success: boolean;
  errorMessage?: string;
  capacityCurve?: PushoverCurvePoint[];
  finalNodalDisplacements?: ParsedAnalysisResult["nodalDisplacements"];
  /** false — finalNodalDisplacements signed (Nonlinear Static এর মতো)। */
  displacementIsMagnitudeOnly?: boolean;
  finalElementEndForces?: ElementEndForce[];
  finalHingeStates?: PlasticHingeState[];
  reachedTargetDisplacement?: boolean;
  structureCollapsed?: boolean;
  totalPushSteps?: number;
  totalNewtonIterations?: number;
  nodes?: AnalysisNode[];
  nodeCount?: number;
  elementCount?: number;
  solveTimeSeconds?: number;
  warnings: string[];
}

/**
 * সম্পূর্ণ end-to-end flow: payload বানানো → submit → poll → ফলাফল
 * parse করা টাইপ-নিরাপদ shape এ। UI component এই একটা ফাংশন কল করলেই
 * চলে, backend response shape নিয়ে নিজে মাথা ঘামাতে হয় না।
 */
export async function runLinearStaticAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  supportOverrides?: SupportOverride[]
): Promise<ParsedAnalysisResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      { projectId, analysisType: "linear-static", modelPayload: payload, supportOverrides },
      { timeoutMs: 30000 }
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    nodalDisplacements: result.nodalDisplacements as ParsedAnalysisResult["nodalDisplacements"],
    elementEndForces: result.elementEndForces as ParsedAnalysisResult["elementEndForces"],
    reactionForces: result.reactionForces as ParsedAnalysisResult["reactionForces"],
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * Modal Analysis চালায় — natural frequency ও mode shape (কম্পন মোড)
 * বের করে। runLinearStaticAnalysis এর মতোই end-to-end flow, শুধু
 * ফলাফলের shape ভিন্ন (per-mode grouping, resultToDict এর বদলে
 * modalResultToDict — backend bindings.cpp দেখুন)।
 */
export async function runModalAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  numModes: number = 12,
  supportOverrides?: SupportOverride[]
): Promise<ParsedModalResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      { projectId, analysisType: "modal", modelPayload: payload, numModes, supportOverrides },
      { timeoutMs: 30000 }
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    numModesComputed: result.numModesComputed as number | undefined,
    modes: result.modes as ModalMode[] | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * Linear Buckling Analysis চালায় — critical load factor ও buckling
 * mode shape বের করে। loadCases অখালি থাকা আবশ্যক (backend এর
 * solveLinearBuckling() docstring অনুযায়ী — কোন load pattern এর
 * সাপেক্ষে buckling হচ্ছে তা জানা আবশ্যক), তাই এখানে
 * checkAnalysisRunnable এর মতোই একটা client-side precheck নেই কিন্তু
 * caller (UI) কে loadCases না থাকলে সতর্ক করা উচিত।
 */
export async function runBucklingAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  numModes: number = 6,
  supportOverrides?: SupportOverride[]
): Promise<ParsedBucklingResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      { projectId, analysisType: "buckling", modelPayload: payload, numModes, supportOverrides },
      { timeoutMs: 30000 }
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    numModesComputed: result.numModesComputed as number | undefined,
    modes: result.modes as BucklingMode[] | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * P-Delta (second-order geometric nonlinear static) Analysis চালায়।
 * loadCases অখালি থাকা আবশ্যক (Buckling এর মতোই কারণে)।
 */
export async function runPDeltaAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  supportOverrides?: SupportOverride[]
): Promise<ParsedPDeltaResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      { projectId, analysisType: "pdelta", modelPayload: payload, supportOverrides },
      { timeoutMs: 30000 }
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    nodalDisplacements: result.nodalDisplacements as ParsedPDeltaResult["nodalDisplacements"],
    elementEndForces: result.elementEndForces as ElementEndForce[] | undefined,
    firstOrderAxialForces: result.firstOrderAxialForces as number[] | undefined,
    maxDisplacementAmplificationRatio: result.maxDisplacementAmplificationRatio as number | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * Response Spectrum Analysis (RSA) চালায় — BNBC 2020 design spectrum
 * (seismicZone/siteClass থেকে backend স্বয়ংক্রিয়ভাবে তৈরি করে,
 * app/response_spectrum.py দেখুন) দিয়ে peak seismic response বের করে।
 *
 * ফলাফলের nodalDisplacements/elementEndForces সবসময় ≥0 (CQC peak
 * magnitude convention, ParsedResponseSpectrumResult এর docstring
 * দেখুন) — Linear Static/P-Delta এর মতো signed না।
 */
export async function runResponseSpectrumAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  options: {
    seismicZone: string;
    siteClass: string;
    directionDof?: number;
    dampingRatio?: number;
    numModes?: number;
    supportOverrides?: SupportOverride[];
  }
): Promise<ParsedResponseSpectrumResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      {
        projectId,
        analysisType: "response-spectrum",
        modelPayload: payload,
        seismicZone: options.seismicZone,
        siteClass: options.siteClass,
        directionDof: options.directionDof ?? 0,
        dampingRatio: options.dampingRatio ?? 0.05,
        numModes: options.numModes ?? 12,
        supportOverrides: options.supportOverrides,
      },
      { timeoutMs: 30000 }
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    nodalDisplacements: result.nodalDisplacements as ParsedResponseSpectrumResult["nodalDisplacements"],
    displacementIsMagnitudeOnly: (result.displacementIsMagnitudeOnly as boolean | undefined) ?? true,
    elementEndForces: result.elementEndForces as ElementEndForce[] | undefined,
    baseShear: result.baseShear as number | undefined,
    totalMassParticipationRatio: result.totalMassParticipationRatio as number | undefined,
    numModesComputed: result.numModesComputed as number | undefined,
    modalDetails: result.modalDetails as ResponseSpectrumModalDetail[] | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * Nonlinear Static Analysis (Concentrated Plastic Hinge পদ্ধতি) চালায়
 * — element এর hingeAtStart/hingeAtEnd ও section এর yieldMomentMzKNm
 * অনুযায়ী material yielding simulate করে, Load-Control Newton-Raphson
 * iteration দিয়ে। loadCases অখালি থাকা আবশ্যক (Buckling/P-Delta এর
 * মতোই কারণে — কোন load pattern এর সাপেক্ষে হিসাব হচ্ছে তা জানা
 * আবশ্যক)।
 */
export async function runNonlinearStaticAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  options: {
    numLoadSteps?: number;
    maxIterationsPerStep?: number;
    convergenceTolerance?: number;
    supportOverrides?: SupportOverride[];
  } = {}
): Promise<ParsedNonlinearStaticResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      {
        projectId,
        analysisType: "nonlinear-static",
        modelPayload: payload,
        numLoadSteps: options.numLoadSteps ?? 10,
        maxIterationsPerStep: options.maxIterationsPerStep ?? 30,
        convergenceTolerance: options.convergenceTolerance ?? 1e-4,
        supportOverrides: options.supportOverrides,
      },
      { timeoutMs: 45000 } // iterative solve, Linear Static/Modal এর চেয়ে বেশি সময় লাগতে পারে
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "অজানা নেটওয়ার্ক এরর",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis ব্যর্থ হয়েছে, কারণ অজানা",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "Backend থেকে কোনো ফলাফল আসেনি", warnings: [] };
  }

  return {
    success: true,
    nodalDisplacements: result.nodalDisplacements as ParsedNonlinearStaticResult["nodalDisplacements"],
    displacementIsMagnitudeOnly: (result.displacementIsMagnitudeOnly as boolean | undefined) ?? false,
    elementEndForces: result.elementEndForces as ElementEndForce[] | undefined,
    hingeStates: result.hingeStates as PlasticHingeState[] | undefined,
    totalLoadSteps: result.totalLoadSteps as number | undefined,
    totalNewtonIterations: result.totalNewtonIterations as number | undefined,
    converged: result.converged as boolean | undefined,
    maxDisplacementAmplificationRatio: result.maxDisplacementAmplificationRatio as number | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}

/**
 * Pushover Analysis চালায় — একটা fixed lateral load pattern (loadCases
 * থেকে) ধীরে ধীরে push করে target displacement এ পৌঁছানো বা structure
 * collapse হওয়া পর্যন্ত, capacity curve (base shear vs control-node
 * displacement) capture করে। controlPoint এর coordinate দিয়ে backend
 * নিজে node index resolve করে (raw solver node index frontend থেকে
 * predict করা সম্ভব না, backend এর node-merging/split ordering internal)।
 * loadCases অখালি থাকা আবশ্যক (lateral load pattern ছাড়া push করার
 * কিছু নেই)।
 */
export async function runPushoverAnalysis(
  projectId: string,
  elements: StructuralElement[],
  materials: StructuralMaterial[],
  sections: StructuralSection[],
  loadCases: LoadCase[],
  options: {
    controlPoint: { x: number; y: number; z: number };
    controlDof?: number;
    targetControlDisplacementM: number;
    loadStepIncrement?: number;
    maxPushSteps?: number;
    maxIterationsPerStep?: number;
    convergenceTolerance?: number;
    supportOverrides?: SupportOverride[];
  }
): Promise<ParsedPushoverResult> {
  const payload = buildAnalysisPayload(elements, materials, sections, loadCases);

  let jobStatus: JobStatusResponse;
  try {
    jobStatus = await submitAndAwaitJob(
      {
        projectId,
        analysisType: "pushover",
        modelPayload: payload,
        controlPointX: options.controlPoint.x,
        controlPointY: options.controlPoint.y,
        controlPointZ: options.controlPoint.z,
        controlDof: options.controlDof ?? 2,
        targetControlDisplacementM: options.targetControlDisplacementM,
        loadStepIncrement: options.loadStepIncrement ?? 0.02,
        maxPushSteps: options.maxPushSteps ?? 200,
        maxIterationsPerStep: options.maxIterationsPerStep ?? 30,
        convergenceTolerance: options.convergenceTolerance ?? 1e-4,
        supportOverrides: options.supportOverrides,
      },
      { timeoutMs: 60000 } // adaptive push, up to maxPushSteps Newton-Raphson solves — Nonlinear Static এর চেয়েও বেশি সময় লাগতে পারে
    );
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown network error",
      warnings: [],
    };
  }

  if (jobStatus.status === "failed") {
    return {
      success: false,
      errorMessage: jobStatus.error ?? "Analysis failed for an unknown reason",
      warnings: [],
    };
  }

  const result = jobStatus.result;
  if (!result) {
    return { success: false, errorMessage: "No result returned from backend", warnings: [] };
  }

  return {
    success: true,
    capacityCurve: result.capacityCurve as PushoverCurvePoint[] | undefined,
    finalNodalDisplacements: result.finalNodalDisplacements as ParsedPushoverResult["finalNodalDisplacements"],
    displacementIsMagnitudeOnly: (result.displacementIsMagnitudeOnly as boolean | undefined) ?? false,
    finalElementEndForces: result.finalElementEndForces as ElementEndForce[] | undefined,
    finalHingeStates: result.finalHingeStates as PlasticHingeState[] | undefined,
    reachedTargetDisplacement: result.reachedTargetDisplacement as boolean | undefined,
    structureCollapsed: result.structureCollapsed as boolean | undefined,
    totalPushSteps: result.totalPushSteps as number | undefined,
    totalNewtonIterations: result.totalNewtonIterations as number | undefined,
    nodes: result.nodes as AnalysisNode[] | undefined,
    nodeCount: result.nodeCount as number | undefined,
    elementCount: result.elementCount as number | undefined,
    solveTimeSeconds: result.solveTimeSeconds as number | undefined,
    warnings: (result.warnings as string[] | undefined) ?? [],
  };
}
