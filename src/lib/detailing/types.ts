/**
 * Detailing Model — Unified Rebar Geometry Schema
 * Phase 10 — Visualization + Drawing & Detailing (Section 14+15)
 *
 * লক্ষ্য: CSI (ETABS/SAFE) এর Detailing view-এর মতো একটা 3D মডেলে পুরো
 * স্ট্রাকচারের actual rebar (longitudinal bars, stirrups/ties, mesh)
 * দেখানো — Design Engine (Phase 6) এর required-As কে actual buildable
 * bar geometry-তে রূপান্তর করে।
 *
 * ডিজাইন সিদ্ধান্ত — "local coordinates" পদ্ধতি:
 *   প্রতিটা DetailingResult তার নিজের element-এর local coordinate
 *   system-এ rebar geometry বর্ণনা করে (beam/column: local axis বরাবর
 *   0 → length, cross-section local x/y; slab/wall/footing: polygon
 *   plane-এর local grid), origin ও rotation আলাদাভাবে element geometry
 *   থেকে derive হয় render করার সময়। এটা এই কারণে যে (ক) একই generator
 *   function বিভিন্ন orientation-এর element-এ পুনর্ব্যবহার করা যায় —
 *   world-space এ বার বসালে প্রতিটা generator কে rotation matrix জানতে
 *   হতো, যেটা concern গুলো mix করে ফেলত; (খ) DetailingLayer (viewport)
 *   এই একই local→world transform যুক্তি ব্যবহার করে যা ElementsLayer
 *   ইতিমধ্যে ব্যবহার করছে (element এর startPoint/endPoint/vertices
 *   থেকে position+rotation বের করা) — তাই geometry ও detailing layer
 *   এর মধ্যে কোনো duplication বা mismatch হয় না।
 *
 * সব dimension mm এককে (বাকি অ্যাপের সাথে সামঞ্জস্যপূর্ণ), কিন্তু 3D
 * renderer এ ব্যবহারের আগে মিটারে রূপান্তরিত হয় (ElementsLayer এর মতোই
 * কনভেনশন — scene units মিটার)।
 */

export type DetailingElementCategory =
  | "beam"
  | "column"
  | "slab"
  | "wall"
  | "stair"
  | "footing"
  | "combined-footing"
  | "strip-footing"
  | "mat-foundation"
  | "pile-cap";

/** একটা সরল রেখা বার — দুটো local-space পয়েন্ট দিয়ে সংজ্ঞায়িত (longitudinal bar, dowel, ইত্যাদি)। */
export interface RebarSegment {
  id: string;
  startLocal: [number, number, number]; // mm, local coords
  endLocal: [number, number, number]; // mm, local coords
  diameterMm: number;
  role: "longitudinal-top" | "longitudinal-bottom" | "longitudinal-side" | "longitudinal-main" | "dowel" | "mesh-x" | "mesh-y";
}

/** একটা বন্ধ/খোলা loop bar — stirrup, tie, বা hoop। polyline points local-space এ, loop হলে শেষ পয়েন্ট প্রথম পয়েন্টের কাছে ফিরে আসে। */
export interface RebarLoop {
  id: string;
  pointsLocal: [number, number, number][]; // mm, local coords, ordered polyline
  diameterMm: number;
  role: "stirrup" | "tie" | "hoop";
  positionAlongAxisMm: number; // beam/column axis বরাবর অবস্থান (0 = start), reference/debug এর জন্য
}

export interface BarScheduleRow {
  barMark: string; // যেমন "B1-T1", "C1-L1"
  diameterMm: number;
  count: number;
  shape: "straight" | "stirrup" | "tie" | "L-bend" | "U-bend";
  cutLengthMm: number;
  totalLengthMm: number; // cutLengthMm × count
}

export interface DetailingResult {
  elementId: string;
  elementLabel: string;
  category: DetailingElementCategory;
  generatedAt: string; // ISO timestamp — কোন Design run থেকে detailing generate হয়েছে তা track করতে
  sourceDesignStatus: "ok" | "warning" | "error"; // underlying design report এর status, detailing UI তে বিপদজনক element highlight করতে ব্যবহৃত
  longitudinalBars: RebarSegment[];
  transverseBars: RebarLoop[]; // stirrups/ties/hoops
  meshBars?: RebarSegment[]; // slab/wall/footing — two-way mesh
  schedule: BarScheduleRow[]; // Bar Bending Schedule (BBS) rows এই element এর জন্য
  warnings: string[];
}
