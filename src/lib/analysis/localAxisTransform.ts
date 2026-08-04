import type { Point3D } from "@/lib/types/element";

/**
 * Phase 10m — Local axis system, backend cpp/src/stiffness.cpp এর
 * computeTransformationMatrix() থেকে হুবহু পোর্ট করা (একই algorithm,
 * একই reference-vector convention) — যাতে elementEndForces এর
 * startMomentY/startMomentZ/startShearY/startShearZ (backend এর local
 * coordinate system এ প্রকাশিত) সঠিক 3D world direction এ আঁকা যায়।
 *
 * এই ফাইল কোনো নতুন সিদ্ধান্ত নেয় না — backend যা করে সেটাই পুনরায়
 * বাস্তবায়ন করে (দুই পাশে local axis orientation না মিললে diagram
 * ভুল দিকে আঁকা হবে, backend এর সংখ্যা ঠিক থাকলেও)। localX = element
 * এর longitudinal axis (start→end), localZ = localX ও reference vector
 * এর cross product, localY = localZ ও localX এর cross product
 * (right-hand rule সম্পূর্ণ করতে)। Vertical member (column) এ global Y
 * নিজেই localX এর সমান্তরাল হয়ে যায় (cross product undefined), তাই
 * সেই বিশেষ ক্ষেত্রে global Z কে reference ধরা হয় — এটাই backend এর
 * নিয়ম, SAP2000/ETABS এর মতো সফটওয়্যারেও প্রচলিত কনভেনশন।
 */

export interface LocalAxes {
  x: [number, number, number];
  y: [number, number, number];
  z: [number, number, number];
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** একটা line element (start→end) এর local X/Y/Z axis বের করে — backend এর সাথে বিট-পারফেক্ট সামঞ্জস্যপূর্ণ। */
export function computeLocalAxes(start: Point3D, end: Point3D): LocalAxes {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const localX = normalize([dx, dy, dz]);

  const isVertical = Math.abs(localX[0]) < 1e-6 && Math.abs(localX[2]) < 1e-6;
  const referenceVector: [number, number, number] = isVertical ? [0, 0, 1] : [0, 1, 0];

  const localZ = normalize(cross(localX, referenceVector));
  const localY = cross(localZ, localX); // ইতিমধ্যে unit-length (localX, localZ উভয়ই unit ও perpendicular)

  return { x: localX, y: localY, z: localZ };
}
