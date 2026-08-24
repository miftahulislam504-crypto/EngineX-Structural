/**
 * Model Checker
 * Phase 5 — Master Plan: "Model Checker, Connectivity Check, Floating
 * Member Detection, Duplicate Element Detection"
 *
 * এই চেকগুলো সম্পূর্ণ geometry-driven, কোনো load/analysis লাগে না —
 * তাই elements-only ইনপুট নিয়ে কাজ করে। কোঅর্ডিনেট merge-এর কনভেনশন
 * backend এর NodeGraph (analysis_orchestration.py) এর সাথে সামঞ্জস্যপূর্ণ
 * রাখা হয়েছে ইচ্ছাকৃতভাবে: 3-decimal rounding দিয়ে coordinate key
 * বানানো — যাতে "connected" কী বোঝায় তা frontend validation ও backend
 * solver-এ একই থাকে (একটা মডেল frontend এ "connected" দেখালে backend
 * এও একই node এ merge হবে, এবং উল্টোটাও)।
 */

import type { StructuralElement } from "@/lib/types/element";
import { computePolygonAreaAnyPlane } from "@/lib/types/element";
import type { ValidationIssue } from "@/lib/validation/types";

/** backend এর NodeGraph.index_of() এর সাথে সামঞ্জস্যপূর্ণ 3-decimal coordinate key। */
function coordKey(x: number, y: number, z: number): string {
  return `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
}

function isLineElement(
  e: StructuralElement
): e is Extract<StructuralElement, { startPoint: { x: number; y: number; z: number } }> {
  return "startPoint" in e && "endPoint" in e;
}

function isAreaElement(
  e: StructuralElement
): e is Extract<StructuralElement, { vertices: { x: number; y: number; z: number }[] }> {
  return "vertices" in e;
}

/**
 * Connectivity + Floating Member Detection।
 *
 * প্রতিটা line element endpoint থেকে একটা coordinate→elementIds ম্যাপ
 * বানানো হয়। একটা line element কে "floating" (বিচ্ছিন্ন) ধরা হয় যদি
 * তার দুই প্রান্তের কোনোটাই অন্য কোনো element এর সাথে শেয়ার না হয়
 * (নিজের ছাড়া) এবং কোনো প্রান্তই base level (Y≈0) এ না থাকে — কারণ
 * base-level প্রান্ত backend এ auto-support পায়, তাই সেটা "বিচ্ছিন্ন"
 * না, বরং legitimate cantilever/isolated-column-on-support হতে পারে।
 *
 * Area element (Slab/Wall) এর জন্য connectivity check সরল করা হয়েছে:
 * অন্তত একটা vertex যদি কোনো line element endpoint, অন্য কোনো area
 * element এর vertex (wall-to-wall corner, wall-to-slab base ইত্যাদি),
 * বা base level এর সাথে না মেলে, সেটা "possibly floating" হিসেবে
 * info-level এ flag হয় (error না, কারণ area element এর mesh-generated
 * internal node গুলো এমনিতেই কোনো line endpoint এর সাথে মিলবে না —
 * এটা একটা heuristic হিসেবে conservative রাখা হয়েছে, false positive
 * এড়াতে)।
 */
export function checkConnectivity(elements: StructuralElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lineElements = elements.filter(isLineElement);

  const coordUsage = new Map<string, string[]>();
  for (const e of lineElements) {
    for (const p of [e.startPoint, e.endPoint]) {
      const key = coordKey(p.x, p.y, p.z);
      const list = coordUsage.get(key) ?? [];
      list.push(e.elementId);
      coordUsage.set(key, list);
    }
  }

  for (const e of lineElements) {
    const startKey = coordKey(e.startPoint.x, e.startPoint.y, e.startPoint.z);
    const endKey = coordKey(e.endPoint.x, e.endPoint.y, e.endPoint.z);
    const startShared = (coordUsage.get(startKey)?.length ?? 0) > 1;
    const endShared = (coordUsage.get(endKey)?.length ?? 0) > 1;
    const startAtBase = e.startPoint.y <= 1e-3;
    const endAtBase = e.endPoint.y <= 1e-3;

    if (!startShared && !endShared && !startAtBase && !endAtBase) {
      issues.push({
        id: `connectivity:${e.elementId}`,
        severity: "error",
        category: "connectivity",
        message: `${elementLabel(e)} is not connected to any other element and does not touch base level (Y≈0) — it is fully floating and will not be supported by the solver.`,
        elementIds: [e.elementId],
      });
    } else if (!startShared && !startAtBase) {
      issues.push({
        id: `connectivity:${e.elementId}:start`,
        severity: "warning",
        category: "connectivity",
        message: `${elementLabel(e)}'s start point is not connected to any other element or base level — check for a missing member or misaligned coordinate.`,
        elementIds: [e.elementId],
      });
    } else if (!endShared && !endAtBase) {
      issues.push({
        id: `connectivity:${e.elementId}:end`,
        severity: "warning",
        category: "connectivity",
        message: `${elementLabel(e)}'s end point is not connected to any other element or base level — check for a missing member or misaligned coordinate.`,
        elementIds: [e.elementId],
      });
    }
  }

  // বাগফিক্স: আগে coordUsage শুধু line-element (Beam/Column) endpoint
  // দিয়ে বানানো হতো, তাই এই নিচের area-element heuristic কোনো wall-to-
  // wall বা wall-to-slab shared-edge connectivity চিনতোই না — একটা
  // সম্পূর্ণ সংযুক্ত wall (যেমন corner-এ আরেকটা wall-এর সাথে জোড়া লাগা,
  // বা slab-এর বেসে বসা) শুধু কোনো column/beam node স্পর্শ না করলেই
  // "no vertex matching" info পেত, যা প্রতিটা প্রায় সাধারণ wall-এই আসত
  // (false positive, যদিও severity "info" বলে ব্লক করত না)। এখন প্রতিটা
  // area-element vertex-ও coordUsage-এ যোগ করা হচ্ছে (নিজের elementId
  // সহ), যাতে area-to-area shared vertex সঠিকভাবে "connected" ধরা যায় —
  // heuristic এখনো conservative থাকছে (edge-এর মাঝামাঝি কোনো vertex
  // ছাড়া touch এখনও ধরবে না), কিন্তু সবচেয়ে সাধারণ কেস (wall corner,
  // wall-slab base) আর false-flag হবে না।
  const areaElements = elements.filter(isAreaElement);
  for (const e of areaElements) {
    for (const v of e.vertices) {
      const key = coordKey(v.x, v.y, v.z);
      const list = coordUsage.get(key) ?? [];
      list.push(e.elementId);
      coordUsage.set(key, list);
    }
  }

  for (const e of areaElements) {
    const anyVertexConnectedOrBase = e.vertices.some((v) => {
      const key = coordKey(v.x, v.y, v.z);
      const usedBy = coordUsage.get(key) ?? [];
      // নিজের ছাড়া অন্তত আরেকটা element (line বা area) এই coordinate
      // শেয়ার করছে কিনা — নিজের নিজের vertex গোনা (যা এখন coordUsage-এ
      // নিজেই যোগ হয়েছে) "connected" হিসেবে ধরা ঠিক না।
      const sharedWithOther = usedBy.some((id) => id !== e.elementId);
      return sharedWithOther || v.y <= 1e-3;
    });
    if (!anyVertexConnectedOrBase) {
      issues.push({
        id: `connectivity:${e.elementId}:area`,
        severity: "info",
        category: "connectivity",
        message: `${elementLabel(e)} has no vertex matching another element's node or base level — verify it is actually attached to the structure.`,
        elementIds: [e.elementId],
      });
    }
  }

  return issues;
}

/**
 * Duplicate Element Detection — একই ধরনের element একই জ্যামিতিতে
 * দুইবার আছে কিনা (সাধারণত ভুলে ডাবল-ক্লিক/ডাবল-ড্র করার ফল, যা
 * analysis এ দ্বিগুণ stiffness/mass যোগ করবে — নীরব কিন্তু গুরুত্বপূর্ণ
 * ভুল)।
 *
 * Line elements: category + start + end coordinate (উভয় দিক — A→B ও
 * B→A একই member ধরা হয়)। Area elements: category + vertex count +
 * vertex coordinate set (order-independent, কারণ একই polygon ভিন্ন
 * starting vertex দিয়ে আঁকা যেতে পারে)।
 */
export function checkDuplicates(elements: StructuralElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const lineGroups = new Map<string, string[]>();
  for (const e of elements.filter(isLineElement)) {
    const a = coordKey(e.startPoint.x, e.startPoint.y, e.startPoint.z);
    const b = coordKey(e.endPoint.x, e.endPoint.y, e.endPoint.z);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${e.category}|${lo}|${hi}`;
    const list = lineGroups.get(key) ?? [];
    list.push(e.elementId);
    lineGroups.set(key, list);
  }

  for (const [, ids] of lineGroups) {
    if (ids.length > 1) {
      issues.push({
        id: `duplicate:line:${ids.join(",")}`,
        severity: "error",
        category: "duplicate",
        message: `${ids.length} elements occupy the exact same geometry (${ids.join(", ")}) — likely a duplicate draw, which will double the stiffness/mass in analysis.`,
        elementIds: ids,
      });
    }
  }

  const areaGroups = new Map<string, string[]>();
  for (const e of elements.filter(isAreaElement)) {
    const sortedCoords = e.vertices
      .map((v) => coordKey(v.x, v.y, v.z))
      .sort()
      .join(";");
    const key = `${e.category}|${e.vertices.length}|${sortedCoords}`;
    const list = areaGroups.get(key) ?? [];
    list.push(e.elementId);
    areaGroups.set(key, list);
  }

  for (const [, ids] of areaGroups) {
    if (ids.length > 1) {
      issues.push({
        id: `duplicate:area:${ids.join(",")}`,
        severity: "error",
        category: "duplicate",
        message: `${ids.length} elements share the exact same vertices (${ids.join(", ")}) — likely a duplicate draw.`,
        elementIds: ids,
      });
    }
  }

  return issues;
}

/**
 * Geometry sanity — zero-length line element, degenerate (< 3 unique
 * vertex, বা zero-area) polygon। এগুলো সাধারণত UI-তে accidental click
 * থেকে আসে (একই বিন্দুতে দুইবার ক্লিক করে element শেষ করা)।
 */
export function checkGeometry(elements: StructuralElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ZERO_LENGTH_TOLERANCE_M = 1e-3;

  for (const e of elements.filter(isLineElement)) {
    const dx = e.endPoint.x - e.startPoint.x;
    const dy = e.endPoint.y - e.startPoint.y;
    const dz = e.endPoint.z - e.startPoint.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length <= ZERO_LENGTH_TOLERANCE_M) {
      issues.push({
        id: `geometry:${e.elementId}:zero-length`,
        severity: "error",
        category: "geometry",
        message: `${elementLabel(e)} has zero (or near-zero) length — start and end points coincide.`,
        elementIds: [e.elementId],
      });
    }
  }

  for (const e of elements.filter(isAreaElement)) {
    const uniqueCoords = new Set(e.vertices.map((v) => coordKey(v.x, v.y, v.z)));
    if (uniqueCoords.size < 3) {
      issues.push({
        id: `geometry:${e.elementId}:degenerate-polygon`,
        severity: "error",
        category: "geometry",
        message: `${elementLabel(e)} has fewer than 3 unique vertices — not a valid polygon.`,
        elementIds: [e.elementId],
      });
      continue;
    }
    // বাগফিক্স: আগে এখানে computePlanAreaXZ() (শুধু X,Z ব্যবহার করে
    // shoelace) দিয়ে সব area element (Slab/Wall/ShearWall/CoreWall/Stair)
    // চেক হতো। এটা Slab-এর জন্য ঠিক (Slab সবসময় অনুভূমিক, তাই তার ৪+
    // vertex সত্যিকারের ভিন্ন X,Z-এ থাকে), কিন্তু Wall/ShearWall/CoreWall
    // উল্লম্ব সমতলে থাকে — hub-geometry-parser.ts এর mapWall() vertices
    // বানায় [startBase, endBase, endTop, startTop] হিসেবে, যেখানে
    // startBase.x===startTop.x এবং endBase.x===endTop.x (একই কারণে Z-ও),
    // শুধু Y (elevation) আলাদা। ফলে X,Z প্রজেকশনে চারটা vertex মাত্র
    // দুইটা ইউনিক বিন্দুতে পড়ে যায় (collinear), আর shoelace সবসময় ~0
    // দিত — প্রতিটা legitimate, non-degenerate wall-ই false positive
    // "zero plan area" error পেত (Stair-এর inclined waist-slab-ও একই
    // কারণে প্রভাবিত)। সমাধান: polygon যেই সমতলে আসলে আছে সেই সমতলে
    // area মাপা (computePolygonAreaAnyPlane — 3D cross-product ভিত্তিক,
    // vertical বা tilted পলিগনেও সঠিক), শুধু XZ-প্রজেকশনে না।
    if (computePolygonAreaAnyPlane(e.vertices) <= 1e-6) {
      issues.push({
        id: `geometry:${e.elementId}:zero-area`,
        severity: "error",
        category: "geometry",
        message: `${elementLabel(e)} has zero (or near-zero) area — vertices may be collinear.`,
        elementIds: [e.elementId],
      });
    }
  }

  return issues;
}

// computePolygonAreaAnyPlane (Newell's method — polygon যেই সমতলে থাকুক
// না কেন সঠিক area দেয়) এখন @/lib/types/element-এ একটা shared, exported
// utility হিসেবে আছে (deriveStairSelfWeightLoads.ts-ও এটা ব্যবহার করে
// waist-slab true area-র জন্য) — এখানে আর আলাদা লোকাল কপি রাখা হলো না।

/**
 * Support existence check — backend এখন Y≈0 heuristic দিয়ে support
 * auto-detect করে (analysis_orchestration.py দেখুন)। কোনো element
 * base level এ না থাকলে backend সম্পূর্ণ unsupported model পাবে এবং
 * solve ব্যর্থ হবে বা অর্থহীন ফলাফল দেবে। এই চেক সেই পরিস্থিতি
 * analysis চালানোর আগেই ধরে।
 */
export function checkSupports(elements: StructuralElement[]): ValidationIssue[] {
  const lineElements = elements.filter(isLineElement);
  const hasBaseLevelElement = lineElements.some(
    (e) => e.startPoint.y <= 1e-3 || e.endPoint.y <= 1e-3
  );

  if (lineElements.length > 0 && !hasBaseLevelElement) {
    return [
      {
        id: "support:no-base-level",
        severity: "error",
        category: "support",
        message:
          "No element touches base level (Y≈0) — the solver auto-detects supports only at Y≈0, so this model has no boundary conditions and cannot be solved meaningfully.",
      },
    ];
  }

  return [
    {
      id: "support:heuristic-note",
      severity: "info",
      category: "support",
      message:
        "Supports are auto-detected at Y≈0 (elevation heuristic) — there is no manual support-definition UI yet, so verify this matches your intended boundary conditions.",
    },
  ];
}

function elementLabel(e: StructuralElement): string {
  return `${e.category} "${e.label}"`;
}

/** Model Checker এর সব সাব-চেক একসাথে চালায়। */
export function runModelChecks(elements: StructuralElement[]): ValidationIssue[] {
  return [
    ...checkConnectivity(elements),
    ...checkDuplicates(elements),
    ...checkGeometry(elements),
    ...checkSupports(elements),
  ];
}
