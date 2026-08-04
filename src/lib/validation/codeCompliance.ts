/**
 * Code Compliance Checker
 * Phase 5 — Master Plan: "Code Compliance Checker"
 *
 * এই ধাপে কোনো rebar/capacity design check নেই (সেটা Phase 6 Design
 * Engine এর কাজ, যা এখনো নেই) — এখানে শুধু geometry-level preliminary
 * sanity check, যা BNBC 2020 / ACI 318-19 এর সাধারণভাবে পরিচিত
 * ন্যূনতম-ডাইমেনশন নিয়ম ও একটা মোটা span/depth heads-up দেয়। এগুলো
 * কোনো "compliance guarantee" না — বরং সাধারণ ভুল early ধরার জন্য
 * (যেমন ভুলে খুবই ছোট section বসানো)। সবগুলো severity "warning" বা
 * "info", কখনো "error" না — কারণ প্রতিটা নিয়মেরই ব্যতিক্রম প্রয়োগযোগ্য
 * পরিস্থিতি থাকতে পারে (বিশেষায়িত ডিজাইন, ইঞ্জিনিয়ারের বিচার), তাই
 * এই টুল ব্লক করবে না, শুধু flag করবে।
 *
 * ACI 318-19 / BNBC 2020 রেফারেন্স ব্যবহৃত:
 *   - ACI 318-19 §9.6.1 / BNBC 2020: বিম-এর ন্যূনতম প্রস্থ প্রচলিতভাবে
 *     ~250mm ধরা হয় সাধারণ RC building practice এ (code একটা exact
 *     সংখ্যা mandate করে না, বরং moment/shear capacity থেকে derive
 *     হয় — এই চেক তাই একটা practice-based heuristic, code clause না)
 *   - Column-এর ন্যূনতম dimension প্রচলিতভাবে ~250mm (non-seismic) বা
 *     ~300mm (seismic detailing প্রযোজ্য হলে) ধরা হয়
 *   - Span/depth ratio: ACI 318-19 Table 9.3.1.1 এর deflection-control
 *     minimum thickness নিয়মের একটা সরলীকৃত সংস্করণ (সাধারণ থাম্ব-রুল:
 *     simply-supported beam span/depth ≤ ~16, cantilever ≤ ~8) —
 *     প্রকৃত deflection check (creep/shrinkage/load-dependent) এই
 *     চেকের আওতায় না, শুধু একটা preliminary heads-up
 */

import type { StructuralElement } from "@/lib/types/element";
import type { StructuralSection } from "@/lib/types/section";
import type { ValidationIssue } from "@/lib/validation/types";

const MIN_BEAM_WIDTH_MM = 250;
const MIN_COLUMN_DIMENSION_MM = 250;
const MAX_SPAN_TO_DEPTH_SIMPLE = 16;

function getRectangularDims(section: StructuralSection): { width: number; depth: number } | null {
  if (section.shape === "rectangular") {
    return { width: section.width, depth: section.depth };
  }
  return null;
}

function elementLength(e: { startPoint: { x: number; y: number; z: number }; endPoint: { x: number; y: number; z: number } }): number {
  const dx = e.endPoint.x - e.startPoint.x;
  const dy = e.endPoint.y - e.startPoint.y;
  const dz = e.endPoint.z - e.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Beam-এর ন্যূনতম প্রস্থ check — শুধু rectangular RC section-এর জন্য
 * প্রযোজ্য (steel/other shape ভিন্ন নিয়মে চলে, এই heuristic শুধু
 * সাধারণ RC beam practice এর জন্য)।
 */
export function checkMinimumBeamWidth(
  elements: StructuralElement[],
  sections: StructuralSection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sectionById = new Map(sections.map((s) => [s.sectionId, s]));

  for (const e of elements) {
    if (e.category !== "beam" || !("sectionId" in e)) continue;
    const section = sectionById.get(e.sectionId);
    if (!section) continue;
    const dims = getRectangularDims(section);
    if (!dims) continue;

    if (dims.width < MIN_BEAM_WIDTH_MM) {
      issues.push({
        id: `code-compliance:${e.elementId}:min-beam-width`,
        severity: "warning",
        category: "code-compliance",
        message: `Beam "${e.label}" has width ${dims.width}mm, below the common ${MIN_BEAM_WIDTH_MM}mm practice minimum for RC beams — verify this is intentional.`,
        elementIds: [e.elementId],
      });
    }
  }

  return issues;
}

/**
 * Column-এর ন্যূনতম dimension check — rectangular ও circular উভয়ের
 * জন্য।
 */
export function checkMinimumColumnDimension(
  elements: StructuralElement[],
  sections: StructuralSection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sectionById = new Map(sections.map((s) => [s.sectionId, s]));

  for (const e of elements) {
    if (e.category !== "column" || !("sectionId" in e)) continue;
    const section = sectionById.get(e.sectionId);
    if (!section) continue;

    let minDim: number | null = null;
    if (section.shape === "rectangular") {
      minDim = Math.min(section.width, section.depth);
    } else if (section.shape === "circular") {
      minDim = section.diameter;
    }
    if (minDim === null) continue;

    if (minDim < MIN_COLUMN_DIMENSION_MM) {
      issues.push({
        id: `code-compliance:${e.elementId}:min-column-dimension`,
        severity: "warning",
        category: "code-compliance",
        message: `Column "${e.label}" has minimum dimension ${minDim}mm, below the common ${MIN_COLUMN_DIMENSION_MM}mm practice minimum for RC columns — verify this is intentional.`,
        elementIds: [e.elementId],
      });
    }
  }

  return issues;
}

/**
 * Span/depth ratio heads-up — শুধু rectangular section beam-এর জন্য।
 * এটা প্রকৃত deflection calculation না (load, support condition,
 * creep/shrinkage বিবেচনা করে না) — শুধু ACI Table 9.3.1.1-এর
 * সরলীকৃত থাম্ব-রুল, ইঞ্জিনিয়ারকে একটা early heads-up দেওয়ার জন্য।
 */
export function checkSpanToDepthRatio(
  elements: StructuralElement[],
  sections: StructuralSection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sectionById = new Map(sections.map((s) => [s.sectionId, s]));

  for (const e of elements) {
    if (e.category !== "beam" || !("sectionId" in e) || !("startPoint" in e)) continue;
    const section = sectionById.get(e.sectionId);
    if (!section) continue;
    const dims = getRectangularDims(section);
    if (!dims || dims.depth <= 0) continue;

    const spanMm = elementLength(e) * 1000;
    const ratio = spanMm / dims.depth;

    if (ratio > MAX_SPAN_TO_DEPTH_SIMPLE) {
      issues.push({
        id: `code-compliance:${e.elementId}:span-depth-ratio`,
        severity: "info",
        category: "code-compliance",
        message: `Beam "${e.label}" has span/depth ratio ≈${ratio.toFixed(1)} (common simply-supported guideline: ≤${MAX_SPAN_TO_DEPTH_SIMPLE}) — deflection may govern; this is a preliminary heads-up, not a full deflection check.`,
        elementIds: [e.elementId],
      });
    }
  }

  return issues;
}

/** Code Compliance Checker এর সব সাব-চেক একসাথে চালায়। */
export function runCodeComplianceChecks(
  elements: StructuralElement[],
  sections: StructuralSection[]
): ValidationIssue[] {
  return [
    ...checkMinimumBeamWidth(elements, sections),
    ...checkMinimumColumnDimension(elements, sections),
    ...checkSpanToDepthRatio(elements, sections),
  ];
}
