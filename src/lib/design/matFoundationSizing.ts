/**
 * Mat/Raft Foundation — Rigid Method Pressure Distribution
 * Phase 7c — ACI 318-19 Chapter 13 / classical rigid-mat method।
 * Mat কে perfectly rigid ধরা হয় (soil pressure রৈখিকভাবে বিতরণ হয়,
 * flexible-mat এর মতো local deformation-নির্ভর pressure না), যা এই
 * app-এর FE shell stress recovery না থাকার সীমাবদ্ধতার সাথে সামঞ্জস্যপূর্ণ
 * (Phase 4a — shell element এখনো শুধু displacement দেয়, moment/stress
 * না)।
 *
 * Pressure distribution:
 *   q(x,z) = P/A ± Mx·z/Ix ± Mz·x/Iz
 * যেখানে P = total column load, A = mat plan area, Mx/Mz = load
 * resultant-এর eccentricity থেকে আসা moment (mat centroid এর সাপেক্ষে),
 * Ix/Iz = mat plan area-র moment of inertia (rectangular approximation
 * প্লাস polygon bounding থেকে, exact polygon second-moment না — v1
 * সরলীকরণ, rectangular bounding box ভিত্তিক)।
 */

export interface MatColumnLoad {
  label: string;
  xM: number; // mat local coordinate (plan), মিটার
  zM: number;
  servicePointLoadKN: number;
}

export interface MatFoundationSizingInput {
  vertices: { xM: number; zM: number }[]; // mat plan vertices, XZ প্লেনে
  columnLoads: MatColumnLoad[];
  allowableBearingPressureKPa: number;
  footingSelfWeightAllowanceKPa?: number;
}

export interface MatColumnPressureResult {
  label: string;
  pressureKPa: number;
}

export interface MatFoundationSizingResult {
  planAreaM2: number;
  centroidXM: number;
  centroidZM: number;
  totalServiceLoadKN: number;
  eccentricityXM: number; // resultant load centroid থেকে mat plan centroid পর্যন্ত দূরত্ব (X দিকে)
  eccentricityZM: number;
  averagePressureKPa: number;
  maxPressureKPa: number;
  minPressureKPa: number;
  perColumnPressure: MatColumnPressureResult[];
  netAllowablePressureKPa: number;
  isUplift: boolean; // minPressure < 0 হলে (mat এর কোনো অংশ soil থেকে uplift হচ্ছে) — rigid-uniform মডেল আর সঠিক না
  warnings: string[];
}

function computePolygonAreaAndCentroid(vertices: { xM: number; zM: number }[]): {
  area: number;
  centroidX: number;
  centroidZ: number;
} {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < vertices.length; i++) {
    const v0 = vertices[i];
    const v1 = vertices[(i + 1) % vertices.length];
    const cross = v0.xM * v1.zM - v1.xM * v0.zM;
    area += cross;
    cx += (v0.xM + v1.xM) * cross;
    cz += (v0.zM + v1.zM) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-9) {
    return { area: 0, centroidX: 0, centroidZ: 0 };
  }
  cx = cx / (6 * area);
  cz = cz / (6 * area);
  return { area: Math.abs(area), centroidX: cx, centroidZ: cz };
}

/**
 * Bounding-box approximation দিয়ে Ix/Iz (rectangular mat ধরে) — একটা
 * v1 সরলীকরণ, exact polygon-এর second moment of area না। বেশিরভাগ
 * mat/raft ব্যবহারিকভাবে rectangular বা near-rectangular হয়, তাই এই
 * approximation যুক্তিসঙ্গত প্রাথমিক অনুমান — অনিয়মিত (L-shape ইত্যাদি)
 * mat plan-এর জন্য এই মডিউলের ফলাফল রক্ষণশীলভাবে যাচাই করা উচিত।
 */
function computeBoundingBoxMomentOfInertia(vertices: { xM: number; zM: number }[]): { Ix: number; Iz: number } {
  const xs = vertices.map((v) => v.xM);
  const zs = vertices.map((v) => v.zM);
  const widthX = Math.max(...xs) - Math.min(...xs);
  const widthZ = Math.max(...zs) - Math.min(...zs);
  // Ix (bending about X-axis, resists moment from Z-eccentricity) = widthX * widthZ^3 / 12
  const Ix = (widthX * widthZ ** 3) / 12;
  const Iz = (widthZ * widthX ** 3) / 12;
  return { Ix, Iz };
}

export function sizeMatFoundation(input: MatFoundationSizingInput): MatFoundationSizingResult {
  const { vertices, columnLoads, allowableBearingPressureKPa, footingSelfWeightAllowanceKPa } = input;
  const warnings: string[] = [];

  const { area, centroidX, centroidZ } = computePolygonAreaAndCentroid(vertices);
  const selfWeightAllowance = footingSelfWeightAllowanceKPa ?? allowableBearingPressureKPa * 0.1;
  const netAllowablePressure = allowableBearingPressureKPa - selfWeightAllowance;

  const totalLoad = columnLoads.reduce((sum, c) => sum + c.servicePointLoadKN, 0);

  if (area <= 0 || totalLoad <= 0 || netAllowablePressure <= 0) {
    if (area <= 0) warnings.push("Mat plan area is zero or invalid — check vertices.");
    if (totalLoad <= 0) warnings.push("Total column service load is zero or negative — check column load inputs.");
    if (netAllowablePressure <= 0)
      warnings.push("Self-weight allowance exceeds the allowable bearing pressure — verify input.");
    return {
      planAreaM2: area,
      centroidXM: centroidX,
      centroidZM: centroidZ,
      totalServiceLoadKN: totalLoad,
      eccentricityXM: 0,
      eccentricityZM: 0,
      averagePressureKPa: 0,
      maxPressureKPa: 0,
      minPressureKPa: 0,
      perColumnPressure: [],
      netAllowablePressureKPa: netAllowablePressure,
      isUplift: false,
      warnings,
    };
  }

  // Resultant load position (weighted centroid of column loads)
  const resultantX = columnLoads.reduce((sum, c) => sum + c.xM * c.servicePointLoadKN, 0) / totalLoad;
  const resultantZ = columnLoads.reduce((sum, c) => sum + c.zM * c.servicePointLoadKN, 0) / totalLoad;

  const eccentricityX = resultantX - centroidX;
  const eccentricityZ = resultantZ - centroidZ;

  const { Ix, Iz } = computeBoundingBoxMomentOfInertia(vertices);

  const Mx = totalLoad * eccentricityZ; // moment about X-axis caused by Z-eccentricity
  const Mz = totalLoad * eccentricityX; // moment about Z-axis caused by X-eccentricity

  const averagePressure = totalLoad / area;

  const perColumnPressure: MatColumnPressureResult[] = columnLoads.map((c) => {
    const dz = c.zM - centroidZ;
    const dx = c.xM - centroidX;
    const pressure = averagePressure + (Ix > 0 ? (Mx * dz) / Ix : 0) + (Iz > 0 ? (Mz * dx) / Iz : 0);
    return { label: c.label, pressureKPa: pressure };
  });

  const maxPressure = Math.max(averagePressure, ...perColumnPressure.map((p) => p.pressureKPa));
  const minPressure = Math.min(averagePressure, ...perColumnPressure.map((p) => p.pressureKPa));

  const isUplift = minPressure < 0;
  if (isUplift) {
    warnings.push(
      "Computed pressure is negative at one or more locations (uplift) — the rigid-method linear-pressure assumption breaks down here; a partial-contact analysis or mat re-sizing/re-positioning is needed."
    );
  }

  if (maxPressure > allowableBearingPressureKPa) {
    warnings.push(
      `Maximum computed pressure (${maxPressure.toFixed(1)} kPa) exceeds the allowable bearing pressure (${allowableBearingPressureKPa.toFixed(1)} kPa) at the most heavily loaded location — increase mat area or adjust load distribution.`
    );
  }

  return {
    planAreaM2: area,
    centroidXM: centroidX,
    centroidZM: centroidZ,
    totalServiceLoadKN: totalLoad,
    eccentricityXM: eccentricityX,
    eccentricityZM: eccentricityZ,
    averagePressureKPa: averagePressure,
    maxPressureKPa: maxPressure,
    minPressureKPa: minPressure,
    perColumnPressure,
    netAllowablePressureKPa: netAllowablePressure,
    isUplift,
    warnings,
  };
}
