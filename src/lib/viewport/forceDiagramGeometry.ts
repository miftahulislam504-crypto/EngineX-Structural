import type { Point3D } from "@/lib/types/element";
import type { ElementEndForce } from "@/lib/analysis/runAnalysis";
import { computeLocalAxes } from "@/lib/analysis/localAxisTransform";

/**
 * Phase 10m — Moment/Shear/Axial Diagram geometry।
 *
 * সীমাবদ্ধতা, honestly flagged: backend প্রতিটা (sub-)element এর জন্য
 * শুধু দুইটা প্রান্তের (start/end) force value দেয় — mid-span কোনো
 * intermediate sample point নেই। তাই diagram একটা piecewise-LINEAR
 * approximation (ETABS/SAP2000 এর মতো cubic/parabolic শেপ-function-
 * ভিত্তিক নিখুঁত diagram না) — uniform distributed load এর নিচে আসল
 * moment diagram parabolic হওয়ার কথা, কিন্তু আমরা সরলরেখা আঁকব। যদি
 * একটা element mid-span point load এর কারণে backend এ split হয়ে
 * থাকে (subStartRatio/subEndRatio, একাধিক entry), সেই sub-element
 * বিভাজন গুলোই আমাদের একমাত্র অতিরিক্ত sample point — যত বেশি split
 * তত বেশি accurate piecewise-linear approximation, কিন্তু কোনো split
 * ছাড়া uniform load থাকলে diagram রেখাটা straight-line approximation
 * থেকে যাবে। এটা UI তে একটা নোট হিসেবে দেখানো হবে।
 */

export type DiagramQuantity = "moment" | "shear" | "axial";

export interface DiagramSamplePoint {
  /** element এর শুরু থেকে দূরত্ব অনুপাত (0=start, 1=end), sub-element split ধরে। */
  ratio: number;
  /** ওই বিন্দুর baseline world-space অবস্থান (element axis বরাবর, offset ছাড়া)। */
  position: [number, number, number];
  /** local Y ও Z দুই দিকের মান (moment এর জন্য My/Mz, shear এর জন্য Vy/Vz, axial এর জন্য একটাই স্কেলার — z তে 0)। */
  valueY: number;
  valueZ: number;
  /** baseline position + valueY*scale, শুধু local Y দিকে অফসেট (Y-plane diagram curve)। */
  offsetPositionY: [number, number, number];
  /** baseline position + valueZ*scale, শুধু local Z দিকে অফসেট (Z-plane diagram curve, moment/shear এর dual-axis হলে প্রাসঙ্গিক)। */
  offsetPositionZ: [number, number, number];
}

/**
 * একটা element এর সব ElementEndForce entry (সম্ভবত একাধিক sub-element,
 * split হলে) কে subStartRatio অনুযায়ী sort করে একটা ধারাবাহিক sample
 * point list বানায়। axial এর জন্য শুধু start/endAxial ব্যবহার হয়
 * (scalar, tension/compression sign — Phase 4a কনভেনশন অনুযায়ী
 * compression-positive), moment/shear এর জন্য local Y ও Z উভয় component।
 */
export function buildDiagramSamples(
  forcesForElement: ElementEndForce[],
  quantity: DiagramQuantity
): { ratio: number; valueY: number; valueZ: number }[] {
  const sorted = [...forcesForElement].sort((a, b) => a.subStartRatio - b.subStartRatio);
  const points: { ratio: number; valueY: number; valueZ: number }[] = [];

  for (const f of sorted) {
    let startY: number, startZ: number, endY: number, endZ: number;
    switch (quantity) {
      case "moment":
        startY = f.startMomentZ; // local Z-axis bending → diagram drawn in local Y plane
        startZ = f.startMomentY; // local Y-axis bending → diagram drawn in local Z plane
        endY = f.endMomentZ;
        endZ = f.endMomentY;
        break;
      case "shear":
        startY = f.startShearY;
        startZ = f.startShearZ;
        endY = f.endShearY;
        endZ = f.endShearZ;
        break;
      case "axial":
        startY = f.startAxial;
        startZ = 0;
        endY = f.endAxial;
        endZ = 0;
        break;
    }
    // পরপর sub-element এর সংযোগস্থলে duplicate ratio point এড়ানো (আগের
    // sub-element এর end ও পরেরটার start একই physical point) —
    // প্রথমটা রেখে দ্বিতীয়টা বাদ, যাতে diagram এ zero-length সেগমেন্ট
    // না হয়।
    if (points.length === 0 || Math.abs(points[points.length - 1].ratio - f.subStartRatio) > 1e-6) {
      points.push({ ratio: f.subStartRatio, valueY: startY, valueZ: startZ });
    }
    points.push({ ratio: f.subEndRatio, valueY: endY, valueZ: endZ });
  }

  return points;
}

/**
 * Diagram sample points কে world-space 3D polyline এ রূপান্তর করে —
 * element এর local axis বরাবর position ইন্টারপোলেট করে, তারপর local
 * Y ও local Z দিক দুটোতে আলাদাভাবে value*scale অফসেট করে দুইটা
 * independent "ribbon" curve বানায় (ETABS এর diagram-ribbon স্টাইলে,
 * baseline element axis নিজেই তৃতীয় রেফারেন্স রেখা)। আগে একটা bug
 * ছিল যেখানে Y ও Z অফসেট একই বিন্দুতে যোগ হয়ে যেত — সেটা দুইটা ভিন্ন
 * bending/shear plane কে ভুলভাবে একটা resultant এ মিশিয়ে ফেলত, তাই
 * এখন আলাদা রাখা হলো (moment এর জন্য My ও Mz আলাদা diagram, axial এ
 * শুধু Y ব্যবহৃত হয়, Z সবসময় 0 থাকে ফলে offsetPositionZ === position)।
 */
export function buildDiagramWorldPoints(
  start: Point3D,
  end: Point3D,
  samples: { ratio: number; valueY: number; valueZ: number }[],
  scale: number
): DiagramSamplePoint[] {
  const axes = computeLocalAxes(start, end);
  return samples.map((s) => {
    const px = start.x + (end.x - start.x) * s.ratio;
    const py = start.y + (end.y - start.y) * s.ratio;
    const pz = start.z + (end.z - start.z) * s.ratio;
    const position: [number, number, number] = [px, py, pz];
    const offsetPositionY: [number, number, number] = [
      px + axes.y[0] * s.valueY * scale,
      py + axes.y[1] * s.valueY * scale,
      pz + axes.y[2] * s.valueY * scale,
    ];
    const offsetPositionZ: [number, number, number] = [
      px + axes.z[0] * s.valueZ * scale,
      py + axes.z[1] * s.valueZ * scale,
      pz + axes.z[2] * s.valueZ * scale,
    ];
    return { ratio: s.ratio, position, valueY: s.valueY, valueZ: s.valueZ, offsetPositionY, offsetPositionZ };
  });
}
