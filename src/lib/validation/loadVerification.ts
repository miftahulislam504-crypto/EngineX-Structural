/**
 * Load Verification
 * Phase 5 — Master Plan: "Load Verification"
 *
 * Load Case/Pattern গুলো Elements ও Load Pattern library কে সঠিকভাবে
 * reference করছে কিনা, এবং মান-গুলো (intensity, positionRatio) sane
 * range এ আছে কিনা — এসব যাচাই করে। কোনো একটাও analysis চালায় না,
 * শুধু ডেটা-লেভেল ভুল ধরে (যেমন একটা element ডিলিট হয়ে গেছে কিন্তু
 * তার load case থেকে গেছে — "dangling reference")।
 */

import type { StructuralElement } from "@/lib/types/element";
import type { LoadCase, LoadPattern } from "@/lib/types/load";
import type { ValidationIssue } from "@/lib/validation/types";

const AREA_CATEGORIES = new Set(["slab", "wall", "shear-wall", "core-wall"]);

/**
 * Dangling reference check — প্রতিটা LoadCase একটা বৈধ elementId ও
 * patternId কে point করছে কিনা। Element বা Pattern ডিলিট হয়ে গেলে
 * (কিন্তু সংশ্লিষ্ট LoadCase না থাকলে) এই ভুল ধরা পড়ে।
 */
export function checkLoadReferences(
  loadCases: LoadCase[],
  elements: StructuralElement[],
  patterns: LoadPattern[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const elementIds = new Set(elements.map((e) => e.elementId));
  const patternIds = new Set(patterns.map((p) => p.patternId));

  for (const lc of loadCases) {
    if (!elementIds.has(lc.elementId)) {
      issues.push({
        id: `load-reference:${lc.loadCaseId}:element`,
        severity: "error",
        category: "load-reference",
        message: `A ${lc.applicationType} load case references element "${lc.elementId}", which no longer exists in the model.`,
      });
    }
    if (!patternIds.has(lc.patternId)) {
      issues.push({
        id: `load-reference:${lc.loadCaseId}:pattern`,
        severity: "error",
        category: "load-reference",
        message: `A ${lc.applicationType} load case references load pattern "${lc.patternId}", which no longer exists.`,
      });
    }
  }

  return issues;
}

/**
 * Solver-limitation early warning — একটা Point Load যদি Slab/Wall/
 * Shear-Wall/Core-Wall element কে target করে, backend সেটা silently
 * drop করে (shell element এ load application এখনো সমর্থিত না)। এই
 * চেক সেই একই শর্ত frontend এ আগেভাগে ধরে, যাতে ইউজার analysis
 * চালানোর আগেই জানতে পারেন কেন সেই load ফলাফলে প্রভাব ফেলবে না।
 */
export function checkShellPointLoads(
  loadCases: LoadCase[],
  elements: StructuralElement[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const areaElementIds = new Map(
    elements.filter((e) => AREA_CATEGORIES.has(e.category)).map((e) => [e.elementId, e])
  );

  for (const lc of loadCases) {
    if (lc.applicationType === "point" && areaElementIds.has(lc.elementId)) {
      const target = areaElementIds.get(lc.elementId)!;
      issues.push({
        id: `solver-limitation:${lc.loadCaseId}:shell-point-load`,
        severity: "warning",
        category: "solver-limitation",
        message: `A Point Load targets "${target.label}" (${target.category}) — point loads on Slab/Wall/Shear-Wall/Core-Wall elements are not yet applied by the solver and will be dropped.`,
        elementIds: [target.elementId],
      });
    }
  }

  return issues;
}

/**
 * Load-value sanity — positionRatio 0..1 এর বাইরে, বা zero-intensity
 * load case (যা কোনো প্রভাব ফেলে না, সাধারণত ভুলে খালি রেখে দেওয়ার
 * ফল) ধরে।
 */
export function checkLoadSanity(loadCases: LoadCase[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const lc of loadCases) {
    if (lc.applicationType === "point") {
      if (lc.positionRatio < 0 || lc.positionRatio > 1) {
        issues.push({
          id: `load-sanity:${lc.loadCaseId}:position-ratio`,
          severity: "error",
          category: "load-sanity",
          message: `A point load has positionRatio ${lc.positionRatio.toFixed(2)}, outside the valid 0–1 range.`,
        });
      }
      if (lc.forceX === 0 && lc.forceY === 0 && lc.forceZ === 0) {
        issues.push({
          id: `load-sanity:${lc.loadCaseId}:zero-force`,
          severity: "warning",
          category: "load-sanity",
          message: "A point load case has zero force in all directions — it has no effect on the analysis.",
        });
      }
    } else if (lc.applicationType === "uniform-line") {
      if (
        lc.intensityY === 0 &&
        (lc.intensityX === undefined || lc.intensityX === 0) &&
        (lc.intensityZ === undefined || lc.intensityZ === 0)
      ) {
        issues.push({
          id: `load-sanity:${lc.loadCaseId}:zero-intensity`,
          severity: "warning",
          category: "load-sanity",
          message: "A uniform line load case has zero intensity in all directions — it has no effect on the analysis.",
        });
      }
    } else if (lc.applicationType === "uniform-area") {
      if (lc.intensity === 0) {
        issues.push({
          id: `load-sanity:${lc.loadCaseId}:zero-intensity`,
          severity: "warning",
          category: "load-sanity",
          message: "A uniform area load case has zero intensity — it has no effect on the analysis.",
        });
      }
    }
  }

  return issues;
}

/**
 * Missing dead load — বাস্তবসম্মত কোনো building model-এ অন্তত একটা
 * Dead Load pattern থাকা উচিত (নিজস্ব ওজন ছাড়া কোনো বাস্তব ভবন নেই)।
 * এটা error না, warning — কারণ কিছু বিশেষায়িত সাব-মডেল (উদাহরণ: শুধু
 * lateral system এর একটা isolated study) legitimately dead load ছাড়া
 * চালানো যেতে পারে।
 */
export function checkDeadLoadPresence(patterns: LoadPattern[]): ValidationIssue[] {
  const hasDeadLoad = patterns.some((p) => p.category === "dead");
  if (!hasDeadLoad) {
    return [
      {
        id: "load-sanity:no-dead-load",
        severity: "warning",
        category: "load-sanity",
        message: "No Dead Load pattern is defined — a real building model should normally include self-weight/dead load.",
      },
    ];
  }
  return [];
}

/** Load Verification এর সব সাব-চেক একসাথে চালায়। */
export function runLoadVerification(
  loadCases: LoadCase[],
  elements: StructuralElement[],
  patterns: LoadPattern[]
): ValidationIssue[] {
  return [
    ...checkLoadReferences(loadCases, elements, patterns),
    ...checkShellPointLoads(loadCases, elements),
    ...checkLoadSanity(loadCases),
    ...checkDeadLoadPresence(patterns),
  ];
}
