/**
 * Model Validation & Quality Control — Types
 * Phase 5 (Master Plan Section 17)
 *
 * এই মডিউল Analysis (Phase 4) চালানোর আগে/পরে মডেলের স্বাস্থ্য যাচাই
 * করে — geometry connectivity, load reference integrity, material/
 * section reference integrity, এবং কিছু বেসিক code-compliance sanity
 * check। এটা Design Engine (Phase 6, rebar/capacity design check) না —
 * তার আগের ধাপ: "মডেলটা সলভ করার মতো সুস্থ কিনা" তা নিশ্চিত করা।
 *
 * severity তিন স্তরে ভাগ করা হয়েছে backend এর ✅/⚠️/ℹ️ warning কনভেনশন
 * অনুসরণ করে (analysis_orchestration.py দেখুন):
 *   - "error": মডেল ভুল/অসম্পূর্ণ, analysis সঠিক ফলাফল দেবে না বা
 *     আদৌ চলবে না (যেমন dangling material reference, কোনো support নেই)
 *   - "warning": মডেল চলবে কিন্তু একটা known caveat/limitation প্রযোজ্য
 *     (যেমন Footing analysis এ ধরা পড়ে না, single-end pin সমর্থিত না)
 *   - "info": সচেতনতামূলক নোট, ভুল নয় (যেমন unusual কিন্তু বৈধ geometry)
 */

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationCategory =
  | "connectivity" // floating member, disconnected node
  | "duplicate" // duplicate element/coordinate
  | "geometry" // zero-length, degenerate polygon
  | "support" // boundary condition / base support
  | "load-reference" // dangling elementId/patternId reference
  | "load-sanity" // out-of-range intensity/positionRatio, missing dead load
  | "reference-integrity" // dangling materialId/sectionId
  | "solver-limitation" // known solver caveat surfaced early (Footing skip, shell point load, single-end pin)
  | "code-compliance"; // BNBC/ACI geometry-level sanity (min dimension, span/depth)

export interface ValidationIssue {
  id: string; // stable id: `${category}:${elementId-or-key}` — UI dedup/key এর জন্য
  severity: ValidationSeverity;
  category: ValidationCategory;
  message: string; // ইংরেজিতে (English-only UI কনভেনশন অনুসরণ করে)
  elementIds?: string[]; // প্রাসঙ্গিক element(s), viewport highlight এর জন্য ভবিষ্যতে কাজে লাগবে
}

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  healthScore: number; // 0-100
  generatedAt: string;
}

/** severity অনুযায়ী issue গুলো গুনে ValidationReport বানায়। */
export function buildValidationReport(issues: ValidationIssue[]): ValidationReport {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    healthScore: computeHealthScore(errorCount, warningCount, infoCount),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Model Health Score — 100 থেকে শুরু করে প্রতিটা issue এর severity
 * অনুযায়ী পয়েন্ট কাটা হয় (error ভারী penalty, warning মাঝারি, info
 * সামান্য), 0 এর নিচে যাবে না। এটা একটা heuristic scoring, কোনো
 * standardized/code-mandated সূত্র না — উদ্দেশ্য হলো ইঞ্জিনিয়ারকে
 * এক নজরে মডেলের সার্বিক অবস্থা বোঝানো, প্রতিটা issue নিজে পড়ার
 * আগে।
 *
 * ওজন: error = 15, warning = 5, info = 1। একটামাত্র error থাকলেও
 * score লক্ষণীয়ভাবে নামবে (85), যেখানে অনেকগুলো info থাকলেও score
 * উঁচুই থাকবে — কারণ error সাধারণত সলভ ব্যর্থ/ভুল ফলাফল নির্দেশ করে,
 * যা info-level নোটের চেয়ে গুণগতভাবে ভিন্ন গুরুত্বের।
 */
function computeHealthScore(errorCount: number, warningCount: number, infoCount: number): number {
  const raw = 100 - errorCount * 15 - warningCount * 5 - infoCount * 1;
  return Math.max(0, Math.min(100, raw));
}
