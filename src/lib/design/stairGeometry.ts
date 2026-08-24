/**
 * stairGeometry.ts — StairElement (একটা single flight, waist-slab
 * hisebe modeled — element.ts-এর StairElement কমেন্ট দেখুন) এর
 * vertices থেকে stair design-এর জন্য দরকারি geometric quantities বের
 * করে: horizontal run (going), vertical rise, slope length (waist
 * slab-এর নিজস্ব inclined span), এবং slope angle।
 * ------------------------------------------------------------------
 * কেন আলাদা ফাইল, deriveStairSelfWeightLoads.ts-এর মতো সরাসরি inline
 * না করে: এই geometry design module (stairDesign.ts) এবং ভবিষ্যতে
 * detailing/drawing sheet (Phase 3/4) — দুই জায়গাতেই লাগবে, তাই একটা
 * single source of truth হিসেবে রাখা হলো।
 *
 * mapStair()-এর vertex order (hub-geometry-parser.ts, counter-clockwise,
 * AreaElement.vertices কমেন্ট অনুযায়ী): [startLeft@base, startRight@base,
 * endRight@top, endLeft@top] — অর্থাৎ vertices[0]/[1] flight-এর bottom
 * edge (দুই পাশের প্রান্ত), vertices[2]/[3] top edge। rise/run তাই
 * bottom-edge মধ্যবিন্দু → top-edge মধ্যবিন্দু থেকে বের করা হয়, যা
 * width offset (দুই পাশের perpendicular vertex) বাতিল করে দেয়
 * (centerline-এর ঠিক rise/run পাওয়া যায়, edge vertex থেকে সরাসরি না)।
 */

import type { Point3D, StairElement } from "@/lib/types/element";

export interface StairFlightGeometry {
  /** অনুভূমিক দূরত্ব (মিটার), bottom edge মধ্যবিন্দু → top edge মধ্যবিন্দু (plan projection) — অর্থাৎ flight-এর মোট "going"। */
  horizontalRunM: number;
  /** উল্লম্ব উচ্চতা (মিটার), bottom → top elevation পার্থক্য — flight-এর মোট rise। */
  verticalRiseM: number;
  /** waist slab-এর নিজস্ব inclined span (মিটার) — sqrt(run² + rise²), flexural design-এ এটাই effective span, horizontal run না। */
  slopeLengthM: number;
  /** slope angle (radian), atan(rise/run) — waist slab thickness কে vertical-projected/horizontal thickness-এ রূপান্তরের জন্য দরকার হতে পারে। */
  slopeAngleRad: number;
  /** flight-এর width (মিটার) — bottom edge-এর দুই vertex-এর মধ্যবর্তী দূরত্ব। */
  widthM: number;
}

function midpoint(a: Point3D, b: Point3D): Point3D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/**
 * StairElement.vertices থেকে flight geometry বের করে। vertices ঠিক ৪টা
 * না হলে (mapStair()-এর expected shape না হলে — কোনো manual edit বা
 * ভবিষ্যতে ভিন্ন geometry source থেকে এলে) null রিটার্ন করে, ধরে নেওয়া
 * (assume) করে না।
 */
export function deriveStairFlightGeometry(element: StairElement): StairFlightGeometry | null {
  const v = element.vertices;
  if (v.length !== 4) {
    return null;
  }

  const [startLeft, startRight, endRight, endLeft] = v;
  const bottomMid = midpoint(startLeft, startRight);
  const topMid = midpoint(endLeft, endRight);

  const widthM = distance3D(startLeft, startRight);

  // Y (elevation) বাদ দিয়ে শুধু X,Z প্লেনে horizontal run — mapStair()
  // এর Y-অক্ষ-কে-elevation কনভেনশন অনুযায়ী (deriveStairSelfWeightLoads.ts
  // এর মতোই, Point3D.y কে vertical ধরা হয়েছে)।
  const horizontalRunM = Math.hypot(topMid.x - bottomMid.x, topMid.z - bottomMid.z);
  const verticalRiseM = topMid.y - bottomMid.y;

  if (horizontalRunM <= 0 && verticalRiseM <= 0) {
    return null;
  }

  const slopeLengthM = Math.hypot(horizontalRunM, verticalRiseM);
  const slopeAngleRad = Math.atan2(verticalRiseM, horizontalRunM);

  return { horizontalRunM, verticalRiseM, slopeLengthM, slopeAngleRad, widthM };
}
